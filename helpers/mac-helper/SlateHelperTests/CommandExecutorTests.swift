import XCTest
@testable import SlateHelper

private actor CallRecorder {
    private(set) var calls: [(path: String, args: [String], stdin: String?)] = []
    func record(_ path: String, _ args: [String], _ stdin: String?) { calls.append((path, args, stdin)) }
}

private struct FakeRunner: ProcessRunning {
    let recorder: CallRecorder
    let failure: ProcessRunError?

    func run(_ launchPath: String, _ args: [String], stdin: String?) async throws -> String {
        await recorder.record(launchPath, args, stdin)
        if let failure { throw failure }
        return ""
    }
}

final class CommandExecutorTests: XCTestCase {
    func testLaunchAppRunsOpenDashA() async {
        let recorder = CallRecorder()
        let outcome = await CommandExecutor(runner: FakeRunner(recorder: recorder, failure: nil))
            .execute(.launchApp(app: "Safari"))
        XCTAssertTrue(outcome.ok)
        XCTAssertNil(outcome.error)
        let calls = await recorder.calls
        XCTAssertEqual(calls.first?.path, "/usr/bin/open")
        XCTAssertEqual(calls.first?.args, ["-a", "Safari"])
    }

    func testLaunchAppSurfacesFailure() async {
        let outcome = await CommandExecutor(runner: FakeRunner(recorder: CallRecorder(), failure: .nonZeroExit(status: 1, message: "no such app")))
            .execute(.launchApp(app: "Safari"))
        XCTAssertFalse(outcome.ok)
        XCTAssertEqual(outcome.error, "no such app")
    }

    func testRunShortcutPipesInputToStdin() async {
        let recorder = CallRecorder()
        let outcome = await CommandExecutor(runner: FakeRunner(recorder: recorder, failure: nil))
            .execute(.runShortcut(name: "My Shortcut", input: "hello"))
        XCTAssertTrue(outcome.ok)
        let calls = await recorder.calls
        XCTAssertEqual(calls.first?.path, "/usr/bin/shortcuts")
        XCTAssertEqual(calls.first?.args, ["run", "My Shortcut"])
        XCTAssertEqual(calls.first?.stdin, "hello")
    }

    func testRunShellNotImplemented() async {
        let outcome = await CommandExecutor(runner: FakeRunner(recorder: CallRecorder(), failure: nil))
            .execute(.runShell(script: "echo hi"))
        XCTAssertFalse(outcome.ok)
        XCTAssertEqual(outcome.error, "not implemented: run_shell")
    }
}
