import Foundation

// Shared, connection-independent dependencies wired once at app start and handed to each ClientSession.
struct HelperServices: Sendable {
    let tokenStore: TokenStore
    let pairing: PairingService
    let catalog: AppCatalog
    let executor: CommandExecuting
    let capabilities: Capabilities
    let helperName: String
    let helperVersion: String
    let onPairingCode: @Sendable (_ code: String?, _ expiresAt: Date?) -> Void
    let onDevicesChanged: @Sendable () -> Void
    let onLog: @Sendable (_ isError: Bool, _ message: String) -> Void
}
