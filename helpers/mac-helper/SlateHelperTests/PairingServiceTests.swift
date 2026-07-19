import Foundation
import XCTest
@testable import SlateHelper

private let testPairingSecret = Data([UInt8](repeating: 7, count: 15))

final class PairingServiceTests: XCTestCase {
    private func service() -> PairingService {
        PairingService(ttl: 120, lockThreshold: 3, baseLockout: 30, maxLockout: 300, makeSecret: { testPairingSecret })
    }

    func testReusesActiveSecretAcrossBeginPairing() async {
        let pairing = service()
        guard case let .code(first, _) = await pairing.beginPairing(),
              case let .code(second, _) = await pairing.beginPairing() else {
            return XCTFail("expected codes")
        }
        XCTAssertEqual(first, second) // not rerolled within the TTL
    }

    func testSessionStateReflectsActiveSecret() async {
        let pairing = service()
        guard case .none = await pairing.sessionState() else { return XCTFail("expected none before begin") }
        _ = await pairing.beginPairing()
        guard case let .active(secret, _) = await pairing.sessionState() else { return XCTFail("expected active") }
        XCTAssertEqual(secret, testPairingSecret)
    }

    func testLocksAfterThresholdAndStaysLockedAcrossBeginPairing() async {
        let pairing = service()
        _ = await pairing.beginPairing()
        let a = await pairing.recordFailure()
        let b = await pairing.recordFailure()
        let c = await pairing.recordFailure()
        XCTAssertEqual(a, .badCode)
        XCTAssertEqual(b, .badCode)
        XCTAssertEqual(c, .locked)

        // The core regression: pair_request during lockout must NOT reset it.
        guard case .locked = await pairing.beginPairing() else { return XCTFail("beginPairing should be locked") }
        let stillLocked = await pairing.recordFailure()
        XCTAssertEqual(stillLocked, .locked)
    }

    func testLockoutExpiresThenAllowsAgain() async {
        let pairing = service()
        let start = Date(timeIntervalSince1970: 1_000_000)
        _ = await pairing.beginPairing(now: start)
        for _ in 0 ..< 3 { _ = await pairing.recordFailure(now: start) }
        let duringLock = await pairing.recordFailure(now: start.addingTimeInterval(5))
        XCTAssertEqual(duringLock, .locked)
        guard case .code = await pairing.beginPairing(now: start.addingTimeInterval(40)) else {
            return XCTFail("should allow a fresh code after the lockout window")
        }
    }

    func testSuccessClearsCounters() async {
        let pairing = service()
        _ = await pairing.beginPairing()
        _ = await pairing.recordFailure()
        await pairing.recordSuccess()
        _ = await pairing.beginPairing()
        // Counters reset, so it takes the full threshold again - the first failure is badCode not locked.
        let afterSuccess = await pairing.recordFailure()
        XCTAssertEqual(afterSuccess, .badCode)
    }
}
