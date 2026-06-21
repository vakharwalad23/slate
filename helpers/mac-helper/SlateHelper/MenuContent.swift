import SwiftUI

struct MenuContent: View {
    let status: AppStatus

    var body: some View {
        if status.serverRunning {
            Text("Listening on port \(HelperConfig.port)")
            Text("Address: \(status.boundHost)")
        } else {
            Text("Starting...")
        }
        if let error = status.lastError {
            Text("Error: \(error)")
        }
        Divider()
        Button("Quit slate helper") { NSApplication.shared.terminate(nil) }
    }
}
