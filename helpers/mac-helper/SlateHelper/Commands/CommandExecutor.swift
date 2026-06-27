import AppKit
import Foundation

struct CommandOutcome: Sendable, Equatable {
    let ok: Bool
    let error: String?
}

protocol CommandExecuting: Sendable {
    func execute(_ command: Command) async -> CommandOutcome
}

struct CommandExecutor: CommandExecuting {
    let runner: ProcessRunning
    let activator: AppActivator
    // Read live at execute time so toggling the opt-in takes effect without a reconnect.
    let shellEnabled: @Sendable () -> Bool

    init(
        runner: ProcessRunning = SystemProcessRunner(),
        activator: AppActivator = AppActivator(),
        shellEnabled: @escaping @Sendable () -> Bool = { Settings.allowShell }
    ) {
        self.runner = runner
        self.activator = activator
        self.shellEnabled = shellEnabled
    }

    func execute(_ command: Command) async -> CommandOutcome {
        switch command {
        case let .launchApp(app):
            return await launch(app)
        case let .activateApp(bundleId):
            return await activator.activate(bundleId: bundleId)
        case let .quitApp(bundleId):
            return await quit(bundleId)
        case let .runShortcut(name, input):
            // input is piped to `shortcuts run` stdin; the Shortcut must start with a "Receive input" step.
            return await runProcess("/usr/bin/shortcuts", ["run", name], stdin: input)
        case let .runApplescript(script):
            return await runProcess("/usr/bin/osascript", ["-e", script])
        case let .runShell(script):
            guard shellEnabled() else {
                return CommandOutcome(ok: false, error: "shell commands are disabled; enable them in the slate helper menu")
            }
            return await runProcess("/bin/sh", ["-c", script])
        case let .unknown(kind):
            return CommandOutcome(ok: false, error: "not implemented: \(kind)")
        }
    }

    // open -a matches the Node helper's proven path; bundle ids (contain a dot) retry with -b.
    private func launch(_ app: String) async -> CommandOutcome {
        do {
            try await runner.run("/usr/bin/open", ["-a", app])
            return CommandOutcome(ok: true, error: nil)
        } catch {
            if app.contains(".") {
                do {
                    try await runner.run("/usr/bin/open", ["-b", app])
                    return CommandOutcome(ok: true, error: nil)
                } catch {
                    return CommandOutcome(ok: false, error: describe(error))
                }
            }
            return CommandOutcome(ok: false, error: describe(error))
        }
    }

    // Idempotent: an already-quit app is the desired end state, so report success rather than an error.
    @MainActor
    private func quit(_ bundleId: String) -> CommandOutcome {
        let running = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId)
        for app in running { app.terminate() }
        return CommandOutcome(ok: true, error: nil)
    }

    private func runProcess(_ path: String, _ args: [String], stdin: String? = nil) async -> CommandOutcome {
        do {
            try await runner.run(path, args, stdin: stdin)
            return CommandOutcome(ok: true, error: nil)
        } catch {
            return CommandOutcome(ok: false, error: describe(error))
        }
    }

    private func describe(_ error: Error) -> String {
        if let runError = error as? ProcessRunError { return runError.description }
        return error.localizedDescription
    }
}
