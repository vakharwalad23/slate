import Foundation

// Pairing security: a single short-lived 6-digit code (display-only; the durable secret is the issued
// token). The failure counter + lockout live at ACTOR scope (not inside the per-request session), so
// spamming pair_request cannot reset them; a fresh pair_request reuses the active unexpired code instead
// of rerolling. After lockThreshold wrong confirms the service locks for an exponentially growing window.
actor PairingService {
    enum ConfirmResult: Equatable { case ok, badCode, expired, locked }
    enum BeginResult: Equatable {
        case code(String, expiresAt: Date)
        case locked(retryAfter: TimeInterval)
    }

    private struct Session {
        let code: String
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
    private let makeCode: @Sendable () -> String

    init(
        ttl: TimeInterval = 120,
        lockThreshold: Int = 5,
        baseLockout: TimeInterval = 30,
        maxLockout: TimeInterval = 300,
        makeCode: (@Sendable () -> String)? = nil
    ) {
        self.ttl = ttl
        self.lockThreshold = lockThreshold
        self.baseLockout = baseLockout
        self.maxLockout = maxLockout
        self.makeCode = makeCode ?? { String(format: "%06d", Int.random(in: 0 ... 999_999)) }
    }

    func beginPairing(now: Date = Date()) -> BeginResult {
        if let until = lockedUntil, now < until {
            return .locked(retryAfter: until.timeIntervalSince(now))
        }
        if let session = active, now < session.expiresAt {
            return .code(session.code, expiresAt: session.expiresAt)
        }
        let code = makeCode()
        let expiresAt = now.addingTimeInterval(ttl)
        active = Session(code: code, expiresAt: expiresAt)
        return .code(code, expiresAt: expiresAt)
    }

    func confirm(code: String, now: Date = Date()) -> ConfirmResult {
        if let until = lockedUntil {
            if now < until { return .locked }
            lockedUntil = nil
        }
        guard let session = active else { return .expired }
        if now >= session.expiresAt { active = nil; return .expired }

        if code == session.code {
            active = nil
            totalFailures = 0
            lockoutLevel = 0
            return .ok
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
}
