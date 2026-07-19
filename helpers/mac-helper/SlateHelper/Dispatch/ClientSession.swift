import AppKit
import Foundation

let foregroundTopic = "foregroundApp"

// Three phases: plaintext (hello/ping/pair_request/sec_hello allowed), pairing
// (awaiting the code proof), and secure (all app traffic wrapped in enc). `ping` is allowed before the
// handshake so the phone's heartbeat does not drop the socket while pairing. The token is issued only
// inside the encrypted channel (never as a plaintext frame).
actor ClientSession {
    private enum Phase {
        case plaintext
        case pairing(responder: PairResponder, snapshotExpiresAt: Date)
        case secure(records: RecordLayer)
    }

    private let services: HelperServices
    private var phase: Phase = .plaintext
    private var authed = false
    private var deviceId: String?
    private var deviceName: String?
    private var send: (@Sendable (Message) -> Void)?
    private var close: (@Sendable () -> Void)?
    private var pairingTask: Task<Void, Never>?
    private var foregroundMonitor: ForegroundMonitor?

    init(services: HelperServices) {
        self.services = services
    }

    func handle(
        _ message: Message,
        send: @escaping @Sendable (Message) -> Void,
        close: @escaping @Sendable () -> Void
    ) async {
        self.send = send
        self.close = close

        if case let .secure(records) = phase {
            if case let .enc(_, _, c) = message {
                await handleEnc(c, records: records)
            } else {
                // Post-handshake, only enc is allowed; any plaintext frame is a protocol violation.
                close()
            }
            return
        }

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
            await startPairingLoop(replyId: id)

        case let .secHello(id, _, mode, e, d):
            if mode == "reconnect" {
                await handleReconnect(id: id, e: e, d: d, send: send)
            } else {
                await handleSecHello(id: id, mode: mode, e: e, send: send)
            }

        case let .secConfirm(id, _, d):
            await handleSecConfirm(id: id, d: d, send: send)

        case let .commandExecute(id, _, _):
            _ = requireAuth(id: id, send: send)

        case let .appsList(id, _):
            _ = requireAuth(id: id, send: send)

        case let .appsIcon(id, _, _):
            _ = requireAuth(id: id, send: send)

        case let .subscribeState(id, _, _):
            _ = requireAuth(id: id, send: send)

        default:
            break
        }
    }

    private func handleSecHello(id: String, mode: String, e: Data, send: @escaping @Sendable (Message) -> Void) async {
        guard mode == "pair" else {
            send(.secError(id: newMessageId(), reId: id, code: "bad_handshake", message: "unsupported mode"))
            return
        }
        switch await services.pairing.sessionState() {
        case .locked:
            send(.secError(id: newMessageId(), reId: id, code: "locked", message: "too many attempts"))
        case .none:
            send(.secError(id: newMessageId(), reId: id, code: "code_expired", message: "no active code"))
        case let .active(secret, expiresAt):
            let ephemeral = CryptoPrimitives.generateKeyPair()
            let responder = PairResponder(
                ephemeral: KeyPair(secretKey: ephemeral.secretKey, publicKey: ephemeral.publicKey),
                staticKey: services.identity,
                secret: secret
            )
            guard let ack = try? responder.respond(helloE: e) else {
                send(.secError(id: newMessageId(), reId: id, code: "bad_handshake", message: "bad key"))
                return
            }
            phase = .pairing(responder: responder, snapshotExpiresAt: expiresAt)
            send(.secHelloAck(id: newMessageId(), reId: id, mode: "pair", e: ack.e, s: ack.s, d: nil))
        }
    }

    private func handleSecConfirm(id: String, d: Data, send: @escaping @Sendable (Message) -> Void) async {
        guard case let .pairing(responder, snapshotExpiresAt) = phase else {
            send(.secError(id: newMessageId(), reId: id, code: "protocol", message: "unexpected sec_confirm"))
            return
        }
        if Date() >= snapshotExpiresAt {
            phase = .plaintext
            send(.secError(id: newMessageId(), reId: id, code: "code_expired", message: "code expired"))
            return
        }
        guard responder.confirm(confirmD: d) else {
            phase = .plaintext
            switch await services.pairing.recordFailure() {
            case .badCode:
                send(.secError(id: newMessageId(), reId: id, code: "bad_code", message: "wrong code"))
            case .locked:
                cancelPairingLoop()
                services.onPairingCode(nil, nil)
                send(.secError(id: newMessageId(), reId: id, code: "locked", message: "too many attempts"))
            }
            return
        }
        guard let deviceId else {
            phase = .plaintext
            send(.secError(id: newMessageId(), reId: id, code: "protocol", message: "no hello"))
            return
        }
        await services.pairing.recordSuccess()
        let token = await services.tokenStore.issue(deviceId: deviceId, deviceName: deviceName ?? "device")
        guard let complete = try? responder.complete(token: token),
              let records = try? RecordLayer(sendKey: complete.keys.sendKey, recvKey: complete.keys.recvKey) else {
            phase = .plaintext
            send(.secError(id: newMessageId(), reId: id, code: "bad_handshake", message: "complete failed"))
            return
        }
        authed = true
        cancelPairingLoop()
        services.onPairingCode(nil, nil)
        services.onDevicesChanged()
        send(.secConfirmAck(id: newMessageId(), reId: id, d: complete.confirmAck))
        phase = .secure(records: records)
    }

    // Codeless reconnect: verify the phone encrypted to our static, then go secure. authed stays false
    // until the token arrives inside the channel (handled in handleEnc).
    private func handleReconnect(id: String, e: Data, d: Data?, send: @escaping @Sendable (Message) -> Void) async {
        guard let d else {
            send(.secError(id: newMessageId(), reId: id, code: "bad_handshake", message: "missing proof"))
            return
        }
        let ephemeral = CryptoPrimitives.generateKeyPair()
        let responder = ReconnectResponder(
            ephemeral: KeyPair(secretKey: ephemeral.secretKey, publicKey: ephemeral.publicKey),
            staticKey: services.identity
        )
        guard let ack = try? responder.respond(helloE: e, helloD: d),
              let records = try? RecordLayer(sendKey: ack.keys.sendKey, recvKey: ack.keys.recvKey) else {
            send(.secError(id: newMessageId(), reId: id, code: "bad_handshake", message: "identity mismatch"))
            return
        }
        send(.secHelloAck(id: newMessageId(), reId: id, mode: "reconnect", e: ack.e, s: nil, d: ack.d))
        phase = .secure(records: records)
    }

    // Nested secure frames or a decrypt failure are protocol violations and close the connection.
    private func handleEnc(_ c: Data, records: RecordLayer) async {
        guard let inner = try? records.open(c), case let .success(message) = decodeMessage(inner) else {
            close?()
            return
        }
        switch message {
        case let .auth(id, _, token):
            if let resolved = await services.tokenStore.validate(token: token) {
                authed = true
                deviceId = resolved
                emitSecure(.authOk(id: newMessageId(), reId: id), records)
            } else {
                services.onLog(false, "auth rejected: invalid token")
                emitSecure(.authError(id: newMessageId(), reId: id, reason: "invalid token"), records)
            }

        case let .ping(id, _, t):
            emitSecure(.pong(id: newMessageId(), reId: id, t: t), records)

        case let .commandExecute(id, _, command):
            guard authed else { return emitUnauthorized(id: id, records: records) }
            let outcome = await services.executor.execute(command)
            if !outcome.ok { services.onLog(false, "command failed: \(outcome.error ?? "unknown")") }
            emitSecure(.commandResult(id: newMessageId(), reId: id, ok: outcome.ok, error: outcome.error), records)

        case let .appsList(id, _):
            guard authed else { return emitUnauthorized(id: id, records: records) }
            let apps = await services.catalog.refresh()
            emitSecure(.appsListResponse(id: newMessageId(), reId: id, apps: apps), records)

        case let .appsIcon(id, _, bundleIds):
            guard authed else { return emitUnauthorized(id: id, records: records) }
            for bundleId in bundleIds {
                guard let app = await services.catalog.info(for: bundleId) else { continue }
                let png = await Task.detached { IconRenderer.pngBase64(forBundlePath: app.path) }.value
                guard let png else { continue }
                emitSecure(.appsIconResponse(
                    id: newMessageId(), reId: id,
                    icons: [IconEntry(bundleId: bundleId, pngBase64: png, iconVersion: app.iconVersion)]
                ), records)
                await Task.yield()
            }

        case let .subscribeState(id, _, topics):
            guard authed else { return emitUnauthorized(id: id, records: records) }
            await updateForegroundSubscription(on: topics.contains(foregroundTopic))

        default:
            // Nested enc/sec_* or any unexpected inner type is a protocol violation.
            close?()
        }
    }

    private func emitSecure(_ message: Message, _ records: RecordLayer) {
        guard let data = try? encodeMessage(message), let sealed = try? records.seal(data) else { return }
        send?(.enc(id: newMessageId(), reId: nil, c: sealed))
    }

    private func emitUnauthorized(id: String, records: RecordLayer) {
        emitSecure(.error(id: newMessageId(), reId: id, code: "unauthorized", message: "auth required"), records)
    }

    private func updateForegroundSubscription(on: Bool) async {
        await foregroundMonitor?.stop()
        foregroundMonitor = nil
        guard on else { return }
        foregroundMonitor = await ForegroundMonitor { [weak self] bundleId in
            Task { await self?.emitForeground(bundleId) }
        }
    }

    private func emitForeground(_ bundleId: String) {
        guard case let .secure(records) = phase else { return }
        emitSecure(.stateUpdate(id: newMessageId(), reId: nil, topic: foregroundTopic, value: bundleId), records)
    }

    private func requireAuth(id: String, send: @escaping @Sendable (Message) -> Void) -> Bool {
        if authed { return true }
        send(.error(id: newMessageId(), reId: id, code: "unauthorized", message: "auth required"))
        return false
    }

    private func startPairingLoop(replyId: String?) async {
        cancelPairingLoop()
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

    private func pushNextCode(replyId: String?) async -> Double? {
        let result = await services.pairing.beginPairing()
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

    func teardown() async {
        cancelPairingLoop()
        services.onPairingCode(nil, nil)
        await foregroundMonitor?.stop()
        foregroundMonitor = nil
    }

    func currentDeviceId() -> String? { deviceId }
}

// Bridges NSWorkspace's main-thread activation notifications into a Sendable callback the actor can
// forward. Pushes the current frontmost on creation so a fresh subscriber is not blank until the next
// switch. No permission needed - foreground tracking is public, unlike keystroke synthesis.
@MainActor
final class ForegroundMonitor {
    private var observer: NSObjectProtocol?

    init(onChange: @escaping @Sendable (String) -> Void) {
        observer = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main
        ) { note in
            guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
                  let bundleId = app.bundleIdentifier else { return }
            onChange(bundleId)
        }
        if let front = NSWorkspace.shared.frontmostApplication?.bundleIdentifier {
            onChange(front)
        }
    }

    func stop() {
        if let observer { NSWorkspace.shared.notificationCenter.removeObserver(observer) }
        observer = nil
    }
}
