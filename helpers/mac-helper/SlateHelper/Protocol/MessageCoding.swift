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

    enum CodingKeys: String, CodingKey { case v, id, reId, type, payload }

    // Always emit reId (null when nil). Synthesized Codable omits nil optionals, but the envelope
    // contract + the phone's reId schema require the key present, so an unsolicited push (reId nil,
    // e.g. state.update / pair_pending) would otherwise fail to parse on the phone and be dropped.
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(v, forKey: .v)
        try c.encode(id, forKey: .id)
        if let reId { try c.encode(reId, forKey: .reId) } else { try c.encodeNil(forKey: .reId) }
        try c.encode(type, forKey: .type)
        try c.encode(payload, forKey: .payload)
    }
}

private struct EmptyPayload: Codable {}
private struct TPayload: Codable { let t: Double }
private struct TokenPayload: Codable { let token: String }
private struct ReasonPayload: Codable { let reason: String }
private struct ExpiresInMsPayload: Codable { let expiresInMs: Double }
private struct BundleIdsPayload: Codable { let bundleIds: [String] }
private struct TopicsPayload: Codable { let topics: [String] }
private struct StateUpdatePayload: Codable { let topic: String; let value: String }
private struct ErrorPayload: Codable { let code: String; let message: String }
private struct SecHelloPayload: Decodable { let mode: String; let e: String; let d: String? }
private struct SecHelloOutPayload: Encodable { let mode: String; let e: String; let d: String? }
private struct SecHelloAckOutPayload: Encodable { let mode: String; let e: String; let s: String?; let d: String? }
private struct DPayload: Codable { let d: String }
private struct CPayload: Codable { let c: String }

// Byte fields ride as base64; a decode failure is a malformed frame, dropped like any other.
private func decodeBase64(_ s: String) throws -> Data {
    guard let data = Data(base64Encoded: s) else { throw MessageDecodeError.malformedPayload("base64") }
    return data
}

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
    // A v1 hello is the one legacy frame we answer (update_required) instead of dropping.
    if env.v == 1, env.type == "hello" { return .success(.legacyHello(id: env.id)) }
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
        case "subscribe.state":
            let f = try decoder.decode(InFrame<TopicsPayload>.self, from: data)
            return .success(.subscribeState(id: f.id, reId: f.reId, topics: f.payload.topics))
        case "ping":
            let f = try decoder.decode(InFrame<TPayload>.self, from: data)
            return .success(.ping(id: f.id, reId: f.reId, t: f.payload.t))
        case "sec_hello":
            let f = try decoder.decode(InFrame<SecHelloPayload>.self, from: data)
            let d = try f.payload.d.map(decodeBase64)
            return .success(.secHello(id: f.id, reId: f.reId, mode: f.payload.mode, e: try decodeBase64(f.payload.e), d: d))
        case "sec_confirm":
            let f = try decoder.decode(InFrame<DPayload>.self, from: data)
            return .success(.secConfirm(id: f.id, reId: f.reId, d: try decodeBase64(f.payload.d)))
        case "enc":
            let f = try decoder.decode(InFrame<CPayload>.self, from: data)
            return .success(.enc(id: f.id, reId: f.reId, c: try decodeBase64(f.payload.c)))
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
    case let .auth(id, reId, token):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "auth", payload: TokenPayload(token: token)))
    case let .commandExecute(id, reId, command):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "command.execute", payload: command))
    case let .appsList(id, reId):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "apps.list", payload: EmptyPayload()))
    case let .appsIcon(id, reId, bundleIds):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "apps.icon", payload: BundleIdsPayload(bundleIds: bundleIds)))
    case let .subscribeState(id, reId, topics):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "subscribe.state", payload: TopicsPayload(topics: topics)))
    case let .ping(id, reId, t):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "ping", payload: TPayload(t: t)))
    case let .helloAck(id, reId, helperName, helperVersion, capabilities, paired):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "hello_ack",
            payload: HelloAckPayload(helperName: helperName, helperVersion: helperVersion, capabilities: capabilities, paired: paired)))
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
    case let .stateUpdate(id, reId, topic, value):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "state.update", payload: StateUpdatePayload(topic: topic, value: value)))
    case let .pong(id, reId, t):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "pong", payload: TPayload(t: t)))
    case let .error(id, reId, code, message):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "error", payload: ErrorPayload(code: code, message: message)))
    case let .secHello(id, reId, mode, e, d):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "sec_hello",
            payload: SecHelloOutPayload(mode: mode, e: e.base64EncodedString(), d: d?.base64EncodedString())))
    case let .secConfirm(id, reId, d):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "sec_confirm", payload: DPayload(d: d.base64EncodedString())))
    case let .enc(id, reId, c):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "enc", payload: CPayload(c: c.base64EncodedString())))
    case let .secHelloAck(id, reId, mode, e, s, d):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "sec_hello_ack",
            payload: SecHelloAckOutPayload(mode: mode, e: e.base64EncodedString(), s: s?.base64EncodedString(), d: d?.base64EncodedString())))
    case let .secConfirmAck(id, reId, d):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "sec_confirm_ack", payload: DPayload(d: d.base64EncodedString())))
    case let .secError(id, reId, code, message):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "sec_error", payload: ErrorPayload(code: code, message: message)))
    case .legacyHello, .unknown:
        throw MessageDecodeError.malformedPayload("unencodable")
    }
}

// A v1-shaped error an outdated (v1) app can still parse, sent just before the socket closes.
func legacyUpdateRequiredFrame(reId: String) -> Data {
    let obj: [String: Any] = [
        "v": 1,
        "id": newMessageId(),
        "reId": reId,
        "type": "error",
        "payload": ["code": "update_required", "message": "Update the slate helper and app to a matching version"],
    ]
    return (try? JSONSerialization.data(withJSONObject: obj)) ?? Data()
}
