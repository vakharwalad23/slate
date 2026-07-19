import * as Crypto from 'expo-crypto';

// The only entropy source for keys and the handshake. expo-crypto's native CSPRNG, never
// globalThis.crypto (not guaranteed on Hermes). Injected into the protocol crypto so the byte
// contract stays platform-agnostic and testable with fixed bytes.
export function randomBytes(length: number): Uint8Array {
  return Crypto.getRandomBytes(length);
}

// Startup smoke check: two draws are full length, non-zero, and distinct. A failure means the
// platform RNG is broken - the caller must refuse to connect (fail closed) rather than emit keys
// from a dead source.
export function assertRng(): void {
  const a = randomBytes(32);
  const b = randomBytes(32);
  if (a.length !== 32 || b.length !== 32) throw new Error('rng: unexpected length');
  let allZero = true;
  let identical = true;
  for (let i = 0; i < 32; i++) {
    if (a[i] !== 0) allZero = false;
    if (a[i] !== b[i]) identical = false;
  }
  if (allZero) throw new Error('rng: all-zero output');
  if (identical) throw new Error('rng: two draws identical');
}
