import Network

// Watches the default path and reports the primary IPv4 once it settles to a NEW value (debounced
// against flapping). One monitor for the app lifetime; cancel() on terminate.
final class NetworkMonitor: @unchecked Sendable {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.slate.helper.netmon")
    private var debounce: DispatchWorkItem?
    private var lastAddress: String?
    private let onChange: @Sendable (String?) -> Void

    init(onChange: @escaping @Sendable (String?) -> Void) {
        self.onChange = onChange
    }

    func start() {
        lastAddress = LocalAddress.primaryIPv4() // seed so the initial path update is not a spurious change
        monitor.pathUpdateHandler = { [weak self] _ in self?.schedule() }
        monitor.start(queue: queue)
    }

    func stop() {
        debounce?.cancel()
        debounce = nil
        monitor.pathUpdateHandler = nil
        monitor.cancel()
    }

    private func schedule() {
        debounce?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            let address = LocalAddress.primaryIPv4()
            guard address != self.lastAddress else { return }
            self.lastAddress = address
            self.onChange(address)
        }
        debounce = work
        queue.asyncAfter(deadline: .now() + 1.0, execute: work)
    }
}
