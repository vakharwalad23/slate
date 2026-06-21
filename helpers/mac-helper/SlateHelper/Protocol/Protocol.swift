import Foundation

let PROTOCOL_VERSION = 1

struct Capabilities: Codable, Equatable, Sendable {
    var launchApps: Bool
    var runShortcuts: Bool
    var runShell: Bool
    var keystrokes: Bool
    var appList: Bool
    var appIcons: Bool
    var liveState: Bool
}

// Mirrors command.ts discriminatedUnion("kind"). Wire field names are load-bearing.
enum Command: Equatable, Sendable {
    case launchApp(app: String)
    case activateApp(bundleId: String)
    case runShortcut(name: String, input: String?)
    case runApplescript(script: String)
    case runShell(script: String)
    case unknown(kind: String)
}

extension Command: Codable {
    private enum CodingKeys: String, CodingKey { case kind, app, bundleId, name, input, script }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try c.decode(String.self, forKey: .kind)
        switch kind {
        case "launch_app":
            self = .launchApp(app: try c.decode(String.self, forKey: .app))
        case "activate_app":
            self = .activateApp(bundleId: try c.decode(String.self, forKey: .bundleId))
        case "run_shortcut":
            self = .runShortcut(
                name: try c.decode(String.self, forKey: .name),
                input: try c.decodeIfPresent(String.self, forKey: .input)
            )
        case "run_applescript":
            self = .runApplescript(script: try c.decode(String.self, forKey: .script))
        case "run_shell":
            self = .runShell(script: try c.decode(String.self, forKey: .script))
        default:
            self = .unknown(kind: kind)
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .launchApp(app):
            try c.encode("launch_app", forKey: .kind)
            try c.encode(app, forKey: .app)
        case let .activateApp(bundleId):
            try c.encode("activate_app", forKey: .kind)
            try c.encode(bundleId, forKey: .bundleId)
        case let .runShortcut(name, input):
            try c.encode("run_shortcut", forKey: .kind)
            try c.encode(name, forKey: .name)
            try c.encodeIfPresent(input, forKey: .input)
        case let .runApplescript(script):
            try c.encode("run_applescript", forKey: .kind)
            try c.encode(script, forKey: .script)
        case let .runShell(script):
            try c.encode("run_shell", forKey: .kind)
            try c.encode(script, forKey: .script)
        case let .unknown(kind):
            try c.encode(kind, forKey: .kind)
        }
    }
}

// Mirrors messages.ts discriminatedUnion("type"). Cases for other types land with later features;
// unknown(type:) tolerates anything not yet handled so the receive loop can drop it (mirrors the
// Node helper's `default: return null`).
enum Message: Sendable {
    case hello(id: String, reId: String?, deviceId: String, deviceName: String, appVersion: String)
    case helloAck(id: String, reId: String?, helperName: String, helperVersion: String, capabilities: Capabilities, paired: Bool)
    case ping(id: String, reId: String?, t: Double)
    case pong(id: String, reId: String?, t: Double)
    case commandExecute(id: String, reId: String?, command: Command)
    case commandResult(id: String, reId: String?, ok: Bool, error: String?)
    case unknown(type: String, id: String, reId: String?)

    var id: String {
        switch self {
        case let .hello(id, _, _, _, _),
             let .helloAck(id, _, _, _, _, _),
             let .ping(id, _, _),
             let .pong(id, _, _),
             let .commandExecute(id, _, _),
             let .commandResult(id, _, _, _),
             let .unknown(_, id, _):
            return id
        }
    }
}
