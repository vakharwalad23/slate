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
        case let .media(action):
            return await media(action)
        case let .keystroke(key, modifiers):
            return await keystroke(key: key, modifiers: modifiers)
        case let .space(direction):
            // Mission Control "move left/right a space" - the user must keep those shortcuts enabled.
            return await keystroke(key: direction == "next" ? "right" : "left", modifiers: ["control"])
        case let .unknown(kind):
            return CommandOutcome(ok: false, error: "not implemented: \(kind)")
        }
    }

    // Volume needs no permission (osascript); transport keys post HID events, which require Accessibility.
    private func media(_ action: String) async -> CommandOutcome {
        switch action {
        case "volume_up":
            return await runProcess("/usr/bin/osascript", ["-e", volumeScript(by: 10)])
        case "volume_down":
            return await runProcess("/usr/bin/osascript", ["-e", volumeScript(by: -10)])
        case "mute":
            return await runProcess(
                "/usr/bin/osascript",
                ["-e", "set volume output muted (not (output muted of (get volume settings)))"]
            )
        case "playpause": return await postMediaKey(16)
        case "next": return await postMediaKey(17)
        case "prev": return await postMediaKey(18)
        default:
            return CommandOutcome(ok: false, error: "unknown media action: \(action)")
        }
    }

    // `set volume output volume` clamps to 0-100, so an over/underflow needs no explicit bounds here.
    private func volumeScript(by delta: Int) -> String {
        "set volume output volume ((output volume of (get volume settings)) + \(delta))"
    }

    @MainActor
    private func keystroke(key: String, modifiers: [String]) -> CommandOutcome {
        guard PermissionProbe.accessibilityGranted() else {
            return CommandOutcome(ok: false, error: PermissionProbe.notGrantedMessage)
        }
        guard let code = KeyTokens.code(for: key) else {
            return CommandOutcome(ok: false, error: "unknown key: \(key)")
        }
        let source = CGEventSource(stateID: .hidSystemState)
        guard let down = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true),
              let up = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false) else {
            return CommandOutcome(ok: false, error: "failed to synthesize keystroke")
        }
        let flags = cgFlags(modifiers)
        down.flags = flags
        up.flags = flags
        down.post(tap: .cghidEventTap)
        up.post(tap: .cghidEventTap)
        return CommandOutcome(ok: true, error: nil)
    }

    private func cgFlags(_ modifiers: [String]) -> CGEventFlags {
        var flags: CGEventFlags = []
        for modifier in modifiers {
            switch modifier {
            case "cmd": flags.insert(.maskCommand)
            case "shift": flags.insert(.maskShift)
            case "option": flags.insert(.maskAlternate)
            case "control": flags.insert(.maskControl)
            default: break
            }
        }
        return flags
    }

    // NX_KEYTYPE_* media keys are NSSystemDefined events with subtype 8; data1 packs keycode + up/down.
    @MainActor
    private func postMediaKey(_ keyCode: Int) -> CommandOutcome {
        guard PermissionProbe.accessibilityGranted() else {
            return CommandOutcome(ok: false, error: PermissionProbe.notGrantedMessage)
        }
        for down in [true, false] {
            let flags = NSEvent.ModifierFlags(rawValue: UInt(down ? 0xA00 : 0xB00))
            let data1 = (keyCode << 16) | ((down ? 0xA : 0xB) << 8)
            guard let event = NSEvent.otherEvent(
                with: .systemDefined, location: .zero, modifierFlags: flags,
                timestamp: 0, windowNumber: 0, context: nil, subtype: 8, data1: data1, data2: -1
            ) else {
                return CommandOutcome(ok: false, error: "failed to synthesize media key")
            }
            event.cgEvent?.post(tap: .cghidEventTap)
        }
        return CommandOutcome(ok: true, error: nil)
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
