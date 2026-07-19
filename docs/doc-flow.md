# Flows

End-to-end flows across the app and the helper, in sequence form. Update when a flow's steps,
message types, or failure handling change. (If "doc flow" was meant as something else - e.g. a
pure data-flow/state-diagram doc - say so and this is repurposed.)

## Discovery -> connect

```
app                         helper
 |  browse _slate._tcp  -->  (advertises via dns-sd)
 |  <-- service (host, port)
 |  subnet /24 WS-handshake scan in parallel (reliable path when mDNS is unavailable)
 |  (or user enters host:port manually - always available)
 |  open ws://host:port  -->
 |  hello                -->
 |  <-- hello_ack { capabilities, paired }
```

Android emulators don't forward multicast and react-native-zeroconf is unavailable on the New Arch
Android build, so `subnet-scan.ts` (probe every host on the phone's /24 with the WS hello handshake)
is the primary auto-discovery there; manual entry is the guaranteed fallback. iOS needs the
local-network permission + `NSBonjourServices`.

## Pairing (code-authenticated X25519; see security.md)

```
app                             helper
 |  pair_request           -->   shows QR + code (TTL <=120s, rate-limited)
 |  <-- pair_pending { expiresInMs }     (time left only; phone shows a countdown)
 |  sec_hello { e }        -->                (e = phone ephemeral)
 |  <-- sec_hello_ack { e, s }            (s = helper static key, encrypted)
 |  sec_confirm { d }      -->   opens d with the code (psk); wrong -> sec_error{bad_code}
 |  <-- sec_confirm_ack { d }             (token issued INSIDE the encrypted channel)
 |  ...phone pins the helper static key + stores the token; channel is now secure
```

## Command execute (inside the encrypted channel)

```
app                             helper
 |  build semantic Command
 |  enc(command.execute(Cmd)) -->  open -> executor maps Cmd -> macOS action
 |  <-- enc(command.result { ok, error? })
```

## Reconnect (codeless; NK handshake to the pinned key)

```
app                             helper
 |  sec_hello { e, d }     -->   d encrypted to the pinned static; mismatch -> sec_error{bad_handshake}
 |  <-- sec_hello_ack { e, d }            (both derive session keys)
 |  enc(auth { token })    -->   <-- enc(auth_ok)   (or auth_error if revoked)
```

## Icon fetch + cache

```
app: need icon(bundleId)
 |  cached at current iconVersion? --> render from MMKV, no request
 |  else apps.icon { bundleIds } --> helper renders PNG (256px)
 |  <-- apps.icon.response { pngBase64, iconVersion }  (one per message)
 |  store in MMKV under bundleId + iconVersion
```

## Reconnect

Auto-reconnect with backoff; status pill Connected / Reconnecting / Offline. JSON `ping`/`pong`
every ~10s; drop + reconnect after a missed window. Commands while offline are rejected with a
toast, never silently dropped.

## Network-change rediscovery

```
(Mac IP changes)
helper: NetworkMonitor detects path change (debounced)
helper: BonjourAdvertiser re-registers _slate._tcp with new address
app: repeated direct reconnect misses trigger lib/discovery/rediscovery.ts
app: browses _slate._tcp for stored helperName -> resolves new host:port
app: reconnects + re-auths as normal
```

Exactly one socket and one browse are live at any time; generation/desired guards prevent races
during the IP-change switchover.

## Revoke

```
helper: user revokes device from menu
helper: TokenStore removes token
helper: ConnectionRegistry.closeIfDevice -> closes live socket for that device
app: receives close, enters reconnect path -> auth fails -> enters needs_pairing
```

## Live-state subscribe

```
app                         helper
 |  (once paired/authed, inside enc, gated on capabilities.liveState)
 |  enc(subscribe.state { topics: ["foregroundApp"] })  -->
 |                          ForegroundMonitor starts; pushes current frontmost immediately
 |  <-- enc(state.update { topic: "foregroundApp", value: bundleId })
 |  setForegroundApp(bundleId)
 |  if a deck's autoProfile.matchBundleId matches -> switch to that deck
 |       ...repeated on every NSWorkspace app-activation notification
 |  (disconnect: foregroundApp cleared; ForegroundMonitor.stop() removes the observer)
```

ForegroundMonitor lives in ClientSession.swift; no Accessibility permission needed. A re-subscribe
or empty topic list replaces any existing monitor cleanly.

## Per-button gesture dispatch

```
DeckButtonCell (view mode)
  tap          -> sendCommand(button.action)
  long-press   -> sendCommand(gestures.longPress)   [only if assigned]
  double-tap   -> sendCommand(gestures.doubleTap)   [only if assigned; Exclusive with single tap]
  swipe(dir)   -> sendCommand(gestures.swipe<Dir>)  [only if assigned; Pan.blocksExternalGesture
                  wins over the grid page-nav pan]
  fast path: buttons with no double-tap and no swipe use PressableScale (no RNGC overhead)

SortableGrid (edit mode, pencil toggle)
  quick tap (<200 ms)  -> router.push /deck/button/:id  (opens editor)
  hold + drag          -> reorder  (Pan.activateAfterLongPress 160 ms, Exclusive over tap)
```
