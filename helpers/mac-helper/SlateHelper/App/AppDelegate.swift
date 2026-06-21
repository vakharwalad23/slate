import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let status = AppStatus()
    private let registry = ConnectionRegistry()
    private let bonjour = BonjourAdvertiser()
    private var server: WebSocketServer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Skip the live server when the app is launched only to host unit tests.
        guard ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil else { return }
        start()
    }

    func applicationWillTerminate(_ notification: Notification) {
        server?.stop()
        bonjour.unregister()
    }

    private func start() {
        status.boundHost = LocalAddress.primaryIPv4() ?? "0.0.0.0"
        let server = WebSocketServer(
            port: HelperConfig.port,
            host: "",
            registry: registry,
            dispatcher: Dispatcher()
        ) { [weak self] state in
            Task { @MainActor in
                guard let self else { return }
                if state == "running" {
                    self.status.serverRunning = true
                } else if state.hasPrefix("error") {
                    self.status.lastError = state
                }
            }
        }
        do {
            try server.start()
            self.server = server
            try bonjour.register(
                serviceType: HelperConfig.serviceType,
                port: HelperConfig.port,
                txt: ["protocol": String(PROTOCOL_VERSION)]
            )
        } catch {
            status.lastError = "\(error)"
        }
    }
}
