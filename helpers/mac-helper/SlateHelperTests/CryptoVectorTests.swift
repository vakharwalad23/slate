import Foundation
import XCTest
@testable import SlateHelper

// Pins CryptoKit byte-for-byte against the shared crypto-vectors.json (generated from noble). If
// CryptoKit and noble ever diverge on framing, nonce layout, or a primitive, this fails - the phone
// and helper would otherwise silently fail to decrypt each other.
final class CryptoVectorTests: XCTestCase {
    private struct Vectors: Decodable {
        struct Hkdf: Decodable {
            let name, ikm, salt, info: String
            let length: Int
            let okm: String
        }
        struct Psk: Decodable { let name, secret, psk: String }
        struct Aead: Decodable {
            let name, key, nonce, aad, plaintext, ciphertext: String
            let counter: String?
        }
        struct X: Decodable { let name, secretKey, peerPublicKey, publicKey, shared: String }
        struct Frame: Decodable { let plaintext, sealed: String }
        struct Record: Decodable {
            let name, sendKey, recvKey: String
            let frames: [Frame]
        }
        let hkdf: [Hkdf]
        let psk: [Psk]
        let aead: [Aead]
        let x25519: [X]
        let record: Record
    }

    private func load() throws -> Vectors {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "packages/protocol/fixtures/crypto-vectors.json")
        return try JSONDecoder().decode(Vectors.self, from: Data(contentsOf: url))
    }

    private func hex(_ s: String) throws -> Data {
        var data = Data(capacity: s.count / 2)
        var idx = s.startIndex
        while idx < s.endIndex {
            let next = s.index(idx, offsetBy: 2)
            data.append(try XCTUnwrap(UInt8(s[idx..<next], radix: 16)))
            idx = next
        }
        return data
    }

    private func hexString(_ d: Data) -> String {
        d.map { String(format: "%02x", $0) }.joined()
    }

    func testHkdf() throws {
        for v in try load().hkdf {
            let okm = CryptoPrimitives.hkdf(
                ikm: try hex(v.ikm), salt: try hex(v.salt), info: try hex(v.info), length: v.length
            )
            XCTAssertEqual(hexString(okm), v.okm, v.name)
        }
    }

    func testDerivePsk() throws {
        for v in try load().psk {
            XCTAssertEqual(hexString(CryptoPrimitives.derivePsk(secret: try hex(v.secret))), v.psk, v.name)
        }
    }

    func testAead() throws {
        for v in try load().aead {
            let key = try hex(v.key)
            let nonce = try hex(v.nonce)
            let aad = try hex(v.aad)
            let plaintext = try hex(v.plaintext)
            let sealed = try CryptoPrimitives.aeadSeal(key: key, nonce: nonce, aad: aad, plaintext: plaintext)
            XCTAssertEqual(hexString(sealed), v.ciphertext, v.name)
            let opened = try CryptoPrimitives.aeadOpen(key: key, nonce: nonce, aad: aad, ciphertext: try hex(v.ciphertext))
            XCTAssertEqual(hexString(opened), v.plaintext, v.name)
            if let counter = v.counter {
                XCTAssertEqual(hexString(CryptoPrimitives.nonce(counter: try XCTUnwrap(UInt64(counter)))), v.nonce, v.name)
            }
        }
    }

    func testX25519() throws {
        for v in try load().x25519 {
            XCTAssertEqual(hexString(try CryptoPrimitives.x25519PublicKey(secretKey: try hex(v.secretKey))), v.publicKey, v.name)
            XCTAssertEqual(hexString(try CryptoPrimitives.dh(secretKey: try hex(v.secretKey), publicKey: try hex(v.peerPublicKey))), v.shared, v.name)
        }
    }

    func testRecordLayerMatchesVectorsAndMirrorOpens() throws {
        let vectors = try load().record
        let sealer = try RecordLayer(sendKey: try hex(vectors.sendKey), recvKey: try hex(vectors.recvKey))
        let opener = try RecordLayer(sendKey: try hex(vectors.recvKey), recvKey: try hex(vectors.sendKey))
        for frame in vectors.frames {
            let sealed = try sealer.seal(try hex(frame.plaintext))
            XCTAssertEqual(hexString(sealed), frame.sealed)
            XCTAssertEqual(hexString(try opener.open(sealed)), frame.plaintext)
        }
    }

    func testAeadRejectsTamperedTag() throws {
        let v = try XCTUnwrap(try load().aead.first)
        var ct = try hex(v.ciphertext)
        ct[ct.startIndex] ^= 1
        XCTAssertThrowsError(try CryptoPrimitives.aeadOpen(key: try hex(v.key), nonce: try hex(v.nonce), aad: try hex(v.aad), ciphertext: ct))
    }

    func testRecordRejectsOutOfOrderFrame() throws {
        let vectors = try load().record
        let sealer = try RecordLayer(sendKey: try hex(vectors.sendKey), recvKey: try hex(vectors.recvKey))
        _ = try sealer.seal(Data("a".utf8))
        let second = try sealer.seal(Data("b".utf8))
        let opener = try RecordLayer(sendKey: try hex(vectors.recvKey), recvKey: try hex(vectors.sendKey))
        XCTAssertThrowsError(try opener.open(second))
    }

    func testDhRejectsAllZeroPeerKey() throws {
        let scalar = try hex(try XCTUnwrap(try load().x25519.first).secretKey)
        XCTAssertThrowsError(try CryptoPrimitives.dh(secretKey: scalar, publicKey: Data(count: 32)))
    }
}
