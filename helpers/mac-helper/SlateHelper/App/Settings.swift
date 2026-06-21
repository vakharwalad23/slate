import Foundation

// Persisted helper settings. The port falls back to HelperConfig.port when unset/invalid.
enum Settings {
    private static let portKey = "slate.port"

    static var port: UInt16 {
        get {
            let value = UserDefaults.standard.integer(forKey: portKey)
            return (1 ... 65535).contains(value) ? UInt16(value) : HelperConfig.port
        }
        set { UserDefaults.standard.set(Int(newValue), forKey: portKey) }
    }
}
