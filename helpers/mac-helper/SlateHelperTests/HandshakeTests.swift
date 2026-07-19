import Foundation
import XCTest
@testable import SlateHelper

// Drives the Swift responder through the shared pair-handshake vector (generated from the TS
// initiator/responder). A mismatch means the phone and helper would fail to complete a real pairing.
final class HandshakeTests: XCTestCase {
    private struct Root: Decodable { let handshakePair: HandshakeVector }
    private struct HandshakeVector: Decodable {
        let ephemeralInitiator, ephemeralResponder, staticResponder, staticResponderPublic, secret, token: String
        let hello, ackE, ackS, confirm, confirmAck: String
        let initiatorSendKey, initiatorRecvKey, responderSendKey, responderRecvKey: String
    }

    private func load() throws -> HandshakeVector {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "packages/protocol/fixtures/crypto-vectors.json")
        return try JSONDecoder().decode(Root.self, from: Data(contentsOf: url)).handshakePair
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

    private func makeResponder(_ v: HandshakeVector) throws -> PairResponder {
        PairResponder(
            ephemeral: KeyPair(
                secretKey: try hex(v.ephemeralResponder),
                publicKey: try CryptoPrimitives.x25519PublicKey(secretKey: try hex(v.ephemeralResponder))
            ),
            staticKey: KeyPair(secretKey: try hex(v.staticResponder), publicKey: try hex(v.staticResponderPublic)),
            secret: try hex(v.secret)
        )
    }

    func testResponderReproducesVector() throws {
        let v = try load()
        let responder = try makeResponder(v)
        let ack = try responder.respond(helloE: try hex(v.hello))
        XCTAssertEqual(hexString(ack.e), v.ackE)
        XCTAssertEqual(hexString(ack.s), v.ackS)
        XCTAssertTrue(responder.confirm(confirmD: try hex(v.confirm)))
        let complete = try responder.complete(token: v.token)
        XCTAssertEqual(hexString(complete.confirmAck), v.confirmAck)
        XCTAssertEqual(hexString(complete.keys.sendKey), v.responderSendKey)
        XCTAssertEqual(hexString(complete.keys.recvKey), v.responderRecvKey)
    }

    func testInitiatorReproducesVector() throws {
        let v = try load()
        let initiator = PairInitiator(ephemeral: KeyPair(
            secretKey: try hex(v.ephemeralInitiator),
            publicKey: try CryptoPrimitives.x25519PublicKey(secretKey: try hex(v.ephemeralInitiator))
        ))
        XCTAssertEqual(hexString(initiator.hello()), v.hello)
        let confirm = try initiator.consumeAck(ackE: try hex(v.ackE), ackS: try hex(v.ackS), secret: try hex(v.secret))
        XCTAssertEqual(hexString(confirm), v.confirm)
        let result = try initiator.finish(confirmAckD: try hex(v.confirmAck))
        XCTAssertEqual(result.token, v.token)
        XCTAssertEqual(hexString(result.helperStaticPub), v.staticResponderPublic)
        XCTAssertEqual(hexString(result.keys.sendKey), v.initiatorSendKey)
        XCTAssertEqual(hexString(result.keys.recvKey), v.initiatorRecvKey)
    }

    func testResponderRejectsTamperedConfirm() throws {
        let v = try load()
        let responder = try makeResponder(v)
        _ = try responder.respond(helloE: try hex(v.hello))
        var confirm = try hex(v.confirm)
        confirm[confirm.startIndex] ^= 1
        XCTAssertFalse(responder.confirm(confirmD: confirm))
    }
}
