import Foundation

enum MessageDecodeError: Error, Equatable {
    case notJSON
    case badEnvelope
    case malformedPayload(String)
}

// Lowercased so the phone's z.uuid() accepts it; an unparsed reply is silently dropped at its boundary.
func newMessageId() -> String { UUID().uuidString.lowercased() }

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

private struct HelloPayload: Decodable {
    let deviceId: String
    let deviceName: String
    let appVersion: String
}

private struct TPayload: Codable { let t: Double }

private struct OutFrame<P: Encodable>: Encodable {
    let v: Int
    let id: String
    let reId: String?
    let type: String
    let payload: P
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

private struct DeviceHelloPayload: Encodable {
    let deviceId: String
    let deviceName: String
    let appVersion: String
}

// safeParse analogue: never throws into the receive loop; drop on failure.
func decodeMessage(_ data: Data) -> Result<Message, MessageDecodeError> {
    let decoder = JSONDecoder()
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
        case "ping":
            let f = try decoder.decode(InFrame<TPayload>.self, from: data)
            return .success(.ping(id: f.id, reId: f.reId, t: f.payload.t))
        case "command.execute":
            let f = try decoder.decode(InFrame<Command>.self, from: data)
            return .success(.commandExecute(id: f.id, reId: f.reId, command: f.payload))
        default:
            return .success(.unknown(type: env.type, id: env.id, reId: env.reId))
        }
    } catch {
        return .failure(.malformedPayload(env.type))
    }
}

func encodeMessage(_ message: Message) throws -> Data {
    let encoder = JSONEncoder()
    let v = PROTOCOL_VERSION
    switch message {
    case let .hello(id, reId, deviceId, deviceName, appVersion):
        return try encoder.encode(OutFrame(
            v: v, id: id, reId: reId, type: "hello",
            payload: DeviceHelloPayload(deviceId: deviceId, deviceName: deviceName, appVersion: appVersion)
        ))
    case let .helloAck(id, reId, helperName, helperVersion, capabilities, paired):
        return try encoder.encode(OutFrame(
            v: v, id: id, reId: reId, type: "hello_ack",
            payload: HelloAckPayload(helperName: helperName, helperVersion: helperVersion, capabilities: capabilities, paired: paired)
        ))
    case let .ping(id, reId, t):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "ping", payload: TPayload(t: t)))
    case let .pong(id, reId, t):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "pong", payload: TPayload(t: t)))
    case let .commandExecute(id, reId, command):
        return try encoder.encode(OutFrame(v: v, id: id, reId: reId, type: "command.execute", payload: command))
    case let .commandResult(id, reId, ok, error):
        return try encoder.encode(OutFrame(
            v: v, id: id, reId: reId, type: "command.result",
            payload: CommandResultPayload(ok: ok, error: error)
        ))
    case .unknown:
        throw MessageDecodeError.malformedPayload("unknown")
    }
}
