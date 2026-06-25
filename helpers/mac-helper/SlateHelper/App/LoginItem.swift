import ServiceManagement

// Registers the app as a Login Item (auto-opens on login/restart) via SMAppService (macOS 13+).
// The user also sees/controls it under System Settings > General > Login Items.
enum LoginItem {
    static func isEnabled() -> Bool {
        SMAppService.mainApp.status == .enabled
    }

    static func set(_ enabled: Bool) throws {
        if enabled {
            if SMAppService.mainApp.status != .enabled { try SMAppService.mainApp.register() }
        } else if SMAppService.mainApp.status == .enabled {
            try SMAppService.mainApp.unregister()
        }
    }
}
