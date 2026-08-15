import { randomUUID } from 'node:crypto';
import type { Capabilities, Message, MessageOf } from '@slate/protocol';
import { PROTOCOL_VERSION } from '@slate/protocol';
import { executeCommand, type Run } from './commands';
import type { VoiceSession } from './voice/session';

const HELPER_NAME = 'slate helper';
const HELPER_VERSION = '1.1.0';

const BASE_CAPABILITIES: Omit<Capabilities, 'voiceIntercom'> = {
  launchApps: true,
  runShortcuts: false,
  runShell: false,
  keystrokes: false,
  appList: false,
  appIcons: false,
  liveState: false,
};

// Replies inline-annotated with MessageOf<...> so each literal stays narrowed; a generic
// builder would widen `type` to string and collapse the discriminated union.
export async function handleMessage(
  msg: Message,
  run?: Run,
  session?: VoiceSession,
): Promise<Message | null> {
  switch (msg.type) {
    case 'hello': {
      const ack: MessageOf<'hello_ack'> = {
        v: PROTOCOL_VERSION,
        id: randomUUID(),
        reId: msg.id,
        type: 'hello_ack',
        payload: {
          helperName: HELPER_NAME,
          helperVersion: HELPER_VERSION,
          capabilities: { ...BASE_CAPABILITIES, voiceIntercom: session !== undefined },
          paired: false,
        },
      };
      return ack;
    }
    case 'voice.offer': {
      if (!session) return null;
      const sdp = await session.handleOffer(msg.payload.sdp);
      const answer: MessageOf<'voice.answer'> = {
        v: PROTOCOL_VERSION,
        id: randomUUID(),
        reId: msg.id,
        type: 'voice.answer',
        payload: { callId: msg.payload.callId, sdp },
      };
      return answer;
    }
    case 'voice.ice': {
      if (session) await session.addIce(msg.payload.candidate);
      return null;
    }
    case 'voice.hangup': {
      if (session) await session.hangup();
      return null;
    }
    case 'command.execute': {
      const result = await executeCommand(msg.payload, run);
      const res: MessageOf<'command.result'> = {
        v: PROTOCOL_VERSION,
        id: randomUUID(),
        reId: msg.id,
        type: 'command.result',
        payload: { ok: result.ok, ...(result.error !== undefined && { error: result.error }) },
      };
      return res;
    }
    case 'ping': {
      const pong: MessageOf<'pong'> = {
        v: PROTOCOL_VERSION,
        id: randomUUID(),
        reId: msg.id,
        type: 'pong',
        payload: { t: msg.payload.t },
      };
      return pong;
    }
    default:
      return null;
  }
}
