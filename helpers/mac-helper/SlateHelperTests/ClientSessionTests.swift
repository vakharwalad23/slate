import Foundation
import XCTest
@testable import SlateHelper

private final class Outbox: @unchecked Sendable {
    private(set) var messages: [Message] = []
    func add(_ message: Message) { messages.append(message) }
    func last(_ match: (Message) -> Bool) -> Message? { messages.last(where: match) }
}

private struct OKRunner: ProcessRunning {
    func run(_ launchPath: String, _ args: [String], stdin: String?) async throws -> String { "" }
}

private let sessionPairingSecret = Data([UInt8](repeating: 7, count: 15))

private struct HandshakeStalled: Error { let step: String }

private final class Flag: @unchecked Sendable { var value = false }

private func makeServices() -> HelperServices {
    let tempDir = FileManager.default.temporaryDirectory.appending(path: "slate-test-\(UUID().uuidString)")
    return HelperServices(
        tokenStore: TokenStore(directory: tempDir),
        pairing: PairingService(makeSecret: { sessionPairingSecret }),
        identity: IdentityKeyStore(directory: tempDir).identity,
        catalog: AppCatalog(),
        executor: CommandExecutor(runner: OKRunner()),
        capabilities: HelperConfig.capabilities,
        helperName: HelperConfig.name,
        helperVersion: HelperConfig.version,
        onPairingCode: { _, _ in },
        onDevicesChanged: {},
        onLog: { _, _ in }
    )
}

private func feed(_ services: HelperServices, _ messages: [Message]) async -> [Message] {
    let session = ClientSession(services: services)
    let outbox = Outbox()
    for message in messages {
        await session.handle(message, send: { outbox.add($0) }, close: {})
    }
    return outbox.messages
}

private func pairThroughSession(
    _ session: ClientSession,
    _ outbox: Outbox,
    secret: Data = sessionPairingSecret
) async throws -> (token: String, records: RecordLayer) {
    func handle(_ m: Message) async { await session.handle(m, send: { outbox.add($0) }, close: {}) }
    await handle(.hello(id: "h", reId: nil, deviceId: "dev1", deviceName: "phone", appVersion: "1"))
    await handle(.pairRequest(id: "pr", reId: nil))
    let ephemeral = CryptoPrimitives.generateKeyPair()
    let initiator = PairInitiator(ephemeral: KeyPair(secretKey: ephemeral.secretKey, publicKey: ephemeral.publicKey))
    await handle(.secHello(id: "sh", reId: nil, mode: "pair", e: initiator.hello(), d: nil))
    guard case let .secHelloAck(_, _, _, ackE, ackSOptional, _)? = outbox.last({ if case .secHelloAck = $0 { return true }; return false }),
          let ackS = ackSOptional else {
        throw HandshakeStalled(step: "sec_hello_ack")
    }
    let confirm = try initiator.consumeAck(ackE: ackE, ackS: ackS, secret: secret)
    await handle(.secConfirm(id: "sc", reId: nil, d: confirm))
    guard case let .secConfirmAck(_, _, confirmAckD)? = outbox.last({ if case .secConfirmAck = $0 { return true }; return false }) else {
        throw HandshakeStalled(step: "sec_confirm_ack")
    }
    let result = try initiator.finish(confirmAckD: confirmAckD)
    let records = try RecordLayer(sendKey: result.keys.sendKey, recvKey: result.keys.recvKey)
    return (result.token, records)
}

final class ClientSessionTests: XCTestCase {
    func testHelloProducesUnpairedAck() async {
        let replies = await feed(makeServices(), [
            .hello(id: "h", reId: nil, deviceId: "dev1", deviceName: "phone", appVersion: "1.0.0"),
        ])
        guard case let .helloAck(_, reId, _, _, capabilities, paired) = replies.first else {
            return XCTFail("expected hello_ack, got \(replies)")
        }
        XCTAssertEqual(reId, "h")
        XCTAssertFalse(paired)
        XCTAssertTrue(capabilities.appList)
        XCTAssertTrue(capabilities.appIcons)
    }

    func testPingProducesPong() async {
        let replies = await feed(makeServices(), [.ping(id: "p", reId: nil, t: 7)])
        guard case let .pong(_, reId, t) = replies.first else { return XCTFail("expected pong") }
        XCTAssertEqual(reId, "p")
        XCTAssertEqual(t, 7)
    }

    func testPlaintextCommandIsUnauthorized() async {
        let replies = await feed(makeServices(), [
            .commandExecute(id: "c", reId: nil, command: .launchApp(app: "Safari")),
        ])
        guard case let .error(_, reId, code, _) = replies.first else { return XCTFail("expected error") }
        XCTAssertEqual(reId, "c")
        XCTAssertEqual(code, "unauthorized")
    }

    func testUnknownTypeIsDropped() async {
        let replies = await feed(makeServices(), [.unknown(type: "subscribe.state", id: "x", reId: nil)])
        XCTAssertTrue(replies.isEmpty)
    }

