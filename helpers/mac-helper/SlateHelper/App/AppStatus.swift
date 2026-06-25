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

    @ObservationIgnored var tokenStore: TokenStore?

    func refreshDevices() async {
        guard let tokenStore else { return }
        pairedDevices = await tokenStore.all()
    }

    func revoke(_ deviceId: String) async {
        guard let tokenStore else { return }
        await tokenStore.revoke(deviceId: deviceId)
        pairedDevices = await tokenStore.all()
    }

    func refreshAccessibility() {
        accessibilityTrusted = PermissionProbe.accessibilityTrusted(prompt: false)
    }

    func promptAccessibility() {
        _ = PermissionProbe.accessibilityTrusted(prompt: true)
    }
}
