import CryptoKit
import Foundation

// Any throw of this from the crypto layer is a hard failure: the caller closes the connection.
enum SecureChannelError: Error {
    case aeadOpenFailed
    case badPublicKey
    case badKey
    case nonceOverflow
    case badHandshake
    case badFrame
}

// CryptoKit mirror of packages/protocol/src/crypto/primitives.ts. The shared crypto-vectors.json
// pins these byte-for-byte against noble; the framing choices here (ct||tag, never SealedBox.combined;
// 4-zeros||LE64 counter nonce) are the interop contract.
enum CryptoPrimitives {
    static let aeadKeyLen = 32
    static let aeadTagLen = 16
    static let aeadNonceLen = 12
    static let x25519KeyLen = 32
    static let hashLen = 32
    static let pskSalt = "slate/psk/v2"

    static func hkdf(ikm: Data, salt: Data, info: Data, length: Int) -> Data {
        let derived = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: SymmetricKey(data: ikm),
            salt: salt,
            info: info,
            outputByteCount: length
        )
        return derived.withUnsafeBytes { Data($0) }
    }

    // Nonce = 4 zero bytes || 64-bit little-endian counter. Never random, never on the wire.
    static func nonce(counter: UInt64) -> Data {
        var nonce = Data(count: aeadNonceLen)
        var value = counter
        for i in 4..<aeadNonceLen {
            nonce[i] = UInt8(value & 0xff)
            value >>= 8
        }
        return nonce
    }

    // Returns ciphertext||tag; the nonce stays off the wire so both sides derive it from counters.
    static func aeadSeal(key: Data, nonce: Data, aad: Data, plaintext: Data) throws -> Data {
        let box = try ChaChaPoly.seal(
            plaintext,
            using: SymmetricKey(data: key),
            nonce: ChaChaPoly.Nonce(data: nonce),
            authenticating: aad
        )
        var out = Data(box.ciphertext)
        out.append(box.tag)
        return out
    }

    static func aeadOpen(key: Data, nonce: Data, aad: Data, ciphertext: Data) throws -> Data {
        guard ciphertext.count >= aeadTagLen else { throw SecureChannelError.aeadOpenFailed }
        let ct = Data(ciphertext.prefix(ciphertext.count - aeadTagLen))
        let tag = Data(ciphertext.suffix(aeadTagLen))
        do {
            let box = try ChaChaPoly.SealedBox(nonce: ChaChaPoly.Nonce(data: nonce), ciphertext: ct, tag: tag)
            return try ChaChaPoly.open(box, using: SymmetricKey(data: key), authenticating: aad)
        } catch {
            throw SecureChannelError.aeadOpenFailed
        }
    }

    static func x25519PublicKey(secretKey: Data) throws -> Data {
        do {
            return try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: secretKey).publicKey.rawRepresentation
        } catch {
            throw SecureChannelError.badKey
        }
    }

    static func generateKeyPair() -> (secretKey: Data, publicKey: Data) {
        let priv = Curve25519.KeyAgreement.PrivateKey()
        return (priv.rawRepresentation, priv.publicKey.rawRepresentation)
    }

    // CryptoKit does not reject low-order points on its own, so re-check the all-zero shared secret
    // to mirror noble (which throws). Keeps a contributory guard on both sides.
    static func dh(secretKey: Data, publicKey: Data) throws -> Data {
        let priv: Curve25519.KeyAgreement.PrivateKey
        let pub: Curve25519.KeyAgreement.PublicKey
        do {
            priv = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: secretKey)
            pub = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: publicKey)
        } catch {
            throw SecureChannelError.badPublicKey
        }
        let shared: SymmetricKey
        do {
            shared = try priv.sharedSecretFromKeyAgreement(with: pub).withUnsafeBytes { SymmetricKey(data: $0) }
        } catch {
            throw SecureChannelError.badPublicKey
        }
        let bytes = shared.withUnsafeBytes { Data($0) }
        if bytes.allSatisfy({ $0 == 0 }) { throw SecureChannelError.badPublicKey }
        return bytes
    }

    static func derivePsk(secret: Data) -> Data {
        hkdf(ikm: secret, salt: Data(pskSalt.utf8), info: Data(), length: aeadKeyLen)
    }
}
