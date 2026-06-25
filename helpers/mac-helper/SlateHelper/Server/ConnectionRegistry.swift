import Foundation

// Single active connection (no multi-device fan-out): a new connection replaces and closes the prior.
actor ConnectionRegistry {
    private var current: Connection?

    func setCurrent(_ connection: Connection) -> Connection? {
        let previous = current
        current = connection
        return previous
    }

    func clear(_ connection: Connection) {
        if current === connection { current = nil }
    }

    func closeAll() {
        current?.close()
        current = nil
    }
}
