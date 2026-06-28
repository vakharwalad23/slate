import Foundation

// Persisted helper settings. The port falls back to HelperConfig.port when unset/invalid.
enum Settings {
    private static let portKey = "slate.port"
    private static let allowShellKey = "slate.allowShell"

    static var port: UInt16 {
        get {
            let value = UserDefaults.standard.integer(forKey: portKey)
            return (1 ... 65535).contains(value) ? UInt16(value) : HelperConfig.port
        }
        set { UserDefaults.standard.set(Int(newValue), forKey: portKey) }
    }

    // Off by default: run_shell executes arbitrary commands, so it is opt-in and read live at execute time.
    static var allowShell: Bool {
        get { UserDefaults.standard.bool(forKey: allowShellKey) }
        set { UserDefaults.standard.set(newValue, forKey: allowShellKey) }
    }
}
