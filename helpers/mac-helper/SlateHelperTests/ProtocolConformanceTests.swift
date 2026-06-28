import XCTest
@testable import SlateHelper

// Pins the hand-mirrored Swift Codable to the shared cross-language fixtures (packages/protocol/
// fixtures/messages.json), the same vectors the Zod conformance test checks. Directional: Swift
// only decodes inbound App->Helper frames and only encodes outbound Helper->App frames, so each
// direction is asserted on its own side.
final class ProtocolConformanceTests: XCTestCase {
    private func loadFixtures() throws -> [String: Any] {
        // ponytail: resolve the shared fixtures relative to this source file; xcodebuild test always
        // runs from the checkout. If tests ever run detached from the source tree, bundle it instead.
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "packages/protocol/fixtures/messages.json")
        let data = try Data(contentsOf: url)
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func bucket(_ fixtures: [String: Any], _ key: String) throws -> [(name: String, frame: [String: Any])] {
        let entries = try XCTUnwrap(fixtures[key] as? [[String: Any]], "missing bucket \(key)")
        return try entries.map {
            (try XCTUnwrap($0["name"] as? String), try XCTUnwrap($0["frame"] as? [String: Any]))
        }
    }

    // Dotted key paths of every field, descending into nested objects and array elements; value
    // differences are ignored so the assertion pins SHAPE (added/removed/renamed fields).
    private func deepKeys(_ value: Any?, _ prefix: String = "") -> Set<String> {
        var keys: Set<String> = []
        if let dict = value as? [String: Any] {
            for (k, v) in dict {
                let path = prefix.isEmpty ? k : "\(prefix).\(k)"
                keys.insert(path)
                keys.formUnion(deepKeys(v, path))
            }
        } else if let array = value as? [Any], let first = array.first {
            keys.formUnion(deepKeys(first, prefix))
        }
        return keys
    }

    private func encodedDict(_ message: Message) throws -> [String: Any] {
        let data = try encodeMessage(message)
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func assertShape(_ encoded: [String: Any], matches frame: [String: Any], _ name: String) {
        XCTAssertEqual(encoded["type"] as? String, frame["type"] as? String, name)
        XCTAssertEqual(encoded["v"] as? Int, 1, name)
        XCTAssertEqual(deepKeys(encoded["payload"]), deepKeys(frame["payload"]), "payload shape for \(name)")
    }

    func testInboundFramesDecodeAndReEncodeToSameShape() throws {
        for (name, frame) in try bucket(loadFixtures(), "inbound") {
            let data = try JSONSerialization.data(withJSONObject: frame)
            guard case let .success(message) = decodeMessage(data) else {
                return XCTFail("inbound \(name) failed to decode")
            }
            assertShape(try encodedDict(message), matches: frame, name)
        }
    }

    func testOutboundFramesEncodeToSameShape() throws {
        let capabilities = Capabilities(
            launchApps: true, runShortcuts: true, runShell: false,
            keystrokes: false, appList: true, appIcons: true, liveState: false
        )
        let byType: [String: Message] = [
            "hello_ack": .helloAck(id: "id", reId: "re", helperName: "slate", helperVersion: "0.1.0", capabilities: capabilities, paired: false),
            "pair_ok": .pairOk(id: "id", reId: "re", token: "t"),
            "pair_error": .pairError(id: "id", reId: "re", reason: "bad code"),
            "pair_pending": .pairPending(id: "id", reId: "re", expiresInMs: 1000),
            "auth_ok": .authOk(id: "id", reId: "re"),
            "auth_error": .authError(id: "id", reId: "re", reason: "invalid token"),
            "command.result": .commandResult(id: "id", reId: "re", ok: true, error: nil),
            "apps.list.response": .appsListResponse(id: "id", reId: "re", apps: [AppInfo(bundleId: "b", name: "n", path: "p", iconVersion: "1")]),
            "apps.icon.response": .appsIconResponse(id: "id", reId: "re", icons: [IconEntry(bundleId: "b", pngBase64: "x", iconVersion: "1")]),
            "state.update": .stateUpdate(id: "id", reId: "re", topic: "foregroundApp", value: "com.apple.Safari"),
            "pong": .pong(id: "id", reId: "re", t: 1),
            "error": .error(id: "id", reId: "re", code: "internal", message: "m"),
        ]
        let outbound = try bucket(loadFixtures(), "outbound")
        for (name, frame) in outbound {
            let type = try XCTUnwrap(frame["type"] as? String)
            let message = try XCTUnwrap(byType[type], "no constructor for \(type)")
            assertShape(try encodedDict(message), matches: frame, name)
        }
        XCTAssertEqual(outbound.count, byType.count, "outbound fixtures and constructors drifted")
    }

    func testNotYetDecodedFramesDropToUnknown() throws {
        for (name, frame) in try bucket(loadFixtures(), "notYetDecoded") {
            let data = try JSONSerialization.data(withJSONObject: frame)
            guard case .success(.unknown) = decodeMessage(data) else {
                return XCTFail("\(name) should decode to .unknown until its handler lands")
            }
        }
    }

    func testRejectedFramesFailToDecode() throws {
        for (name, frame) in try bucket(loadFixtures(), "rejected") {
            let data = try JSONSerialization.data(withJSONObject: frame)
            guard case .failure = decodeMessage(data) else {
                return XCTFail("\(name) should be rejected by decodeMessage")
            }
        }
    }

    func testUnknownTypeDropsToUnknown() throws {
        for (name, frame) in try bucket(loadFixtures(), "unknownType") {
            let data = try JSONSerialization.data(withJSONObject: frame)
            guard case .success(.unknown) = decodeMessage(data) else {
                return XCTFail("\(name) should decode to .unknown")
            }
        }
    }

    func testTsOnlyRejectedFramesAreLenientInSwift() throws {
        // id uuid format is enforced only at the phone boundary; Swift passes it through.
        for (name, frame) in try bucket(loadFixtures(), "tsOnlyRejected") {
            let data = try JSONSerialization.data(withJSONObject: frame)
            guard case .success = decodeMessage(data) else {
                return XCTFail("\(name) should decode in Swift (lenient id handling)")
            }
        }
    }
}
