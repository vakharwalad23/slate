import Foundation

enum HelperConfig {
    static let name = "slate helper"
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
