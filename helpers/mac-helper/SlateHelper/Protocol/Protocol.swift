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

struct AppInfo: Codable, Sendable, Equatable {
    let bundleId: String
    let name: String
    let path: String
    let iconVersion: String
}

struct IconEntry: Codable, Sendable, Equatable {
    let bundleId: String
    let pngBase64: String
    let iconVersion: String
}

// Mirrors command.ts discriminatedUnion("kind"). Wire field names are load-bearing.
enum Command: Equatable, Sendable {
    case launchApp(app: String)
    case activateApp(bundleId: String)
    case quitApp(bundleId: String)
    case runShortcut(name: String, input: String?)
    case runApplescript(script: String)
    case runShell(script: String)
    case media(action: String)
    case keystroke(key: String, modifiers: [String])
    case space(direction: String)
    case appSwitch(direction: String)
    indirect case macro(steps: [MacroStep])
    case unknown(kind: String)
}

struct MacroStep: Codable, Equatable, Sendable {
    let command: Command
    let delayMs: Double?
}

extension Command: Codable {
    private enum CodingKeys: String, CodingKey {
        case kind, app, bundleId, name, input, script, action, key, modifiers, direction, steps
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try c.decode(String.self, forKey: .kind)
        switch kind {
        case "launch_app":
            self = .launchApp(app: try c.decode(String.self, forKey: .app))
        case "activate_app":
            self = .activateApp(bundleId: try c.decode(String.self, forKey: .bundleId))
        case "quit_app":
            self = .quitApp(bundleId: try c.decode(String.self, forKey: .bundleId))
        case "run_shortcut":
            self = .runShortcut(
                name: try c.decode(String.self, forKey: .name),
                input: try c.decodeIfPresent(String.self, forKey: .input)
            )
        case "run_applescript":
            self = .runApplescript(script: try c.decode(String.self, forKey: .script))
        case "run_shell":
            self = .runShell(script: try c.decode(String.self, forKey: .script))
        case "media":
            self = .media(action: try c.decode(String.self, forKey: .action))
        case "keystroke":
            self = .keystroke(
                key: try c.decode(String.self, forKey: .key),
                modifiers: try c.decode([String].self, forKey: .modifiers)
            )
        case "space":
            self = .space(direction: try c.decode(String.self, forKey: .direction))
        case "app_switch":
            self = .appSwitch(direction: try c.decode(String.self, forKey: .direction))
        case "macro":
            self = .macro(steps: try c.decode([MacroStep].self, forKey: .steps))
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
        case let .quitApp(bundleId):
            try c.encode("quit_app", forKey: .kind)
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
        case let .media(action):
            try c.encode("media", forKey: .kind)
            try c.encode(action, forKey: .action)
        case let .keystroke(key, modifiers):
            try c.encode("keystroke", forKey: .kind)
            try c.encode(key, forKey: .key)
            try c.encode(modifiers, forKey: .modifiers)
        case let .space(direction):
            try c.encode("space", forKey: .kind)
            try c.encode(direction, forKey: .direction)
        case let .appSwitch(direction):
            try c.encode("app_switch", forKey: .kind)
            try c.encode(direction, forKey: .direction)
        case let .macro(steps):
            try c.encode("macro", forKey: .kind)
            try c.encode(steps, forKey: .steps)
        case let .unknown(kind):
            try c.encode(kind, forKey: .kind)
        }
    }
}

// Mirrors messages.ts discriminatedUnion("type"). unknown(type:) tolerates anything not handled so
// the receive loop can drop it (mirrors the Node helper's `default: return null`).
enum Message: Sendable {
    // app -> helper
    case hello(id: String, reId: String?, deviceId: String, deviceName: String, appVersion: String)
    case pairRequest(id: String, reId: String?)
    case pairConfirm(id: String, reId: String?, code: String)
    case auth(id: String, reId: String?, token: String)
    case commandExecute(id: String, reId: String?, command: Command)
    case appsList(id: String, reId: String?)
    case appsIcon(id: String, reId: String?, bundleIds: [String])
    case subscribeState(id: String, reId: String?, topics: [String])
    case ping(id: String, reId: String?, t: Double)
    // helper -> app
    case helloAck(id: String, reId: String?, helperName: String, helperVersion: String, capabilities: Capabilities, paired: Bool)
    case pairOk(id: String, reId: String?, token: String)
    case pairError(id: String, reId: String?, reason: String)
    case pairPending(id: String, reId: String?, expiresInMs: Double)
    case authOk(id: String, reId: String?)
    case authError(id: String, reId: String?, reason: String)
    case commandResult(id: String, reId: String?, ok: Bool, error: String?)
    case appsListResponse(id: String, reId: String?, apps: [AppInfo])
    case appsIconResponse(id: String, reId: String?, icons: [IconEntry])
    // value carries the foreground app's bundle id; widen to a JSON value if more topics ship.
    case stateUpdate(id: String, reId: String?, topic: String, value: String)
    case pong(id: String, reId: String?, t: Double)
    case error(id: String, reId: String?, code: String, message: String)
    case unknown(type: String, id: String, reId: String?)
}
