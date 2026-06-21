import Foundation
import Observation

// Bounded ring buffer of warnings/errors only (nothing routine), shown in the menu.
@MainActor
@Observable
final class LogStore {
    enum Level: String { case warn, error }

    struct Entry: Identifiable {
        let id = UUID()
        let level: Level
        let message: String
        let date: Date
    }

    private(set) var entries: [Entry] = []
    private let limit = 200

    func warn(_ message: String) { append(.warn, message) }
    func error(_ message: String) { append(.error, message) }
    func clear() { entries.removeAll() }

    private func append(_ level: Level, _ message: String) {
        entries.append(Entry(level: level, message: message, date: Date()))
        if entries.count > limit { entries.removeFirst(entries.count - limit) }
    }
}
