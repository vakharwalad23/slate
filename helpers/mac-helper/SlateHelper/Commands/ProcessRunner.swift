import Foundation

enum ProcessRunError: Error, CustomStringConvertible {
    case nonZeroExit(status: Int32, message: String)

    var description: String {
        switch self {
        case let .nonZeroExit(status, message):
            return message.isEmpty ? "exited with status \(status)" : message
        }
    }
}

// Injectable so the executor and dispatcher are testable without spawning processes.
protocol ProcessRunning: Sendable {
    @discardableResult
    func run(_ launchPath: String, _ args: [String], stdin: String?) async throws -> String
}

extension ProcessRunning {
    @discardableResult
    func run(_ launchPath: String, _ args: [String]) async throws -> String {
        try await run(launchPath, args, stdin: nil)
    }
}

struct SystemProcessRunner: ProcessRunning {
    func run(_ launchPath: String, _ args: [String], stdin: String?) async throws -> String {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: launchPath)
            process.arguments = args
            let outPipe = Pipe()
            let errPipe = Pipe()
            process.standardOutput = outPipe
            process.standardError = errPipe
            if let stdin {
                let inPipe = Pipe()
                process.standardInput = inPipe
                // Write before run() so a small payload is buffered; close to send EOF so the child's read ends.
                inPipe.fileHandleForWriting.write(Data(stdin.utf8))
                try? inPipe.fileHandleForWriting.close()
            }
            // terminationHandler fires on a private queue; read the pipes there, never on the cooperative pool.
            process.terminationHandler = { proc in
                let out = outPipe.fileHandleForReading.readDataToEndOfFile()
                let err = errPipe.fileHandleForReading.readDataToEndOfFile()
                if proc.terminationStatus == 0 {
                    continuation.resume(returning: String(decoding: out, as: UTF8.self))
                } else {
                    let message = String(decoding: err, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
                    continuation.resume(throwing: ProcessRunError.nonZeroExit(status: proc.terminationStatus, message: message))
                }
            }
            do {
                try process.run()
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
}
