import Foundation
import XCTest
@testable import SlateHelper

final class UDPResponderTests: XCTestCase {
    func testRepliesToProbeWithNameAndPort() throws {
        let port: UInt16 = 19876
        let responder = UDPResponder(name: "test-helper", port: port)
        responder.start()
        defer { responder.stop() }
        Thread.sleep(forTimeInterval: 0.1) // let the socket bind

        let client = socket(AF_INET, SOCK_DGRAM, 0)
        XCTAssertGreaterThanOrEqual(client, 0)
        defer { close(client) }
        var timeout = timeval(tv_sec: 1, tv_usec: 0)
        setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))

        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = port.bigEndian
        inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr)
        let probe = Array("SLATE-DISCOVER-v1".utf8)
        let sent = withUnsafePointer(to: &addr) { raw in
            raw.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                sendto(client, probe, probe.count, 0, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        XCTAssertGreaterThan(sent, 0)

        var buffer = [UInt8](repeating: 0, count: 512)
        let n = recv(client, &buffer, buffer.count, 0)
        XCTAssertGreaterThan(n, 0)
        let reply = String(decoding: buffer[0..<max(0, n)], as: UTF8.self)
        XCTAssertTrue(reply.hasPrefix("SLATE-HELPER-v1"), reply)
        XCTAssertTrue(reply.contains("19876"), reply)
        XCTAssertTrue(reply.contains("test-helper"), reply)
    }
}
