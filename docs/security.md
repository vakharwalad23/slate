# Security

slate encrypts the phone <-> Mac link end to end. This document is the threat model, the handshake
and key-schedule spec, and the reasoning behind the design.

## What is protected

The transport is plain `ws://` on the LAN, but every byte of application traffic rides inside an
authenticated encrypted channel (protocol v2). After a one-time pairing:

- Commands, app lists, icons, live-state updates, the bearer token, and even ping/pong are sealed
  with ChaCha20-Poly1305 inside `enc` frames. Only `hello`/`hello_ack` (which carry no secrets) and
  the handshake frames themselves are ever plaintext.
- A same-LAN attacker who sniffs the wire sees only ciphertext and ephemeral public keys. They cannot
  read commands, steal the token, or replay a captured frame.
- An active man-in-the-middle cannot impersonate the helper: the phone pins the helper's long-term
  identity key at pairing, and the pairing code authenticates the first handshake.

What is deliberately out of scope: a local user on the Mac itself (the helper trusts its own machine),
and denial of service on an untrusted network (an attacker who controls the LAN can always drop
packets). Pairing on a hostile network during the ceremony has a narrow residual risk - see Pairing.

## Cryptographic building blocks

- X25519 for key agreement, HKDF-SHA256 for key derivation, ChaCha20-Poly1305 (IETF, RFC 8439) for
  authenticated encryption. A hand-rolled fixed Noise-style pattern - the same approach WireGuard,
  Lightning BOLT 8, and Tailscale ship.
- Phone: pure-JS `@noble/curves` / `@noble/ciphers` / `@noble/hashes` (audited, no native modules).
  Helper: Apple CryptoKit. The two implementations are pinned byte-for-byte by a shared vector file
  (see Test vectors below).
- Nonces are never on the wire: each direction uses an implicit 64-bit counter, encoded as 4 zero
  bytes followed by the little-endian counter. A fresh handshake per connection gives forward secrecy
  and makes cross-session replay impossible.

## Pairing (first time)

The helper generates a high-entropy pairing secret (120-bit) per pairing window and shows it as a QR
(`slate://pair?h=<host>&p=<port>&c=<code>`) plus a typeable base64url code, with a TTL and countdown.
The phone scans or types it.

The pair handshake is NX+psk-shaped:

1. Phone -> `sec_hello{ e }` (its ephemeral public key).
2. Helper -> `sec_hello_ack{ e, s }` - its ephemeral key plus its static identity key, encrypted
   under the ephemeral-derived key. Nothing keyed by the pairing code is emitted yet.
3. Phone mixes the code (as the psk) and sends `sec_confirm{ d }` - a key-confirmation the helper can
   only open if the phone used the right code.
4. Helper opens it (wrong code -> AEAD failure -> `sec_error{ bad_code }`, counted toward the
   lockout), then issues the bearer token inside `sec_confirm_ack{ d }`. The token never appears as a
   plaintext frame.
5. Phone pins the helper's static key and stores the token.

Residual risk: the pairing code is the only secret binding that first exchange, so an active MITM
present during the pairing ceremony could capture the psk-keyed `sec_confirm` and attack the code
offline. The 120-bit code makes that infeasible, and the online lockout caps guessing at the helper.
Every reconnect after pairing is protected regardless. Recommendation: pair on a network you trust.

## Reconnect (no code)

A paired phone reconnects without the code using an NK-shaped handshake:

1. Phone -> `sec_hello{ e, d }`, encrypting to the pinned helper static key. If the helper's identity
   ever changed, this fails to open and the phone is told to re-pair (it keeps its stored token/pin -
   only a successful re-pair overwrites them, so a MITM cannot force a silent trust reset).
2. Helper -> `sec_hello_ack{ e, d }`; both sides derive the session keys.
3. Phone sends `auth{ token }` inside the now-encrypted channel; the helper validates it and replies
   `auth_ok` (or `auth_error` if the token was revoked). Commands run only after `auth_ok`.

## Key schedule

