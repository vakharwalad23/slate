import NetInfo from '@react-native-community/netinfo';
import type { Message } from '@slate/protocol';
import { MessageSchema } from '@slate/protocol';
import { type RediscoveryHandle, startRediscovery } from '@/lib/discovery/rediscovery';
import { pingMessage } from './messages';
import type { Status, Transport, TransportHandlers } from './transport';

const HEARTBEAT_MS = 5000;
const STALE_MS = HEARTBEAT_MS * 2;
const BACKOFF_MIN_MS = 1000;
const BACKOFF_MAX_MS = 30000;
const REDISCOVER_AFTER_FAILS = 3;

let handlers: TransportHandlers | null = null;
let socket: WebSocket | null = null;
let desired: 'connected' | 'disconnected' = 'disconnected';
// Bumped on every connect/disconnect; stale-generation callbacks no-op so old sockets/timers
// can never drive a new connection. This is the core re-entrancy guard.
let generation = 0;
let host = '';
let port = 0;
let backoff = BACKOFF_MIN_MS;
let lastPong = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
// Network-change re-sync: after repeated direct misses, browse for the helper by its Bonjour name and
// follow it to a new IP. Exactly one browse at a time; torn down on connect/disconnect/success.
let helperName: string | null = null;
let rediscovery: RediscoveryHandle | null = null;
let failedDirectAttempts = 0;

function setStatus(status: Status): void {
  handlers?.onStatus(status);
}

function clearHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function clearReconnect(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function stopRediscovery(): void {
  if (rediscovery !== null) {
    rediscovery.stop();
    rediscovery = null;
  }
}

// Start exactly one browse to follow the helper to a new address. No-ops if one is live, if we have no
// name to match, if we don't want to connect, or if a socket is already open.
function beginRediscovery(gen: number): void {
  if (gen !== generation || desired !== 'connected') return;
  if (rediscovery !== null || helperName === null) return;
  if (socket?.readyState === WebSocket.OPEN) return;
  rediscovery = startRediscovery(helperName, (newHost, newPort) => {
    if (gen !== generation || desired !== 'connected') return;
    if (newHost === host && newPort === port) return;
    host = newHost;
    port = newPort;
    stopRediscovery();
    clearReconnect();
    detachSocket();
    backoff = BACKOFF_MIN_MS;
    failedDirectAttempts = 0;
    open();
  });
}

// Detach handlers before close: RN fires onclose asynchronously and it would otherwise re-enter
// the reconnect path against a newer generation, spawning a second socket.
function detachSocket(): void {
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
    socket = null;
  }
}

function onRaw(data: unknown): void {
  if (typeof data !== 'string') return;
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return;
  }
  const parsed = MessageSchema.safeParse(json);
  if (!parsed.success) return;
  if (parsed.data.type === 'pong') {
    lastPong = Date.now();
    return;
  }
  handlers?.onMessage(parsed.data);
}

function startHeartbeat(gen: number): void {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (gen !== generation || !socket) return;
    if (Date.now() - lastPong > STALE_MS) {
      drop(gen);
      return;
    }
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(pingMessage(Date.now())));
  }, HEARTBEAT_MS);
}

function drop(gen: number): void {
  if (gen !== generation) return;
  clearHeartbeat();
  detachSocket();
  if (desired === 'connected') scheduleReconnect(gen);
  else setStatus('disconnected');
}

function scheduleReconnect(gen: number): void {
  if (desired !== 'connected' || gen !== generation || reconnectTimer !== null) return;
  setStatus('connecting');
  failedDirectAttempts += 1;
  if (failedDirectAttempts >= REDISCOVER_AFTER_FAILS) beginRediscovery(gen);
  const delay = backoff;
  backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (desired === 'connected' && gen === generation) open();
  }, delay);
}

// Caller guarantees no live socket (connect/disconnect/drop/netinfo all detach first).
function open(): void {
  const gen = generation;
  setStatus('connecting');
  const ws = new WebSocket(`ws://${host}:${port}`);
  socket = ws;
  ws.onopen = () => {
    if (gen !== generation) return;
    backoff = BACKOFF_MIN_MS;
    failedDirectAttempts = 0;
    stopRediscovery();
    lastPong = Date.now();
    setStatus('connected');
    startHeartbeat(gen);
  };
  ws.onmessage = (event) => {
    if (gen !== generation) return;
    onRaw(event.data);
  };
  ws.onerror = () => {};
  ws.onclose = () => {
    if (gen !== generation) return;
    drop(gen);
  };
}

function connect(h: string, p: number, name?: string): void {
  generation += 1;
  desired = 'connected';
  host = h;
  port = p;
  if (name !== undefined) helperName = name;
  backoff = BACKOFF_MIN_MS;
  failedDirectAttempts = 0;
  clearHeartbeat();
  clearReconnect();
  stopRediscovery();
  detachSocket();
  open();
}

function disconnect(): void {
  generation += 1;
  desired = 'disconnected';
  failedDirectAttempts = 0;
  clearHeartbeat();
  clearReconnect();
  stopRediscovery();
  detachSocket();
  setStatus('disconnected');
}

function send(message: Message): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function setHandlers(next: TransportHandlers): void {
  handlers = next;
}

// Singleton: one NetInfo subscription for the app's lifetime. On regained connectivity while we
// want to be connected, supersede any pending backoff and reconnect immediately.
NetInfo.addEventListener((state) => {
  if (desired !== 'connected') return;
  if (!state.isConnected || state.isInternetReachable === false) return;
  if (socket?.readyState === WebSocket.OPEN) return;
  clearReconnect();
  stopRediscovery();
  detachSocket();
  backoff = BACKOFF_MIN_MS;
  failedDirectAttempts = 0;
  open();
});

export const webSocketTransport: Transport = { setHandlers, connect, disconnect, send };
