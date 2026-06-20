---
paths:
  - "**/*.swift"
---

# SwiftUI / Swift (macOS menu-bar helper)

Swift 6.2, macOS 13+. Optimize for low RAM, zero leaks, no locks, modular.

## State & ownership

- `@Observable` (Observation framework) for all observable models — never `ObservableObject` /
  `@Published` in new code.
- The owner view holds it with `@State`; pass undecorated for read-only, `@Bindable` for a
  binding. Never create an `@Observable` in a child without ownership.
- Value types (`struct`) by default — payloads, config, intermediates. A `class` only for
  reference identity or a long-lived service, injected via `init` (no singletons).

## Concurrency — actors, not locks

- No `NSLock`, `os_unfair_lock`, `DispatchSemaphore`, or `DispatchGroup` for shared mutable
  state. Wrap it in an `actor`.
- Never block a cooperative thread (no semaphore inside an `async` function) — it deadlocks the pool.
- `@MainActor` for UI / observed state; `@concurrent nonisolated` for genuine CPU work (JSON
  decode, icon compositing). Prefer structured concurrency (`async let`, `withTaskGroup`) over
  `Task.detached`.
- `[weak self]` only for a stored Task running an indefinite loop (e.g. an `AsyncStream` of
  connections); short-lived Tasks don't need it.

## Low RAM

- `LazyVStack` / `LazyHStack` for variable-length lists; defer per-row data with `.task {}`.
- Icons in `NSCache` (`countLimit` + `totalCostLimit`); prefer SF Symbols for the status item.
  Release `CGImage` / `CGContext` immediately after render — don't retain them in properties.
- `autoreleasepool` per iteration in AppKit image-render loops (profile with Instruments first;
  never add speculatively).

## Structure

- One type, one responsibility: separate the `NWListener` server / command executor / icon
  pipeline / Bonjour. Wire the dependency graph once at the app entry point.
- Bonjour advertises via the dns-sd C API (`DNSServiceRegister`), not `NWListener.Service`
  (broken on macOS 15.4+, Apple bug FB14321888).
