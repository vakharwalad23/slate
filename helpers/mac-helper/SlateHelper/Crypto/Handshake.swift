import CryptoKit
import Foundation

// Mirror of packages/protocol/src/crypto/handshake.ts (responder side). The helper is always the
// pairing responder; the phone is the initiator. The transcript is pinned by crypto-vectors.json.
private let protocolLabel = "slate/sec/v2/x25519-hkdf-sha256-chacha20poly1305"
private let kdfInfoMix = "slate/v2/mix"
private let kdfInfoSplit = "slate/v2/split"

struct RecordKeys {
    let sendKey: Data
    let recvKey: Data
}

struct KeyPair {
    let secretKey: Data
    let publicKey: Data
}

private final class SymmetricState {
    private(set) var h: Data
    private var ck: Data
    private var k: Data?
    private var n: UInt64 = 0

    init() {
        let seed = Data(SHA256.hash(data: Data(protocolLabel.utf8)))
        h = seed
        ck = seed
    }

    func mixHash(_ data: Data) {
        h = Data(SHA256.hash(data: h + data))
    }

    func mixKey(_ ikm: Data) {
        let okm = CryptoPrimitives.hkdf(ikm: ikm, salt: ck, info: Data(kdfInfoMix.utf8), length: 64)
        ck = Data(okm.prefix(32))
        k = Data(okm.suffix(32))
        n = 0
    }

    func encryptAndHash(_ plaintext: Data) throws -> Data {
        guard let k else { throw SecureChannelError.badHandshake }
        let ct = try CryptoPrimitives.aeadSeal(key: k, nonce: CryptoPrimitives.nonce(counter: n), aad: h, plaintext: plaintext)
        n += 1
        mixHash(ct)
        return ct
    }

    func decryptAndHash(_ ciphertext: Data) throws -> Data {
        guard let k else { throw SecureChannelError.badHandshake }
        let pt = try CryptoPrimitives.aeadOpen(key: k, nonce: CryptoPrimitives.nonce(counter: n), aad: h, ciphertext: ciphertext)
        n += 1
        mixHash(ciphertext)
        return pt
    }

    // c2s = okm[0:32] (phone->helper), s2c = okm[32:64]; the responder sends s2c, receives c2s.
    func split() -> RecordKeys {
        let okm = CryptoPrimitives.hkdf(ikm: Data(), salt: ck, info: Data(kdfInfoSplit.utf8), length: 64)
        return RecordKeys(sendKey: Data(okm.suffix(32)), recvKey: Data(okm.prefix(32)))
    }
}

final class PairResponder {
    private let ss = SymmetricState()
    private let ephemeral: KeyPair
    private let staticKey: KeyPair
    private let secret: Data

    init(ephemeral: KeyPair, staticKey: KeyPair, secret: Data) {
        self.ephemeral = ephemeral
        self.staticKey = staticKey
        self.secret = secret
        ss.mixHash(Data("pair".utf8))
    }

    // Nothing psk-keyed is emitted here: s is sealed under the ee key before the psk is mixed in.
    func respond(helloE: Data) throws -> (e: Data, s: Data) {
        ss.mixHash(helloE)
        ss.mixHash(ephemeral.publicKey)
        ss.mixKey(try CryptoPrimitives.dh(secretKey: ephemeral.secretKey, publicKey: helloE))
        let s = try ss.encryptAndHash(staticKey.publicKey)
        ss.mixKey(try CryptoPrimitives.dh(secretKey: staticKey.secretKey, publicKey: helloE))
        ss.mixKey(CryptoPrimitives.derivePsk(secret: secret))
        return (ephemeral.publicKey, s)
    }

    // A failed open == wrong pairing code; the transcript is left untouched so the session can reset.
    func confirm(confirmD: Data) -> Bool {
        (try? ss.decryptAndHash(confirmD)) != nil
    }

    // token is always base64url (TokenStore), so this JSON is byte-identical to the phone's
    // JSON.stringify({ token }) - the confirm_ack ciphertext matches the shared vector.
    func complete(token: String) throws -> (confirmAck: Data, keys: RecordKeys) {
        let json = Data("{\"token\":\"\(token)\"}".utf8)
        let confirmAck = try ss.encryptAndHash(json)
        return (confirmAck, ss.split())
    }
}
