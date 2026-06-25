import dnssd
import Foundation

enum BonjourError: Error { case register(DNSServiceErrorType) }

// Must be a top-level @convention(c) function (DNSServiceRegisterReply); a closure cannot bridge.
private func bonjourRegisterReply(
    _ sdRef: DNSServiceRef?,
    _ flags: DNSServiceFlags,
    _ errorCode: DNSServiceErrorType,
    _ name: UnsafePointer<CChar>?,
    _ regtype: UnsafePointer<CChar>?,
    _ domain: UnsafePointer<CChar>?,
    _ context: UnsafeMutableRawPointer?
) {}

// Bonjour advertising via the dns-sd C API; NWListener.Service advertising is broken (FB14321888).
final class BonjourAdvertiser: @unchecked Sendable {
    private var ref: DNSServiceRef?
    private var source: DispatchSourceRead?
    private let queue = DispatchQueue(label: "com.slate.helper.bonjour")

    func register(serviceType: String, port: UInt16, txt: [String: String]) throws {
        var sdRef: DNSServiceRef?
        let txtData = Self.encodeTXT(txt)
        let error = txtData.withUnsafeBytes { (raw: UnsafeRawBufferPointer) -> DNSServiceErrorType in
            DNSServiceRegister(
                &sdRef,
                0,
                0,
                nil,
                serviceType,
                nil,
                nil,
                port.bigEndian, // network byte order is required; a host-order port silently misadvertises
                UInt16(raw.count),
                raw.baseAddress,
                bonjourRegisterReply,
                nil
            )
        }
        guard error == kDNSServiceErr_NoError, let sdRef else { throw BonjourError.register(error) }
        ref = sdRef

        let fileDescriptor = DNSServiceRefSockFD(sdRef)
        let source = DispatchSource.makeReadSource(fileDescriptor: fileDescriptor, queue: queue)
        let handle = sdRef
        source.setEventHandler { DNSServiceProcessResult(handle) }
        source.resume()
        self.source = source
    }

    func unregister() {
        source?.cancel()
        source = nil
        if let ref { DNSServiceRefDeallocate(ref) }
        ref = nil
    }

    // TXT record: each entry is a single length byte followed by "key=value" UTF-8 bytes.
    private static func encodeTXT(_ txt: [String: String]) -> Data {
        var data = Data()
        for (key, value) in txt {
            let bytes = Array("\(key)=\(value)".utf8)
            guard bytes.count <= 255 else { continue }
            data.append(UInt8(bytes.count))
            data.append(contentsOf: bytes)
        }
        return data
    }
}
