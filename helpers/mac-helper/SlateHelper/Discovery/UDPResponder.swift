import Foundation

// Fast LAN discovery: the phone broadcasts a probe to this UDP port, the helper replies unicast with
// its name + WebSocket port. Sidesteps mDNS entirely (no MulticastLock needed on Android - a broadcast
// send and a unicast reply are the two operations the Wi-Fi stack never filters). Binds a BSD
// SOCK_DGRAM socket on the same port number as the TCP server. Discovery reveals only name + port;
// pairing/auth still gate everything after.
//
// Wire format (UTF-8): probe = "SLATE-DISCOVER-v1"; reply = "SLATE-HELPER-v1\n<port>\n<name>". The
// phone takes the helper host from the reply's source address.
final class UDPResponder: @unchecked Sendable {
    private static let probeMagic = "SLATE-DISCOVER-v1"
    private static let replyMagic = "SLATE-HELPER-v1"

    private var fd: Int32 = -1
    private var running = false
    private let queue = DispatchQueue(label: "com.slate.helper.udp-discovery")
    private let helperName: String
    private let wsPort: UInt16

    init(name: String, port: UInt16) {
        helperName = name
        wsPort = port
    }

    func start() {
        stop()
        let s = socket(AF_INET, SOCK_DGRAM, 0)
        guard s >= 0 else { return }
        var yes: Int32 = 1
        setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))
        setsockopt(s, SOL_SOCKET, SO_REUSEPORT, &yes, socklen_t(MemoryLayout<Int32>.size))
        // recvfrom returns every second so the loop can observe stop() and exit cleanly - closing the
        // fd does not reliably wake a blocked recvfrom on macOS, which would hang the process on exit.
        var timeout = timeval(tv_sec: 1, tv_usec: 0)
        setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_addr.s_addr = INADDR_ANY
        addr.sin_port = wsPort.bigEndian
        let bound = withUnsafePointer(to: &addr) { raw in
            raw.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(s, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bound == 0 else { close(s); return }
        fd = s
        running = true
        queue.async { [weak self] in self?.receiveLoop() }
    }

    func stop() {
        running = false
        if fd >= 0 {
            close(fd)
            fd = -1
        }
    }

    private func receiveLoop() {
        let reply = Array("\(Self.replyMagic)\n\(wsPort)\n\(helperName)".utf8)
        var buffer = [UInt8](repeating: 0, count: 512)
        while running {
            var from = sockaddr_storage()
            var fromLen = socklen_t(MemoryLayout<sockaddr_storage>.size)
            let n = withUnsafeMutablePointer(to: &from) { raw in
                raw.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                    recvfrom(fd, &buffer, buffer.count, 0, $0, &fromLen)
                }
            }
            guard n > 0 else {
                if !running { break }
                continue
            }
            guard String(decoding: buffer[0..<n], as: UTF8.self).hasPrefix(Self.probeMagic) else { continue }
            _ = withUnsafePointer(to: &from) { raw in
                raw.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                    sendto(fd, reply, reply.count, 0, $0, fromLen)
                }
            }
        }
    }
}
