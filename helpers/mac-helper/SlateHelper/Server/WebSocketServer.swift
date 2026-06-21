import Foundation
import Network

final class WebSocketServer: @unchecked Sendable {
    private let port: UInt16
    private let host: String
    private let registry: ConnectionRegistry
    private let services: HelperServices
    private let onState: @Sendable (String) -> Void
    private let queue = DispatchQueue(label: "com.slate.helper.ws")
    private var listener: NWListener?

    init(
        port: UInt16,
        host: String,
        registry: ConnectionRegistry,
        services: HelperServices,
        onState: @escaping @Sendable (String) -> Void
    ) {
        self.port = port
        self.host = host
        self.registry = registry
        self.services = services
        self.onState = onState
    }

    func start() throws {
        let wsOptions = NWProtocolWebSocket.Options()
        wsOptions.autoReplyPing = true
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        parameters.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)

        guard let nwPort = NWEndpoint.Port(rawValue: port) else { throw ServerError.badPort }

        let listener: NWListener
        if host.isEmpty {
            listener = try NWListener(using: parameters, on: nwPort)
        } else {
            parameters.requiredLocalEndpoint = .hostPort(host: .init(host), port: nwPort)
            listener = try NWListener(using: parameters)
        }
        self.listener = listener

        listener.stateUpdateHandler = { [onState] state in
            switch state {
            case .ready:
                onState("running")
            case let .failed(error):
                onState("error: \(error.localizedDescription)")
            default:
                break
            }
        }
        listener.newConnectionHandler = { [weak self] nwConnection in
            self?.accept(nwConnection)
        }
        listener.start(queue: queue)
    }

    func stop() {
        listener?.cancel()
        listener = nil
        let registry = self.registry
        Task { await registry.closeAll() }
    }

    private func accept(_ nwConnection: NWConnection) {
        let registry = self.registry
        let queue = self.queue
        let connection = Connection(connection: nwConnection, services: services) { closed in
            Task { await registry.clear(closed) }
        }
        Task {
            if let previous = await registry.setCurrent(connection) {
                previous.close()
            }
            connection.start(queue: queue)
        }
    }

    enum ServerError: Error { case badPort }
}
