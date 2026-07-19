import Foundation

// Post-handshake transport, mirror of packages/protocol/src/crypto/record.ts: one AEAD message per
// frame, per-direction counter from 0, empty AAD. Any open failure or overflow throws and the caller
// closes the connection - no recovery, no replay window.
final class RecordLayer {
    private let sendKey: Data
    private let recvKey: Data
    private var sendCounter: UInt64 = 0
    private var recvCounter: UInt64 = 0

    init(sendKey: Data, recvKey: Data) throws {
        guard sendKey.count == CryptoPrimitives.aeadKeyLen,
              recvKey.count == CryptoPrimitives.aeadKeyLen else {
            throw SecureChannelError.badKey
        }
        self.sendKey = sendKey
        self.recvKey = recvKey
    }

    func seal(_ plaintext: Data) throws -> Data {
        guard sendCounter != UInt64.max else { throw SecureChannelError.nonceOverflow }
        let ciphertext = try CryptoPrimitives.aeadSeal(
            key: sendKey,
            nonce: CryptoPrimitives.nonce(counter: sendCounter),
            aad: Data(),
            plaintext: plaintext
        )
        sendCounter += 1
        return ciphertext
    }

    func open(_ ciphertext: Data) throws -> Data {
        guard recvCounter != UInt64.max else { throw SecureChannelError.nonceOverflow }
        // Throws before the counter advances, so a rejected frame never desyncs a good one.
        let plaintext = try CryptoPrimitives.aeadOpen(
            key: recvKey,
            nonce: CryptoPrimitives.nonce(counter: recvCounter),
            aad: Data(),
            ciphertext: ciphertext
        )
        recvCounter += 1
        return plaintext
    }
}
