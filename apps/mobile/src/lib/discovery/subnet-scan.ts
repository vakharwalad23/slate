import NetInfo from '@react-native-community/netinfo';
import { MessageSchema } from '@slate/protocol';
import { helloMessage } from '@/lib/ws';

// 24 saturated the Wi-Fi radio: ~250 dead hosts each holding a slot for the full timeout starved the
// real helper's handshake, so it was missed most passes. 10 trims the air congestion; the sweep is
// slower but reliable, and the last-known-host fast path makes the common case instant regardless.
const CONCURRENCY = 10;
const PROBE_TIMEOUT_MS = 800;
// NetInfo often has not resolved the Wi-Fi IP yet right after launch, so retry before giving up
// (a single fetch was the cause of the first-scan-finds-nothing bug).
const SUBNET_RETRIES = 8;
const SUBNET_RETRY_MS = 400;

// Routers, servers, and static leases cluster in the low range, so probe .1-.20 first; a stale
// last-known octet is tried before anything. This finds the helper in the first batch instead of
// ~20s into a linear sweep - the fix for "the scan sometimes never finds the Mac" (it did, too late).
const GATEWAY_ADJACENT = 20;

function scanOrder(preferredOctet: number | null): number[] {
  const low: number[] = [];
  const high: number[] = [];
  for (let i = 1; i <= 254; i += 1) (i <= GATEWAY_ADJACENT ? low : high).push(i);
  const ordered = [...low, ...high];
  if (preferredOctet !== null) {
    const idx = ordered.indexOf(preferredOctet);
    if (idx > 0) {
      ordered.splice(idx, 1);
      ordered.unshift(preferredOctet);
    }
  }
  return ordered;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// Exported for the fast path: a single clean probe of a known host, before the wide sweep saturates
// the radio.
export function probeHelper(host: string, port: number): Promise<string | null> {
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

// Returns false if no Wi-Fi subnet could be determined, so the caller can surface "enter the host
// manually".
export async function scanForHelpers(
  port: number,
  onFound: (host: string, name: string) => void,
  isCancelled: () => boolean,
  preferredHost?: string,
): Promise<boolean> {
  const prefix = await subnetPrefix(isCancelled);
  if (prefix === null) return false;
  // Prioritize the last-known host's octet only if it is on this same subnet.
  const preferredOctet =
    preferredHost !== undefined && preferredHost.startsWith(prefix)
      ? Number(preferredHost.slice(prefix.length)) || null
      : null;
  const hosts = scanOrder(preferredOctet).map((octet) => `${prefix}${octet}`);
  let next = 0;
  const worker = async () => {
    while (next < hosts.length && !isCancelled()) {
      const host = hosts[next];
      next += 1;
      if (host === undefined) break;
      const name = await probeHelper(host, port);
      if (name !== null && !isCancelled()) onFound(host, name);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return true;
}
