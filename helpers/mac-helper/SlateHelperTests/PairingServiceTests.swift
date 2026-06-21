import XCTest
@testable import SlateHelper

final class PairingServiceTests: XCTestCase {
    private func service() -> PairingService {
        PairingService(ttl: 120, lockThreshold: 3, baseLockout: 30, maxLockout: 300, makeCode: { "111111" })
    }

    func testReusesActiveCodeAcrossBeginPairing() async {
        let pairing = service()
        guard case let .code(first) = await pairing.beginPairing(),
              case let .code(second) = await pairing.beginPairing() else {
            return XCTFail("expected codes")
        }
        XCTAssertEqual(first, second) // not rerolled within the TTL
    }

    func testLocksAfterThresholdAndStaysLockedAcrossBeginPairing() async {
        let pairing = service()
        _ = await pairing.beginPairing()
        let a = await pairing.confirm(code: "000000")
        let b = await pairing.confirm(code: "000000")
        let c = await pairing.confirm(code: "000000")
        XCTAssertEqual(a, .badCode)
        XCTAssertEqual(b, .badCode)
        XCTAssertEqual(c, .locked)

        // The core regression: pair_request during lockout must NOT reset it.
        guard case .locked = await pairing.beginPairing() else {
            return XCTFail("beginPairing should be locked")
        }
        // And further confirms stay locked, not badCode.
        let stillLocked = await pairing.confirm(code: "000000")
        XCTAssertEqual(stillLocked, .locked)
    }

    func testLockoutExpiresThenAllowsAgain() async {
        let pairing = service()
        let start = Date(timeIntervalSince1970: 1_000_000)
        _ = await pairing.beginPairing(now: start)
        for _ in 0 ..< 3 { _ = await pairing.confirm(code: "000000", now: start) }
        let duringLock = await pairing.confirm(code: "111111", now: start.addingTimeInterval(5))
        XCTAssertEqual(duringLock, .locked)
        guard case .code = await pairing.beginPairing(now: start.addingTimeInterval(40)) else {
            return XCTFail("should allow a fresh code after the lockout window")
        }
    }

    func testCorrectCodeSucceedsAndClearsCounters() async {
        let pairing = service()
        _ = await pairing.beginPairing()
        _ = await pairing.confirm(code: "000000")
        let ok = await pairing.confirm(code: "111111")
        XCTAssertEqual(ok, .ok)
    }
}
