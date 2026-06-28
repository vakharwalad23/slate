import Foundation

enum HelperConfig {
    // The Mac's computer name (so the phone shows "<name>'s MacBook" in the list), or a static fallback.
    static let name = Host.current().localizedName ?? "slate helper"
    static let version = "0.1.0"
    static let port: UInt16 = 8765
    static let serviceType = "_slate._tcp"

    // Flags are true only where the executor/responders actually wire the action; the app greys out the rest.
    // Computed: runShell mirrors the opt-in toggle. Captured into HelperServices at startup, so flipping
    // the toggle reflects in the app editor after the helper restarts; execution is gated live regardless.
    static var capabilities: Capabilities {
        Capabilities(
            launchApps: true,
            runShortcuts: true,
            runShell: Settings.allowShell,
            keystrokes: PermissionProbe.accessibilityGranted(),
            appList: true,
            appIcons: true,
            liveState: true
        )
    }
}
