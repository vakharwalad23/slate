import AppKit
import os

private let logger = Logger(subsystem: "com.slate.helper", category: "helper")

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let status = AppStatus()
    private let tokenStore = TokenStore()
    private let pairing = PairingService()
    private let catalog = AppCatalog()
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
        let status = self.status
        status.tokenStore = tokenStore
        let registry = self.registry
        status.onRevoke = { deviceId in await registry.closeIfDevice(deviceId) }
        status.boundHost = LocalAddress.primaryIPv4() ?? "0.0.0.0"
        status.refreshAccessibility()
        Task { await status.refreshDevices() }

        let services = HelperServices(
            tokenStore: tokenStore,
            pairing: pairing,
            catalog: catalog,
            executor: CommandExecutor(),
            capabilities: HelperConfig.capabilities,
            helperName: HelperConfig.name,
            helperVersion: HelperConfig.version,
            onPairingCode: { code in
                if let code { logger.notice("pairing code: \(code, privacy: .public)") }
                Task { @MainActor in status.pairingCode = code }
            },
            onDevicesChanged: { Task { @MainActor in await status.refreshDevices() } }
        )

        let server = WebSocketServer(
            port: HelperConfig.port,
            host: "",
            registry: registry,
            services: services
        ) { state in
            Task { @MainActor in
                if state == "running" {
                    status.serverRunning = true
                } else if state.hasPrefix("error") {
                    status.lastError = state
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
