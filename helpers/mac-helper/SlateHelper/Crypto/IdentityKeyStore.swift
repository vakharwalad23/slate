import CryptoKit
import Foundation

// The helper's long-term Curve25519 identity, pinned by the phone at pairing. Stored as a 0600 JSON
// file next to devices.json, NOT Keychain: ad-hoc signing churns the app's cdhash on every rebuild,
// which breaks Keychain ACLs - the same file-vs-Keychain rationale TokenStore documents. Deleting
// identity.json rotates the identity, which every paired phone then sees as a changed key (re-pair).
struct IdentityKeyStore: Sendable {
    let identity: KeyPair

    init(directory: URL? = nil) {
        let base = directory ?? FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appending(path: "slate-helper")
        let fileURL = base.appending(path: "identity.json")
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        identity = IdentityKeyStore.loadOrCreate(from: fileURL)
    }

    private static func loadOrCreate(from url: URL) -> KeyPair {
        if let data = try? Data(contentsOf: url),
           let stored = try? JSONDecoder().decode(StoredIdentity.self, from: data),
           let secret = Data(base64Encoded: stored.privateKey),
           let priv = try? Curve25519.KeyAgreement.PrivateKey(rawRepresentation: secret) {
            return KeyPair(secretKey: priv.rawRepresentation, publicKey: priv.publicKey.rawRepresentation)
        }
        let priv = Curve25519.KeyAgreement.PrivateKey()
        let stored = StoredIdentity(privateKey: priv.rawRepresentation.base64EncodedString())
        if let data = try? JSONEncoder().encode(stored) {
            try? data.write(to: url, options: [.atomic])
            try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
        }
        return KeyPair(secretKey: priv.rawRepresentation, publicKey: priv.publicKey.rawRepresentation)
    }
}

private struct StoredIdentity: Codable { let privateKey: String }
