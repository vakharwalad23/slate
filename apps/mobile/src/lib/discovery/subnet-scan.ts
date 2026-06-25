import NetInfo from '@react-native-community/netinfo';
import { MessageSchema } from '@slate/protocol';
import { helloMessage } from '@/lib/ws';

const CONCURRENCY = 24;
const PROBE_TIMEOUT_MS = 800;
// NetInfo often has not resolved the Wi-Fi IP yet right after launch, so retry before giving up
// (a single fetch was the cause of the first-scan-finds-nothing bug).
const SUBNET_RETRIES = 8;
const SUBNET_RETRY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The phone's own Wi-Fi /24 prefix (e.g. "192.168.31."), or null if not on Wi-Fi after retrying.
async function subnetPrefix(isCancelled: () => boolean): Promise<string | null> {
  for (let attempt = 0; attempt < SUBNET_RETRIES; attempt += 1) {
    if (isCancelled()) return null;
    const state = await NetInfo.fetch();
    const ip = state.type === 'wifi' ? state.details.ipAddress : null;
    if (ip !== null && ip !== undefined) {
      const parts = ip.split('.');
      if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.`;
    }
    await delay(SUBNET_RETRY_MS);
  }
  return null;
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

// Probe every host on the phone's subnet; report each slate helper as it answers. Returns false if no
// Wi-Fi subnet could be determined (so the caller can surface "enter the host manually").
export async function scanForHelpers(
  port: number,
  onFound: (host: string, name: string) => void,
  isCancelled: () => boolean,
): Promise<boolean> {
  const prefix = await subnetPrefix(isCancelled);
  if (prefix === null) return false;
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
  return true;
}
