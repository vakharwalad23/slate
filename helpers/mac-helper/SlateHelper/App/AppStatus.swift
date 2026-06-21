import Foundation
import Observation

@MainActor
@Observable
final class AppStatus {
    var serverRunning = false
    var boundHost = ""
    var clientConnected = false
    var lastError: String?
}
