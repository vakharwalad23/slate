import AppKit
import ApplicationServices

// Tahoe (macOS 26) anti-focus-stealing makes a single activate() call unreliable; we gate on
// Accessibility, then activate + verify frontmost with a short retry, and surface a clear error.
struct AppActivator: Sendable {
    @MainActor
    func activate(bundleId: String) async -> CommandOutcome {
        guard AXIsProcessTrusted() else {
            return CommandOutcome(
                ok: false,
                error: "accessibility not granted; enable slate helper in System Settings > Privacy and Security > Accessibility"
            )
        }
        guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else {
            return CommandOutcome(ok: false, error: "app not running: \(bundleId)")
        }
        for _ in 0 ..< 3 {
            app.activate(options: [.activateAllWindows])
            try? await Task.sleep(nanoseconds: 100_000_000)
            if NSWorkspace.shared.frontmostApplication?.bundleIdentifier == bundleId {
                return CommandOutcome(ok: true, error: nil)
            }
        }
        return CommandOutcome(ok: false, error: "focus denied; macOS did not bring \(bundleId) to front")
    }
}
