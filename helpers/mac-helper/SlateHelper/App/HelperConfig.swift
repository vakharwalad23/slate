import Foundation

enum HelperConfig {
    // The Mac's computer name (so the phone shows "<name>'s MacBook" in the list), or a static fallback.
    static let name = Host.current().localizedName ?? "slate helper"
    static let version = "0.1.0"
    static let port: UInt16 = 8765
    static let serviceType = "_slate._tcp"

    // Flags are true only where the executor/responders actually wire the action; the app greys out the rest.
    static let capabilities = Capabilities(
        launchApps: true,
        runShortcuts: true,
        runShell: false,
        keystrokes: false,
        appList: true,
        appIcons: true,
        liveState: false
    )
}
