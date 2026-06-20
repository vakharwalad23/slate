# Flows

End-to-end flows across the app and the helper, in sequence form. Update when a flow's steps,
message types, or failure handling change. (If "doc flow" was meant as something else — e.g. a
pure data-flow/state-diagram doc — say so and this is repurposed.)

## Discovery → connect

```
app                         helper
 |  browse _slate._tcp  -->  (advertises via dns-sd)
 |  <-- service (host, port)
 |  (or user enters host:port manually — always available)
 |  open ws://host:port  -->
 |  hello                -->
 |  <-- hello_ack { capabilities, paired }
```

Android emulators don't forward multicast → discovery is tested on a physical device; manual
entry is the guaranteed fallback. iOS needs the local-network permission + `NSBonjourServices`.

## Pairing

```
app                         helper
 |  pair_request         -->  shows 6-digit code (TTL ≤120s, rate-limited)
 |  pair_confirm { code }-->
 |  <-- pair_ok { token }     (token stored in expo-secure-store)
```

## Command execute

```
app                         helper
 |  build semantic Command
 |  auth { token }       -->  <-- auth_ok
 |  command.execute(Cmd) -->  executor maps Cmd -> macOS action
 |  <-- command.result { ok, error? }
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
