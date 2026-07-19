import Foundation
import Security

// Pairing security: a single short-lived high-entropy secret (120 bits). It is displayed as a QR and
// a base64url code, and mixed into the handshake as the psk - the crypto, not this service, checks it
// (a wrong code fails to decrypt). The failure counter + lockout live at ACTOR scope (not the
// per-request session), so spamming pair_request cannot reset them; a fresh pair_request reuses the
// active unexpired secret instead of rerolling. After lockThreshold wrong confirms the service locks
// for an exponentially growing window.
actor PairingService {
    enum ConfirmOutcome: Equatable { case badCode, locked }
    enum SessionState: Equatable {
        case active(secret: Data, expiresAt: Date)
        case locked
        case none
    }
    enum BeginResult: Equatable {
        case code(String, expiresAt: Date)
        case locked(retryAfter: TimeInterval)
    }

    private struct Session {
        let secret: Data
        let expiresAt: Date
    }

    private var active: Session?
    private var totalFailures = 0
    private var lockedUntil: Date?
    private var lockoutLevel = 0

    private let ttl: TimeInterval
    private let lockThreshold: Int
    private let baseLockout: TimeInterval
    private let maxLockout: TimeInterval
    private let makeSecret: @Sendable () -> Data

    init(
        ttl: TimeInterval = 120,
        lockThreshold: Int = 5,
        baseLockout: TimeInterval = 30,
        maxLockout: TimeInterval = 300,
        makeSecret: (@Sendable () -> Data)? = nil
    ) {
        self.ttl = ttl
        self.lockThreshold = lockThreshold
        self.baseLockout = baseLockout
        self.maxLockout = maxLockout
        self.makeSecret = makeSecret ?? { PairingService.randomSecret() }
    }

    // The display/QR code is base64url of the raw secret; the handshake uses the raw bytes.
    static func displayCode(_ secret: Data) -> String {
        secret.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    func beginPairing(now: Date = Date()) -> BeginResult {
        if let until = lockedUntil, now < until {
            return .locked(retryAfter: until.timeIntervalSince(now))
        }
        if let session = active, now < session.expiresAt {
            return .code(Self.displayCode(session.secret), expiresAt: session.expiresAt)
        }
        let secret = makeSecret()
        let expiresAt = now.addingTimeInterval(ttl)
        active = Session(secret: secret, expiresAt: expiresAt)
        return .code(Self.displayCode(secret), expiresAt: expiresAt)
    }

    // Snapshotted by the session at sec_hello so a mid-handshake code regeneration cannot false-strike.
    func sessionState(now: Date = Date()) -> SessionState {
        if let until = lockedUntil, now < until { return .locked }
        guard let session = active, now < session.expiresAt else { return .none }
        return .active(secret: session.secret, expiresAt: session.expiresAt)
    }

    // Called when the AEAD confirm fails (wrong code).
    func recordFailure(now: Date = Date()) -> ConfirmOutcome {
        if let until = lockedUntil {
            if now < until { return .locked }
            lockedUntil = nil
        }
        totalFailures += 1
        if totalFailures >= lockThreshold {
            lockoutLevel += 1
            let window = min(baseLockout * pow(2, Double(lockoutLevel - 1)), maxLockout)
            lockedUntil = now.addingTimeInterval(window)
            active = nil
            totalFailures = 0
            return .locked
        }
        return .badCode
    }

    func recordSuccess() {
        active = nil
        totalFailures = 0
        lockoutLevel = 0
    }

    private static func randomSecret() -> Data {
        var bytes = [UInt8](repeating: 0, count: 15)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes)
    }
}
