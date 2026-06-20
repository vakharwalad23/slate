import { MessageSchema, PROTOCOL_VERSION } from '@slate/protocol';
import { Bonjour } from 'bonjour-service';
import { type RawData, type WebSocket, WebSocketServer } from 'ws';
import { handleMessage } from './dispatch';

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
  socket.on('message', (data) => {
    void onMessage(socket, data);
  });
  socket.on('close', () => console.log('client disconnected'));
});

async function onMessage(socket: WebSocket, data: RawData): Promise<void> {
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
  const reply = await handleMessage(parsed.data);
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