    func testSecurePairIssuesTokenInChannelAndRunsCommand() async throws {
        let services = makeServices()
        let session = ClientSession(services: services)
        let outbox = Outbox()
        let paired = try await pairThroughSession(session, outbox)
        XCTAssertFalse(paired.token.isEmpty)

        // The token must never appear in any plaintext (non-enc, non-sec_confirm_ack) frame.
        for message in outbox.messages {
            if case .enc = message { continue }
            if case .secConfirmAck = message { continue }
            let json = String(decoding: try encodeMessage(message), as: UTF8.self)
            XCTAssertFalse(json.contains(paired.token), "token leaked in plaintext: \(json)")
        }

        let command = try encodeMessage(.commandExecute(id: "c", reId: nil, command: .launchApp(app: "Safari")))
        await session.handle(.enc(id: "e", reId: nil, c: try paired.records.seal(command)),
                             send: { outbox.add($0) }, close: {})
        guard case let .enc(_, _, replyC)? = outbox.last({ if case .enc = $0 { return true }; return false }) else {
            return XCTFail("expected an enc reply")
        }
        // decodeMessage is inbound-only, so assert on the decrypted outbound JSON directly.
        let replyJson = String(decoding: try paired.records.open(replyC), as: UTF8.self)
        XCTAssertTrue(replyJson.contains("\"type\":\"command.result\""), replyJson)
        XCTAssertTrue(replyJson.contains("\"ok\":true"), replyJson)
    }

    func testSecurePairWrongCodeFailsClosed() async throws {
        let services = makeServices()
        let session = ClientSession(services: services)
        let outbox = Outbox()
        let wrong = Data([UInt8](repeating: 9, count: 15))
        _ = try? await pairThroughSession(session, outbox, secret: wrong)
        guard case let .secError(_, _, code, _)? = outbox.last({ if case .secError = $0 { return true }; return false }) else {
            return XCTFail("expected sec_error")
        }
        XCTAssertEqual(code, "bad_code")
    }

    func testReconnectWithTokenAuthenticatesInsideChannel() async throws {
        let services = makeServices()
        // Pair first so the device is registered and we hold a valid token.
        let paired = try await pairThroughSession(ClientSession(services: services), Outbox())

        let session = ClientSession(services: services)
        let outbox = Outbox()
        func handle(_ m: Message) async { await session.handle(m, send: { outbox.add($0) }, close: {}) }
        await handle(.hello(id: "h", reId: nil, deviceId: "dev1", deviceName: "phone", appVersion: "1"))
        let ephemeral = CryptoPrimitives.generateKeyPair()
        let initiator = try ReconnectInitiator(
            ephemeral: KeyPair(secretKey: ephemeral.secretKey, publicKey: ephemeral.publicKey),
            helperStaticPub: services.identity.publicKey
        )
        let hello = try initiator.hello()
        await handle(.secHello(id: "sh", reId: nil, mode: "reconnect", e: hello.e, d: hello.d))
        guard case let .secHelloAck(_, _, _, ackE, _, ackDOptional)? = outbox.last({ if case .secHelloAck = $0 { return true }; return false }),
              let ackD = ackDOptional else {
            return XCTFail("expected reconnect sec_hello_ack")
        }
        let keys = try initiator.finish(ackE: ackE, ackD: ackD)
        let records = try RecordLayer(sendKey: keys.sendKey, recvKey: keys.recvKey)
        let authFrame = try encodeMessage(.auth(id: "a", reId: nil, token: paired.token))
        await handle(.enc(id: "e", reId: nil, c: try records.seal(authFrame)))
        guard case let .enc(_, _, replyC)? = outbox.last({ if case .enc = $0 { return true }; return false }) else {
            return XCTFail("expected enc reply")
        }
        XCTAssertTrue(String(decoding: try records.open(replyC), as: UTF8.self).contains("\"type\":\"auth_ok\""))
    }

    func testPlaintextAfterHandshakeCloses() async throws {
        let services = makeServices()
        let session = ClientSession(services: services)
        let outbox = Outbox()
        _ = try await pairThroughSession(session, outbox)
        let closed = Flag()
        // A plaintext frame after the handshake is a protocol violation.
        await session.handle(.ping(id: "p", reId: nil, t: 1), send: { outbox.add($0) }, close: { closed.value = true })
        XCTAssertTrue(closed.value)
    }

    func testHelloDecodesFromWireJSON() {
        let json = """
        {"v":2,"id":"11111111-1111-1111-1111-111111111111","reId":null,"type":"hello",
        "payload":{"deviceId":"dev","deviceName":"phone","appVersion":"0.0.0"}}
        """
        guard case let .success(message) = decodeMessage(Data(json.utf8)),
              case let .hello(id, reId, deviceId, _, _) = message else {
            return XCTFail("expected a decoded hello")
        }
        XCTAssertEqual(id, "11111111-1111-1111-1111-111111111111")
        XCTAssertNil(reId)
        XCTAssertEqual(deviceId, "dev")
    }

    func testHelloAckEncodesWithLowercaseUuid() throws {
        let data = try encodeMessage(.helloAck(
            id: newMessageId(), reId: "abc",
            helperName: HelperConfig.name, helperVersion: HelperConfig.version,
            capabilities: HelperConfig.capabilities, paired: false
        ))
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(object["v"] as? Int, PROTOCOL_VERSION)
        XCTAssertEqual(object["type"] as? String, "hello_ack")
        XCTAssertEqual(object["reId"] as? String, "abc")
        let id = try XCTUnwrap(object["id"] as? String)
        XCTAssertEqual(id, id.lowercased())
    }
}
