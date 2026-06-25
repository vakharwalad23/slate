import Foundation

enum MessageDecodeError: Error, Equatable {
    case badEnvelope
    case malformedPayload(String)
}

// Lowercased so the phone's z.uuid() accepts it; an unparsed reply is silently dropped at its boundary.
func newMessageId() -> String { UUID().uuidString.lowercased() }

// Shared coders: re-allocating one per WS frame is the hot path. swift-foundation's coders are internally
// synchronized and never reconfigured here, so reuse from the connection queue / cooperative pool is safe.
private nonisolated(unsafe) let sharedDecoder = JSONDecoder()
private nonisolated(unsafe) let sharedEncoder = JSONEncoder()

private struct Envelope: Decodable {
    let v: Int
    let id: String
    let reId: String?
    let type: String
}

private struct InFrame<P: Decodable>: Decodable {
    let id: String
    let reId: String?
    let payload: P
}

private struct OutFrame<P: Encodable>: Encodable {
    let v: Int
    let id: String
    let reId: String?
    let type: String
    let payload: P
}

private struct EmptyPayload: Codable {}
private struct TPayload: Codable { let t: Double }
private struct CodePayload: Codable { let code: String }
private struct TokenPayload: Codable { let token: String }
private struct ReasonPayload: Codable { let reason: String }
private struct ExpiresInMsPayload: Codable { let expiresInMs: Double }
private struct BundleIdsPayload: Codable { let bundleIds: [String] }
private struct ErrorPayload: Codable { let code: String; let message: String }

private struct HelloPayload: Codable {
    let deviceId: String
    let deviceName: String
    let appVersion: String
}

private struct HelloAckPayload: Encodable {
    let helperName: String
    let helperVersion: String
    let capabilities: Capabilities
    let paired: Bool
}

private struct CommandResultPayload: Encodable {
    let ok: Bool
    let error: String?
}

private struct AppsListResponsePayload: Encodable { let apps: [AppInfo] }
private struct AppsIconResponsePayload: Encodable { let icons: [IconEntry] }

// safeParse analogue: never throws into the receive loop; drop on failure.
func decodeMessage(_ data: Data) -> Result<Message, MessageDecodeError> {
    let decoder = sharedDecoder
    guard let env = try? decoder.decode(Envelope.self, from: data) else { return .failure(.badEnvelope) }
    guard env.v == PROTOCOL_VERSION else { return .failure(.badEnvelope) }
    do {
        switch env.type {
        case "hello":
            let f = try decoder.decode(InFrame<HelloPayload>.self, from: data)
            return .success(.hello(
                id: f.id, reId: f.reId,
                deviceId: f.payload.deviceId, deviceName: f.payload.deviceName, appVersion: f.payload.appVersion
            ))
        case "pair_request":
            let f = try decoder.decode(InFrame<EmptyPayload>.self, from: data)
            return .success(.pairRequest(id: f.id, reId: f.reId))
        case "pair_confirm":
            let f = try decoder.decode(InFrame<CodePayload>.self, from: data)
            return .success(.pairConfirm(id: f.id, reId: f.reId, code: f.payload.code))
        case "auth":
            let f = try decoder.decode(InFrame<TokenPayload>.self, from: data)
            return .success(.auth(id: f.id, reId: f.reId, token: f.payload.token))
        case "command.execute":
            let f = try decoder.decode(InFrame<Command>.self, from: data)
            return .success(.commandExecute(id: f.id, reId: f.reId, command: f.payload))
        case "apps.list":
            let f = try decoder.decode(InFrame<EmptyPayload>.self, from: data)
            return .success(.appsList(id: f.id, reId: f.reId))
        case "apps.icon":
            let f = try decoder.decode(InFrame<BundleIdsPayload>.self, from: data)
            return .success(.appsIcon(id: f.id, reId: f.reId, bundleIds: f.payload.bundleIds))
        case "ping":
            let f = try decoder.decode(InFrame<TPayload>.self, from: data)
            return .success(.ping(id: f.id, reId: f.reId, t: f.payload.t))
        default:
            return .success(.unknown(type: env.type, id: env.id, reId: env.reId))
        }
    } catch {
        return .failure(.malformedPayload(env.type))
    }
}

func encodeMessage(_ message: Message) throws -> Data {
    let encoder = sharedEncoder
    let v = PROTOCOL_VERSION
    switch message {
    case let .hello(id, reId, deviceId, deviceName, appVersion):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "hello",
            payload: HelloPayload(deviceId: deviceId, deviceName: deviceName, appVersion: appVersion)))
    case let .pairRequest(id, reId):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "pair_request", payload: EmptyPayload()))
    case let .pairConfirm(id, reId, code):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "pair_confirm", payload: CodePayload(code: code)))
    case let .auth(id, reId, token):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "auth", payload: TokenPayload(token: token)))
    case let .commandExecute(id, reId, command):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "command.execute", payload: command))
    case let .appsList(id, reId):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "apps.list", payload: EmptyPayload()))
    case let .appsIcon(id, reId, bundleIds):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "apps.icon", payload: BundleIdsPayload(bundleIds: bundleIds)))
    case let .ping(id, reId, t):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "ping", payload: TPayload(t: t)))
    case let .helloAck(id, reId, helperName, helperVersion, capabilities, paired):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "hello_ack",
            payload: HelloAckPayload(helperName: helperName, helperVersion: helperVersion, capabilities: capabilities, paired: paired)))
    case let .pairOk(id, reId, token):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "pair_ok", payload: TokenPayload(token: token)))
    case let .pairError(id, reId, reason):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "pair_error", payload: ReasonPayload(reason: reason)))
    case let .pairPending(id, reId, expiresInMs):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "pair_pending", payload: ExpiresInMsPayload(expiresInMs: expiresInMs)))
    case let .authOk(id, reId):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "auth_ok", payload: EmptyPayload()))
    case let .authError(id, reId, reason):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "auth_error", payload: ReasonPayload(reason: reason)))
    case let .commandResult(id, reId, ok, error):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "command.result", payload: CommandResultPayload(ok: ok, error: error)))
    case let .appsListResponse(id, reId, apps):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "apps.list.response", payload: AppsListResponsePayload(apps: apps)))
    case let .appsIconResponse(id, reId, icons):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "apps.icon.response", payload: AppsIconResponsePayload(icons: icons)))
    case let .pong(id, reId, t):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "pong", payload: TPayload(t: t)))
    case let .error(id, reId, code, message):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "error", payload: ErrorPayload(code: code, message: message)))
    case .unknown:
        throw MessageDecodeError.malformedPayload("unknown")
    }
}
