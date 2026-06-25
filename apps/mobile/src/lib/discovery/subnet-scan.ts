import NetInfo from '@react-native-community/netinfo';
import { MessageSchema } from '@slate/protocol';
import { helloMessage } from '@/lib/ws';

const CONCURRENCY = 24;
const PROBE_TIMEOUT_MS = 800;

// The phone's own Wi-Fi /24 prefix (e.g. "192.168.31."), or null if not on Wi-Fi.
async function subnetPrefix(): Promise<string | null> {
  const state = await NetInfo.fetch();
  const ip = state.type === 'wifi' ? state.details.ipAddress : null;
  if (ip === null || ip === undefined) return null;
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.`;
}

// Resolves the helper name if host:port answers the slate handshake, else null.
function probe(host: string, port: number): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const ws = new WebSocket(`ws://${host}:${port}`);
    const finish = (name: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      resolve(name);
    };
    const timer = setTimeout(() => finish(null), PROBE_TIMEOUT_MS);
    ws.onopen = () => ws.send(JSON.stringify(helloMessage()));
    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const parsed = MessageSchema.safeParse(JSON.parse(event.data));
        if (parsed.success && parsed.data.type === 'hello_ack') {
          finish(parsed.data.payload.helperName);
        }
      } catch {
        finish(null);
      }
    };
    ws.onerror = () => finish(null);
  });
}

// Probe every host on the phone's subnet; report each slate helper as it answers.
export async function scanForHelpers(
  port: number,
  onFound: (host: string, name: string) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const prefix = await subnetPrefix();
  if (prefix === null) return;
  const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}${i + 1}`);
  let next = 0;
  const worker = async () => {
    while (next < hosts.length && !isCancelled()) {
      const host = hosts[next];
      next += 1;
      if (host === undefined) break;
      const name = await probe(host, port);
      if (name !== null && !isCancelled()) onFound(host, name);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
