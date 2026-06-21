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

    // Drop the live connection if it belongs to a revoked device, so revoke takes effect immediately.
    func closeIfDevice(_ deviceId: String) async {
        guard let connection = current else { return }
        if await connection.authedDeviceId() == deviceId {
            connection.close()
            current = nil
        }
    }
}
