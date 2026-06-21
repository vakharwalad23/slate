import XCTest
@testable import SlateHelper

private final class Outbox: @unchecked Sendable {
    private(set) var messages: [Message] = []
    func add(_ message: Message) { messages.append(message) }
}

private struct OKRunner: ProcessRunning {
    func run(_ launchPath: String, _ args: [String]) async throws -> String { "" }
}

private func makeServices(code: String = "654321") -> HelperServices {
    let tempDir = FileManager.default.temporaryDirectory.appending(path: "slate-test-\(UUID().uuidString)")
    return HelperServices(
        tokenStore: TokenStore(directory: tempDir),
        pairing: PairingService(makeCode: { code }),
        catalog: AppCatalog(),
        executor: CommandExecutor(runner: OKRunner()),
        capabilities: HelperConfig.capabilities,
        helperName: HelperConfig.name,
        helperVersion: HelperConfig.version,
        onPairingCode: { _ in },
        onDevicesChanged: {}
    )
}

private func feed(_ services: HelperServices, _ messages: [Message]) async -> [Message] {
    let session = ClientSession(services: services)
    let outbox = Outbox()
    for message in messages {
        await session.handle(message) { outbox.add($0) }
    }
    return outbox.messages
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

    func testCommandBeforeAuthIsUnauthorized() async {
        let replies = await feed(makeServices(), [
            .commandExecute(id: "c", reId: nil, command: .launchApp(app: "Safari")),
        ])
        guard case let .error(_, reId, code, _) = replies.first else { return XCTFail("expected error") }
        XCTAssertEqual(reId, "c")
        XCTAssertEqual(code, "unauthorized")
    }

    func testPairThenCommandSucceeds() async {
        let replies = await feed(makeServices(code: "654321"), [
            .hello(id: "h", reId: nil, deviceId: "dev1", deviceName: "phone", appVersion: "1"),
            .pairRequest(id: "pr", reId: nil),
            .pairConfirm(id: "pc", reId: nil, code: "654321"),
            .commandExecute(id: "c", reId: nil, command: .launchApp(app: "Safari")),
        ])
        XCTAssertTrue(replies.contains { if case .pairOk = $0 { return true }; return false })
        XCTAssertTrue(replies.contains {
            if case let .commandResult(_, _, ok, _) = $0 { return ok }
            return false
        })
        // pair_request itself produces no reply frame.
        XCTAssertFalse(replies.contains { if case .pairRequest = $0 { return true }; return false })
    }

    func testPairConfirmWrongCode() async {
        let replies = await feed(makeServices(code: "654321"), [
            .hello(id: "h", reId: nil, deviceId: "dev1", deviceName: "phone", appVersion: "1"),
            .pairRequest(id: "pr", reId: nil),
            .pairConfirm(id: "pc", reId: nil, code: "000000"),
        ])
        guard case let .pairError(_, _, reason) = replies.last else { return XCTFail("expected pair_error") }
        XCTAssertEqual(reason, "bad code")
    }

    func testAuthWithIssuedTokenSucceeds() async {
        let services = makeServices(code: "654321")
        let pairReplies = await feed(services, [
            .hello(id: "h", reId: nil, deviceId: "dev1", deviceName: "phone", appVersion: "1"),
            .pairRequest(id: "pr", reId: nil),
            .pairConfirm(id: "pc", reId: nil, code: "654321"),
        ])
        var token: String?
        for reply in pairReplies {
            if case let .pairOk(_, _, issued) = reply { token = issued }
        }
        let unwrapped = try? XCTUnwrap(token)
        let authReplies = await feed(services, [.auth(id: "a", reId: nil, token: unwrapped ?? "")])
        guard case let .authOk(_, reId) = authReplies.first else { return XCTFail("expected auth_ok") }
        XCTAssertEqual(reId, "a")
    }

    func testAuthInvalidTokenFails() async {
        let replies = await feed(makeServices(), [.auth(id: "a", reId: nil, token: "nope")])
        guard case let .authError(_, _, reason) = replies.first else { return XCTFail("expected auth_error") }
        XCTAssertEqual(reason, "invalid token")
    }

    func testUnknownTypeIsDropped() async {
        let replies = await feed(makeServices(), [.unknown(type: "subscribe.state", id: "x", reId: nil)])
        XCTAssertTrue(replies.isEmpty)
    }

    func testHelloDecodesFromWireJSON() {
        let json = """
        {"v":1,"id":"11111111-1111-1111-1111-111111111111","reId":null,"type":"hello",
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
        XCTAssertEqual(object["v"] as? Int, 1)
        XCTAssertEqual(object["type"] as? String, "hello_ack")
        XCTAssertEqual(object["reId"] as? String, "abc")
        let id = try XCTUnwrap(object["id"] as? String)
        XCTAssertEqual(id, id.lowercased())
    }
}
