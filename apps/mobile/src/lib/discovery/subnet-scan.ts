import NetInfo from '@react-native-community/netinfo';
import { MessageSchema } from '@slate/protocol';
import { helloMessage } from '@/lib/ws';

// 24 saturated the Wi-Fi radio: ~250 dead hosts each holding a slot for the full timeout starved the
// real helper's handshake, so it was missed most passes (diagnostics showed openTO=0 + intermittent
// ack). 10 trims the air congestion; the sweep is slower but reliable, and the last-known-host fast
// path makes the common case instant regardless.
const CONCURRENCY = 10;
const PROBE_TIMEOUT_MS = 800;
// NetInfo often has not resolved the Wi-Fi IP yet right after launch, so retry before giving up
// (a single fetch was the cause of the first-scan-finds-nothing bug).
const SUBNET_RETRIES = 8;
const SUBNET_RETRY_MS = 400;

type ProbeOutcome = 'helloAck' | 'openTimeout' | 'timeout' | 'error';

// Temporary diagnostic surface for the first-scan-misses bug: aggregated per pass so the in-app log
// gets one line, not 254. Plumbed via a callback to keep this module store-free.
export type ScanDiag = {
  prefix: string | null;
  subnetAttempts: number;
  hostsProbed: number;
  outcomes: Record<ProbeOutcome, number>;
  found: number;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The phone's own Wi-Fi /24 prefix (e.g. "192.168.31."), or null if not on Wi-Fi after retrying;
// attempts reports how many NetInfo fetches it took (1 == resolved on the first try).
async function subnetPrefix(
  isCancelled: () => boolean,
): Promise<{ prefix: string | null; attempts: number }> {
  for (let attempt = 0; attempt < SUBNET_RETRIES; attempt += 1) {
    if (isCancelled()) return { prefix: null, attempts: attempt };
    const state = await NetInfo.fetch();
    const ip = state.type === 'wifi' ? state.details.ipAddress : null;
    if (ip !== null && ip !== undefined) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return { prefix: `${parts[0]}.${parts[1]}.${parts[2]}.`, attempts: attempt + 1 };
      }
    }
    await delay(SUBNET_RETRY_MS);
  }
  return { prefix: null, attempts: SUBNET_RETRIES };
}

// Resolves the helper name if host:port answers the slate handshake, plus the terminal outcome:
// openTimeout (socket opened but no hello_ack in time) vs timeout (never opened) separates a slow
// handshake from an unreachable host.
function probe(
  host: string,
  port: number,
): Promise<{ name: string | null; outcome: ProbeOutcome }> {
  return new Promise((resolve) => {
    let settled = false;
    let opened = false;
    const ws = new WebSocket(`ws://${host}:${port}`);
    const finish = (name: string | null, outcome: ProbeOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      resolve({ name, outcome });
    };
    const timer = setTimeout(
      () => finish(null, opened ? 'openTimeout' : 'timeout'),
      PROBE_TIMEOUT_MS,
    );
    ws.onopen = () => {
      opened = true;
      ws.send(JSON.stringify(helloMessage()));
    };
    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const parsed = MessageSchema.safeParse(JSON.parse(event.data));
        if (parsed.success && parsed.data.type === 'hello_ack') {
          finish(parsed.data.payload.helperName, 'helloAck');
        }
      } catch {
        finish(null, 'error');
      }
    };
    ws.onerror = () => finish(null, 'error');
  });
}

// A single clean handshake to a known host, probed before the wide sweep starts so it answers
// without the radio congestion that starves it mid-sweep.
export async function probeHelper(host: string, port: number): Promise<string | null> {
  return (await probe(host, port)).name;
}

// Probe every host on the phone's subnet; report each slate helper as it answers. Returns false if no
// Wi-Fi subnet could be determined (so the caller can surface "enter the host manually").
export async function scanForHelpers(
  port: number,
  onFound: (host: string, name: string) => void,
  isCancelled: () => boolean,
  onDiag?: (diag: ScanDiag) => void,
): Promise<boolean> {
  const outcomes: Record<ProbeOutcome, number> = {
    helloAck: 0,
    openTimeout: 0,
    timeout: 0,
    error: 0,
  };
  const { prefix, attempts } = await subnetPrefix(isCancelled);
  if (prefix === null) {
    onDiag?.({ prefix: null, subnetAttempts: attempts, hostsProbed: 0, outcomes, found: 0 });
    return false;
  }
  const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}${i + 1}`);
  let found = 0;
  let next = 0;
  const worker = async () => {
    while (next < hosts.length && !isCancelled()) {
      const host = hosts[next];
      next += 1;
      if (host === undefined) break;
      const { name, outcome } = await probe(host, port);
      outcomes[outcome] += 1;
      if (name !== null && !isCancelled()) {
        found += 1;
        onFound(host, name);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  onDiag?.({ prefix, subnetAttempts: attempts, hostsProbed: hosts.length, outcomes, found });
  return true;
}
