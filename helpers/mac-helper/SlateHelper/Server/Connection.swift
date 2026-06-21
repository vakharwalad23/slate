import Foundation
import Network

// NWConnection is callback-driven and thread-safe to send on from any thread; access is serialized by
// the shared listener queue + NWConnection's own internals, so @unchecked Sendable is sound here.
final class Connection: @unchecked Sendable {
    private let connection: NWConnection
    private let dispatcher: Dispatcher
    private let onClose: @Sendable (Connection) -> Void

    init(connection: NWConnection, dispatcher: Dispatcher, onClose: @escaping @Sendable (Connection) -> Void) {
        self.connection = connection
        self.dispatcher = dispatcher
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

    private func receiveNext() {
        connection.receiveMessage { [weak self] data, context, _, error in
            guard let self else { return }
            if let data, !data.isEmpty,
               let metadata = context?.protocolMetadata.compactMap({ $0 as? NWProtocolWebSocket.Metadata }).first,
               metadata.opcode == .text {
                Task { await self.handle(data) }
            }
            if error == nil {
                self.receiveNext()
            } else {
                self.onClose(self)
            }
        }
    }

    private func handle(_ data: Data) async {
        switch decodeMessage(data) {
        case let .success(message):
            if let reply = await dispatcher.dispatch(message) {
                send(reply)
            }
        case .failure:
            break
        }
    }

    private func send(_ message: Message) {
        guard let data = try? encodeMessage(message) else { return }
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "msg", metadata: [metadata])
        connection.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { _ in })
    }
}
