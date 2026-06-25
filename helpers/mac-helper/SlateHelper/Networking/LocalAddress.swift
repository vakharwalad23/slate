import Foundation

enum LocalAddress {
    // Primary LAN IPv4 (first running, non-loopback en* interface), for display in the menu.
    static func primaryIPv4() -> String? {
        var ifaddrPtr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddrPtr) == 0, let first = ifaddrPtr else { return nil }
        defer { freeifaddrs(ifaddrPtr) }

        var address: String?
        var cursor: UnsafeMutablePointer<ifaddrs>? = first
        while let current = cursor {
            defer { cursor = current.pointee.ifa_next }
            let flags = Int32(current.pointee.ifa_flags)
            guard let addr = current.pointee.ifa_addr,
                  (flags & (IFF_UP | IFF_RUNNING)) == (IFF_UP | IFF_RUNNING),
                  (flags & IFF_LOOPBACK) == 0,
                  addr.pointee.sa_family == UInt8(AF_INET)
            else { continue }

            let name = String(cString: current.pointee.ifa_name)
            guard name.hasPrefix("en") else { continue }

            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            if getnameinfo(addr, socklen_t(addr.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                address = host.withUnsafeBufferPointer { buffer in
                    buffer.baseAddress.map { String(cString: $0) }
                }
                break
            }
        }
        return address
    }
}