A SymmetricState per handshake attempt (clock-free - only hashes and counters):

- `h = SHA256("slate/sec/v2/x25519-hkdf-sha256-chacha20poly1305")`; `ck = h`; `k = none`; `n = 0`.
- `mixHash(x)`: `h = SHA256(h || x)`.
- `mixKey(ikm)`: `okm = HKDF-SHA256(ikm, salt=ck, info="slate/v2/mix", 64)`; `ck = okm[0:32]`;
  `k = okm[32:64]`; `n = 0`.
- `encryptAndHash`/`decryptAndHash`: ChaCha20-Poly1305 with `nonce = zeros(4) || LE64(n)` and `ad = h`;
  then `n += 1` and `mixHash(ciphertext)`.
- `split()`: `HKDF-SHA256(empty, salt=ck, info="slate/v2/split", 64)` -> a send key per direction.
- `psk = HKDF-SHA256(codeBytes, salt="slate/psk/v2", 32)` - format-agnostic, so the code can be any
  encoding of the same bytes.

## Why this is safe to open-source

Security rests on the secrecy of the keys, never on the secrecy of the code (Kerckhoffs's principle -
the same reason TLS, Signal, WireGuard, and SSH are all open source and are trusted *because* they are
auditable). Everything an attacker needs is generated fresh at runtime from the OS CSPRNG and never
committed:

- Ephemeral keys - a new random pair every handshake, discarded after.
- The helper's static identity - random on first launch, in `identity.json` (0600) on the Mac only.
- The pairing secret - random per window, shown transiently on the Mac.
- The token and all session keys - random / derived, in secure storage or memory.

An attacker with the entire source tree still cannot derive a live session key: it comes from a
Diffie-Hellman exchange whose private halves never leave the two devices.

### Test vectors are not runtime keys

`packages/protocol/fixtures/crypto-vectors.json` contains fixed, hardcoded inputs (ephemerals, a
static key, a pairing code, a token). These are **known-answer test vectors only** - exactly like the
RFC 8439 ChaCha20 vector that sits beside them. They exist so the phone (noble) and helper (CryptoKit)
can be checked for byte-for-byte agreement in CI. They are never used at runtime and reveal nothing
about any real session. Deleting them would remove a safety net, not add security.

## Storage

| Secret | Where | Notes |
|---|---|---|
| Helper static identity | `~/Library/Application Support/slate-helper/identity.json` (0600) | Not Keychain: ad-hoc signing churns the cdhash and breaks Keychain ACLs; a 0600 file matches the token store's rationale. |
| Paired device tokens | `.../slate-helper/devices.json` (0600) | Bearer secrets the helper issues, not user credentials. |
| Phone token + pinned helper key | iOS/Android secure store (`expo-secure-store`) | Cleared by Settings -> Clear all data. |

## Identity rotation

Delete `identity.json` and relaunch the helper to rotate its identity. Every paired phone then sees a
`bad_handshake` on reconnect and is prompted to pair again - never silent re-trust.

## Lockout

Wrong codes are rate-limited at helper (actor) scope: after 5 failures the service locks for an
exponentially growing window (30s -> 300s). Spamming `pair_request` cannot reset it, and it is global
across connections. Regression: `helpers/mac-helper/scripts/brute-force-pairing.test.mjs` drives the
real handshake with wrong secrets against a live helper.

## The Node helper is not for production

`helpers/node-helper` is an unencrypted, unauthenticated development stub (it speaks v1 plaintext and
only proves the command loop). It has no pairing, no token check, and no crypto. Do not expose it on a
network; use the Swift helper for anything real.

## Manual verification checklist

- Packet-capture a pairing and a reconnect: no code, token, or command appears in cleartext.
- Enter a wrong code 5 times: lockout, not endless retries.
- Revoke the device on the Mac: the phone drops and must re-pair.
- Delete `identity.json`, relaunch: paired phones are told the identity changed and must re-pair.
- Point an old (v1) app at a v2 helper: it gets `update_required`; a v2 app at a v1 helper shows the
  "helper needs update" hint.
