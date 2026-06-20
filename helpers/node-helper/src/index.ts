import { PROTOCOL_VERSION } from '@slate/protocol';
import { WebSocketServer } from 'ws';

// M0 smoke server: proves the cross-package TS toolchain + ws. M1 adds bonjour
// advertising, LAN-only binding, and hello / command.execute handling.
const PORT = 8765;

const wss = new WebSocketServer({ port: PORT });

wss.on('listening', () => {
  console.log(`slate helper listening on ws://localhost:${PORT} (protocol v${PROTOCOL_VERSION})`);
});

wss.on('connection', () => {
  console.log('client connected');
});
