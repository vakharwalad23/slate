import Foundation

// Mirrors the Node helper's handleMessage: hello -> hello_ack, ping -> pong,
// command.execute -> command.result, everything else -> nil (dropped).
struct Dispatcher: Sendable {
    let executor: CommandExecuting
    let capabilities: Capabilities
    let helperName: String
    let helperVersion: String

    init(
        executor: CommandExecuting = CommandExecutor(),
        capabilities: Capabilities = HelperConfig.capabilities,
        helperName: String = HelperConfig.name,
        helperVersion: String = HelperConfig.version
    ) {
        self.executor = executor
        self.capabilities = capabilities
        self.helperName = helperName
        self.helperVersion = helperVersion
    }

    func dispatch(_ message: Message) async -> Message? {
        switch message {
        case let .hello(id, _, _, _, _):
            return .helloAck(
                id: newMessageId(), reId: id,
                helperName: helperName, helperVersion: helperVersion,
                capabilities: capabilities, paired: false
            )
        case let .ping(id, _, t):
            return .pong(id: newMessageId(), reId: id, t: t)
        case let .commandExecute(id, _, command):
            let outcome = await executor.execute(command)
            return .commandResult(id: newMessageId(), reId: id, ok: outcome.ok, error: outcome.error)
        default:
            return nil
        }
    }
}
