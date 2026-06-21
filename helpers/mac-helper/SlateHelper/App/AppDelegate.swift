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
    private var services: HelperServices?
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
        status.refreshLoginItem()
        status.port = Settings.port
        status.onChangePort = { [weak self] newPort in await self?.startServer(on: newPort) }
        Task { await status.refreshDevices() }

        services = HelperServices(
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
            onDevicesChanged: { Task { @MainActor in await status.refreshDevices() } },
            onLog: { isError, message in
                Task { @MainActor in
                    if isError { status.log.error(message) } else { status.log.warn(message) }
                }
            }
        )
        startServer(on: Settings.port)
    }

    // (Re)start the listener on a port and re-advertise Bonjour there; used at launch and on a port change.
    private func startServer(on port: UInt16) {
        guard let services else { return }
        server?.stop()
        bonjour.unregister()
        let status = self.status
        let server = WebSocketServer(port: port, host: "", registry: registry, services: services) { state in
            Task { @MainActor in
                if state == "running" {
                    status.serverRunning = true
                } else if state.hasPrefix("error") {
                    status.lastError = state
                    status.log.error(state)
                }
            }
        }
        do {
            try server.start()
            self.server = server
            try bonjour.register(
                serviceType: HelperConfig.serviceType,
                port: port,
                txt: ["protocol": String(PROTOCOL_VERSION)]
            )
        } catch {
            status.lastError = "\(error)"
            status.log.error("\(error)")
        }
    }
}
