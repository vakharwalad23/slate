import XCTest
@testable import SlateHelper

private actor CallRecorder {
    private(set) var calls: [(path: String, args: [String])] = []
    func record(_ path: String, _ args: [String]) { calls.append((path, args)) }
}

private struct FakeRunner: ProcessRunning {
    let recorder: CallRecorder
    let failure: ProcessRunError?

    func run(_ launchPath: String, _ args: [String]) async throws -> String {
        await recorder.record(launchPath, args)
        if let failure { throw failure }
        return ""
    }
}

final class DispatcherTests: XCTestCase {
    func testHelloProducesAck() async {
        let reply = await Dispatcher().dispatch(
            .hello(id: "id-hello", reId: nil, deviceId: "d", deviceName: "n", appVersion: "1.0.0")
        )
        guard case let .helloAck(_, reId, helperName, _, capabilities, paired) = reply else {
            return XCTFail("expected hello_ack, got \(String(describing: reply))")
        }
        XCTAssertEqual(reId, "id-hello")
        XCTAssertEqual(helperName, HelperConfig.name)
        XCTAssertTrue(capabilities.launchApps)
        XCTAssertFalse(paired)
    }

    func testPingProducesPong() async {
        let reply = await Dispatcher().dispatch(.ping(id: "id-ping", reId: nil, t: 42))
        guard case let .pong(_, reId, t) = reply else {
            return XCTFail("expected pong, got \(String(describing: reply))")
        }
        XCTAssertEqual(reId, "id-ping")
        XCTAssertEqual(t, 42)
    }

    func testLaunchAppRunsOpenAndReportsOk() async {
        let recorder = CallRecorder()
        let dispatcher = Dispatcher(executor: CommandExecutor(runner: FakeRunner(recorder: recorder, failure: nil)))
        let reply = await dispatcher.dispatch(.commandExecute(id: "id-cmd", reId: nil, command: .launchApp(app: "Safari")))
        guard case let .commandResult(_, reId, ok, error) = reply else {
            return XCTFail("expected command.result, got \(String(describing: reply))")
        }
        XCTAssertEqual(reId, "id-cmd")
        XCTAssertTrue(ok)
        XCTAssertNil(error)
        let calls = await recorder.calls
        XCTAssertEqual(calls.first?.path, "/usr/bin/open")
        XCTAssertEqual(calls.first?.args, ["-a", "Safari"])
    }

    func testLaunchAppSurfacesFailure() async {
        let recorder = CallRecorder()
        let runner = FakeRunner(recorder: recorder, failure: .nonZeroExit(status: 1, message: "no such app"))
        let dispatcher = Dispatcher(executor: CommandExecutor(runner: runner))
        let reply = await dispatcher.dispatch(.commandExecute(id: "id-cmd", reId: nil, command: .launchApp(app: "Safari")))
        guard case let .commandResult(_, _, ok, error) = reply else {
            return XCTFail("expected command.result, got \(String(describing: reply))")
        }
        XCTAssertFalse(ok)
        XCTAssertEqual(error, "no such app")
    }

    func testUnknownTypeIsDropped() async {
        let reply = await Dispatcher().dispatch(.unknown(type: "apps.list", id: "x", reId: nil))
        XCTAssertNil(reply)
    }

    func testHelloDecodesFromWireJSON() {
        let json = """
        {"v":1,"id":"11111111-1111-1111-1111-111111111111","reId":null,"type":"hello",
        "payload":{"deviceId":"dev","deviceName":"phone","appVersion":"0.0.0"}}
        """
        guard case let .success(message) = decodeMessage(Data(json.utf8)),
              case let .hello(id, reId, deviceId, deviceName, appVersion) = message else {
            return XCTFail("expected a decoded hello")
        }
        XCTAssertEqual(id, "11111111-1111-1111-1111-111111111111")
        XCTAssertNil(reId)
        XCTAssertEqual(deviceId, "dev")
        XCTAssertEqual(deviceName, "phone")
        XCTAssertEqual(appVersion, "0.0.0")
    }

    func testHelloAckEncodesWithLowercaseUuidAndReId() throws {
        let message = Message.helloAck(
            id: newMessageId(), reId: "abc",
            helperName: HelperConfig.name, helperVersion: HelperConfig.version,
            capabilities: HelperConfig.capabilities, paired: false
        )
        let data = try encodeMessage(message)
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(object["v"] as? Int, 1)
        XCTAssertEqual(object["type"] as? String, "hello_ack")
        XCTAssertEqual(object["reId"] as? String, "abc")
        let id = try XCTUnwrap(object["id"] as? String)
        XCTAssertEqual(id, id.lowercased())
    }
}
