import { randomUUID } from 'node:crypto';
import type { MessageOf } from '@slate/protocol';
import { MessageSchema, PROTOCOL_VERSION } from '@slate/protocol';
import { Bonjour } from 'bonjour-service';
import { type RawData, type WebSocket, WebSocketServer } from 'ws';
import { handleMessage } from './dispatch';
import { VoiceSession } from './voice/session';
import { createWeriftEndpoint } from './voice/werift-endpoint';

const PORT = 8765;

// Bind all interfaces so the iOS simulator (localhost) and a LAN phone both reach it.
// A later change narrows this to the chosen LAN address.
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });
const bonjour = new Bonjour();

wss.on('listening', () => {
  bonjour.publish({ name: 'slate helper', type: 'slate', port: PORT });
  console.log(`slate helper listening on ws://0.0.0.0:${PORT} (protocol v${PROTOCOL_VERSION})`);
});

wss.on('connection', (socket) => {
  console.log('client connected');
  const session = new VoiceSession(createWeriftEndpoint);
  // currentCallId comes from the last inbound voice.offer; ICE candidates the endpoint
  // discovers later have no callId of their own, so this is the only way to stamp one.
  let currentCallId: string | null = null;
  session.onIce((candidate) => {
    if (!currentCallId) return;
    const ice: MessageOf<'voice.ice'> = {
      v: PROTOCOL_VERSION,
      id: randomUUID(),
      reId: null,
      type: 'voice.ice',
      payload: { callId: currentCallId, candidate },
    };
    socket.send(JSON.stringify(ice));
  });
  socket.on('message', (data) => {
    onMessage(socket, data, session, (callId) => {
      currentCallId = callId;
    }).catch((err) => {
      console.error('onMessage failed:', err instanceof Error ? err.message : err);
    });
  });
  socket.on('close', () => {
    console.log('client disconnected');
    void session.hangup();
  });
});

async function onMessage(
  socket: WebSocket,
  data: RawData,
  session: VoiceSession,
  setCurrentCallId: (callId: string) => void,
): Promise<void> {
  let json: unknown;
  try {
    json = JSON.parse(data.toString());
  } catch {
    console.warn('dropped non-JSON message');
    return;
  }
  const parsed = MessageSchema.safeParse(json);
  if (!parsed.success) {
    console.warn('dropped invalid message:', parsed.error.issues[0]?.message);
    return;
  }
  if (parsed.data.type === 'voice.offer') setCurrentCallId(parsed.data.payload.callId);
  const reply = await handleMessage(parsed.data, undefined, session);
  if (reply) socket.send(JSON.stringify(reply));
}

function shutdown(): void {
  console.log('shutting down');
  bonjour.unpublishAll(() => {
    bonjour.destroy();
    wss.close(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// Defense-in-depth: dispatch.ts and onMessage already guard every voice-path rejection,
// but a future floating promise must never be able to take down all connected clients.
process.on('unhandledRejection', (err) => {
  console.error('unhandled rejection:', err instanceof Error ? err.message : err);
});
