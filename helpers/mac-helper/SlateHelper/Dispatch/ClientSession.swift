import Foundation

// Per-connection handler holding the auth state. Mirrors the Node helper's handleMessage routing,
// extended with pairing + auth gating. `ping` is intentionally allowed before auth: the phone's
// heartbeat starts on TCP connect (before pairing) and gating it would drop the socket every cycle.
actor ClientSession {
    private let services: HelperServices
    private var authed = false
    private var deviceId: String?
    private var deviceName: String?
    private var send: (@Sendable (Message) -> Void)?
    private var pairingTask: Task<Void, Never>?

    init(services: HelperServices) {
        self.services = services
    }

    func handle(_ message: Message, send: @escaping @Sendable (Message) -> Void) async {
        self.send = send
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

        case let .pairRequest(id, _):
            // Auto-regenerate: the loop re-mints a fresh code each time the displayed one expires, so the
            // menu never shows a dead code; it stops on pair_ok or when the connection closes.
            await startPairingLoop(replyId: id)

        case let .pairConfirm(id, _, code):
            switch await services.pairing.confirm(code: code) {
            case .ok:
                guard let deviceId else {
                    send(.pairError(id: newMessageId(), reId: id, reason: "no hello"))
                    return
                }
                let token = await services.tokenStore.issue(deviceId: deviceId, deviceName: deviceName ?? "device")
                authed = true
                cancelPairingLoop()
                services.onPairingCode(nil, nil)
                services.onDevicesChanged()
                send(.pairOk(id: newMessageId(), reId: id, token: token))
            case .badCode:
                send(.pairError(id: newMessageId(), reId: id, reason: "bad code"))
            case .expired:
                send(.pairError(id: newMessageId(), reId: id, reason: "expired"))
            case .locked:
                cancelPairingLoop()
                services.onPairingCode(nil, nil)
                send(.pairError(id: newMessageId(), reId: id, reason: "locked"))
            }

        case let .auth(id, _, token):
            if let resolved = await services.tokenStore.validate(token: token) {
                authed = true
                deviceId = resolved
                send(.authOk(id: newMessageId(), reId: id))
            } else {
                services.onLog(false, "auth rejected: invalid token")
                send(.authError(id: newMessageId(), reId: id, reason: "invalid token"))
            }

        case let .commandExecute(id, _, command):
            guard requireAuth(id: id, send: send) else { return }
            let outcome = await services.executor.execute(command)
            if !outcome.ok { services.onLog(false, "command failed: \(outcome.error ?? "unknown")") }
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

    private func startPairingLoop(replyId: String?) async {
        cancelPairingLoop()
        // Mint the first code synchronously so it is live the moment pair_request returns; the loop then
        // only handles regeneration on expiry. replyId addresses an immediate lockout back to that request.
        guard let firstWait = await pushNextCode(replyId: replyId) else { return }
        pairingTask = Task { [weak self] in
            var wait = firstWait
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(wait))
                guard let self, let next = await self.pushNextCode(replyId: nil) else { return }
                wait = next
            }
        }
    }

    // Mint or reuse the code, push it to the menu + app, and return seconds until it expires (nil to stop).
    private func pushNextCode(replyId: String?) async -> Double? {
        let result = await services.pairing.beginPairing()
        // pair_ok may have cancelled us during the await; do not re-assert a stale code.
        if Task.isCancelled { return nil }
        switch result {
        case let .code(code, expiresAt):
            services.onPairingCode(code, expiresAt)
            let remaining = expiresAt.timeIntervalSinceNow
            send?(.pairPending(id: newMessageId(), reId: nil, expiresInMs: max(0, remaining) * 1000))
            return max(0.1, remaining)
        case .locked:
            services.onPairingCode(nil, nil)
            send?(.pairError(id: newMessageId(), reId: replyId, reason: "locked"))
            return nil
        }
    }

    private func cancelPairingLoop() {
        pairingTask?.cancel()
        pairingTask = nil
    }

    // Called when the connection closes so a stale code does not linger in the menu.
    func endPairing() {
        cancelPairingLoop()
        services.onPairingCode(nil, nil)
    }

    func currentDeviceId() -> String? { deviceId }
}
