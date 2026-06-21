import Foundation
import Observation

@MainActor
@Observable
final class AppStatus {
    var serverRunning = false
    var boundHost = ""
    var lastError: String?
    var pairingCode: String?
    var pairedDevices: [PairedDevice] = []
    var accessibilityTrusted = false
    var openAtLogin = false
    var port: UInt16 = HelperConfig.port

    @ObservationIgnored var tokenStore: TokenStore?
    // Force-drops the live connection for a revoked device; wired to the registry in AppDelegate.
    @ObservationIgnored var onRevoke: (@Sendable (String) async -> Void)?
    // Restarts the listener on a new port; wired in AppDelegate.
    @ObservationIgnored var onChangePort: (@Sendable (UInt16) async -> Void)?

    func refreshDevices() async {
        guard let tokenStore else { return }
        pairedDevices = await tokenStore.all()
    }

    func revoke(_ deviceId: String) async {
        guard let tokenStore else { return }
        await tokenStore.revoke(deviceId: deviceId)
        await onRevoke?(deviceId)
        pairedDevices = await tokenStore.all()
    }

    func refreshAccessibility() {
        accessibilityTrusted = PermissionProbe.accessibilityTrusted(prompt: false)
    }

    func refreshLoginItem() {
        openAtLogin = LoginItem.isEnabled()
    }

    func applyPort(_ newPort: UInt16) {
        Settings.port = newPort
        port = newPort
        let action = onChangePort
        Task { await action?(newPort) }
    }

    func setOpenAtLogin(_ enabled: Bool) {
        do {
            try LoginItem.set(enabled)
        } catch {
            lastError = "login item: \(error.localizedDescription)"
        }
        openAtLogin = LoginItem.isEnabled()
    }

    func promptAccessibility() {
        _ = PermissionProbe.accessibilityTrusted(prompt: true)
    }
}
