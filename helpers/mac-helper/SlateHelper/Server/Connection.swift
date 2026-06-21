import Foundation
import Network

// NWConnection is callback-driven and thread-safe to send on from any thread; access is serialized by
// the shared listener queue + NWConnection's own internals, so @unchecked Sendable is sound here.
final class Connection: @unchecked Sendable {
    private let connection: NWConnection
    private let session: ClientSession
    private let onClose: @Sendable (Connection) -> Void

    init(connection: NWConnection, services: HelperServices, onClose: @escaping @Sendable (Connection) -> Void) {
        self.connection = connection
        self.session = ClientSession(services: services)
        self.onClose = onClose
    }

    func start(queue: DispatchQueue) {
        connection.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                self.receiveNext()
            case .failed, .cancelled:
                self.onClose(self)
            default:
                break
            }
        }
        connection.start(queue: queue)
    }

    func close() {
        connection.stateUpdateHandler = nil
        connection.cancel()
    }

    func authedDeviceId() async -> String? {
        await session.currentDeviceId()
    }

    private func receiveNext() {
        connection.receiveMessage { [weak self] data, context, _, error in
            guard let self else { return }
            if error != nil {
                self.onClose(self)
                return
            }
            let isText = (context?.protocolMetadata.compactMap { $0 as? NWProtocolWebSocket.Metadata }.first)?.opcode == .text
            if let data, !data.isEmpty, isText {
                // Re-arm only after this message is fully handled so per-connection state stays ordered.
                Task {
                    await self.handle(data)
                    self.receiveNext()
                }
            } else {
                self.receiveNext()
            }
        }
    }

    private func handle(_ data: Data) async {
        guard case let .success(message) = decodeMessage(data) else { return }
        await session.handle(message) { [weak self] reply in
            self?.sendFrame(reply)
        }
    }

    private func sendFrame(_ message: Message) {
        guard let data = try? encodeMessage(message) else { return }
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "msg", metadata: [metadata])
        connection.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { _ in })
    }
}
