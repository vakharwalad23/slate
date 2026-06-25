import Foundation

// One short-lived 6-digit code at a time. The code is display-only (never persisted); the durable
// secret is the issued token. Lock-after-maxAttempts and TTL both clear the session, which is the
// rate-limit: a fresh pair_request is required to retry.
actor PairingService {
    enum ConfirmResult: Equatable { case ok, badCode, expired, locked }

    private struct Session {
        let code: String
        let expiresAt: Date
        var attempts: Int
    }

    private var active: Session?
    private let ttl: TimeInterval
    private let maxAttempts: Int
    private let makeCode: @Sendable () -> String

    init(ttl: TimeInterval = 120, maxAttempts: Int = 5, makeCode: (@Sendable () -> String)? = nil) {
        self.ttl = ttl
        self.maxAttempts = maxAttempts
        self.makeCode = makeCode ?? { String(format: "%06d", Int.random(in: 0 ... 999_999)) }
    }

    func beginPairing(now: Date = Date()) -> String {
        let code = makeCode()
        active = Session(code: code, expiresAt: now.addingTimeInterval(ttl), attempts: 0)
        return code
    }

    func confirm(code: String, now: Date = Date()) -> ConfirmResult {
        guard var session = active else { return .expired }
        if now >= session.expiresAt { active = nil; return .expired }
        if session.attempts >= maxAttempts { active = nil; return .locked }
        session.attempts += 1
        active = session
        if code == session.code {
            active = nil
            return .ok
        }
        return .badCode
    }
}
