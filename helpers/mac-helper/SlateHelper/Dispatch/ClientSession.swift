import Foundation

// Per-connection handler holding the auth state. Mirrors the Node helper's handleMessage routing,
// extended with pairing + auth gating. `ping` is intentionally allowed before auth: the phone's
// heartbeat starts on TCP connect (before pairing) and gating it would drop the socket every cycle.
actor ClientSession {
    private let services: HelperServices
    private var authed = false
    private var deviceId: String?
    private var deviceName: String?

    init(services: HelperServices) {
        self.services = services
    }

    func handle(_ message: Message, send: @escaping @Sendable (Message) -> Void) async {
        switch message {
        case let .hello(id, _, helloDeviceId, helloDeviceName, _):
            deviceId = helloDeviceId
            deviceName = helloDeviceName
            let paired = await services.tokenStore.hasDevice(helloDeviceId)
            send(.helloAck(
                id: newMessageId(), reId: id,
                helperName: services.helperName, helperVersion: services.helperVersion,
                capabilities: services.capabilities, paired: paired
            ))

        case let .ping(id, _, t):
            send(.pong(id: newMessageId(), reId: id, t: t))

        case .pairRequest:
            let code = await services.pairing.beginPairing()
            services.onPairingCode(code)

        case let .pairConfirm(id, _, code):
            switch await services.pairing.confirm(code: code) {
            case .ok:
                guard let deviceId else {
                    send(.pairError(id: newMessageId(), reId: id, reason: "no hello"))
                    return
                }
                let token = await services.tokenStore.issue(deviceId: deviceId, deviceName: deviceName ?? "device")
                authed = true
                services.onPairingCode(nil)
                services.onDevicesChanged()
                send(.pairOk(id: newMessageId(), reId: id, token: token))
            case .badCode:
                send(.pairError(id: newMessageId(), reId: id, reason: "bad code"))
            case .expired:
                send(.pairError(id: newMessageId(), reId: id, reason: "expired"))
            case .locked:
                send(.pairError(id: newMessageId(), reId: id, reason: "locked"))
            }

        case let .auth(id, _, token):
            if let resolved = await services.tokenStore.validate(token: token) {
                authed = true
                deviceId = resolved
                send(.authOk(id: newMessageId(), reId: id))
            } else {
                send(.authError(id: newMessageId(), reId: id, reason: "invalid token"))
            }

        case let .commandExecute(id, _, command):
            guard requireAuth(id: id, send: send) else { return }
            let outcome = await services.executor.execute(command)
            send(.commandResult(id: newMessageId(), reId: id, ok: outcome.ok, error: outcome.error))

        case let .appsList(id, _):
            guard requireAuth(id: id, send: send) else { return }
            let apps = await services.catalog.refresh()
            send(.appsListResponse(id: newMessageId(), reId: id, apps: apps))

        case let .appsIcon(id, _, bundleIds):
            guard requireAuth(id: id, send: send) else { return }
            for bundleId in bundleIds {
                guard let app = await services.catalog.info(for: bundleId) else { continue }
                let png = await Task.detached { IconRenderer.pngBase64(forBundlePath: app.path) }.value
                guard let png else { continue }
                // One icon per WS frame; a single large batched frame OOMs Android's WebSocket.
                send(.appsIconResponse(
                    id: newMessageId(), reId: id,
                    icons: [IconEntry(bundleId: bundleId, pngBase64: png, iconVersion: app.iconVersion)]
                ))
                await Task.yield()
            }

        default:
            break
        }
    }

    private func requireAuth(id: String, send: @escaping @Sendable (Message) -> Void) -> Bool {
        if authed { return true }
        send(.error(id: newMessageId(), reId: id, code: "unauthorized", message: "auth required"))
        return false
    }
}
