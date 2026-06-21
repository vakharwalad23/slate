import SwiftUI

@main
struct SlateHelperApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        MenuBarExtra("slate helper", systemImage: "square.grid.3x2.fill") {
            MenuContent(status: appDelegate.status)
        }
        .menuBarExtraStyle(.menu)
    }
}
