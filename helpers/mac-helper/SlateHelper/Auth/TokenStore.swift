import Foundation
import Security

struct PairedDevice: Codable, Sendable, Identifiable, Equatable {
    let id: String
    var token: String
    var deviceName: String
    var pairedAt: Date
}

// The token is a bearer secret the helper issues and checks against LAN peers, not a user credential
// to hide from the local user; a 0600 JSON map is simpler to enumerate/revoke than Keychain items.
// (The phone stores its copy in expo-secure-store - that asymmetry is intentional.)
actor TokenStore {
    private let fileURL: URL
    private var devices: [String: PairedDevice]

    init(directory: URL? = nil) {
        let base = directory ?? FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appending(path: "slate-helper")
        fileURL = base.appending(path: "devices.json")
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        devices = TokenStore.load(from: fileURL)
    }

    func issue(deviceId: String, deviceName: String) -> String {
        let token = TokenStore.randomToken()
        devices[deviceId] = PairedDevice(id: deviceId, token: token, deviceName: deviceName, pairedAt: Date())
        persist()
        return token
    }

    func validate(token: String) -> String? {
        devices.first { $0.value.token == token }?.key
    }

    func hasDevice(_ deviceId: String) -> Bool { devices[deviceId] != nil }

    func revoke(deviceId: String) {
        devices[deviceId] = nil
        persist()
    }

    func all() -> [PairedDevice] {
        devices.values.sorted { $0.pairedAt < $1.pairedAt }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(devices) else { return }
        try? data.write(to: fileURL, options: [.atomic])
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: fileURL.path)
    }

    private static func randomToken() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func load(from url: URL) -> [String: PairedDevice] {
        guard let data = try? Data(contentsOf: url),
              let map = try? JSONDecoder().decode([String: PairedDevice].self, from: data)
        else { return [:] }
        return map
    }
}
