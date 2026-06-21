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

    init(runner: ProcessRunning = SystemProcessRunner(), activator: AppActivator = AppActivator()) {
        self.runner = runner
        self.activator = activator
    }

    func execute(_ command: Command) async -> CommandOutcome {
        switch command {
        case let .launchApp(app):
            return await launch(app)
        case let .activateApp(bundleId):
            return await activator.activate(bundleId: bundleId)
        case let .runShortcut(name, _):
            // input piping is not wired yet; the shortcut runs without stdin.
            return await runProcess("/usr/bin/shortcuts", ["run", name])
        case let .runApplescript(script):
            return await runProcess("/usr/bin/osascript", ["-e", script])
        case .runShell:
            return CommandOutcome(ok: false, error: "not implemented: run_shell")
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

    private func runProcess(_ path: String, _ args: [String]) async -> CommandOutcome {
        do {
            try await runner.run(path, args)
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
