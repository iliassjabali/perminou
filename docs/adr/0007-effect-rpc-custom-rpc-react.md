# 0007 — API: @effect/rpc with a custom `rpc-react` library (not tRPC)

**Status:** Accepted — with a revisit trigger

## Context

The app is online and makes many reactive queries (categories, chapters, questions, exams), so it needs a react-query-style data layer (caching, refetch, persistence). Two ways to get there in an all-Effect stack:

- **tRPC + @tanstack/react-query** — mature, documented, proven on React Native.
- **@effect/rpc + a custom react-query binding we own** — Effect-native, typed errors *over the wire*, one paradigm end-to-end, no non-Effect framework in the stack.

Research on `@effect/rpc` client maturity for Expo/RN (mid-2026): it's `0.x` (~0.75), undocumented on the official site, mid-migration to Effect v4, and has **no evidence of a shipped Expo/RN production app**. Effect core runs on Hermes with polyfills (Expo SDK 54+ covers most).

## Decision

Use **`@effect/rpc`**, served over **Hono**, with a **custom monorepo library** providing the tRPC-style hook DX. **No tRPC dependency.** Two packages:

- **`packages/rpc-contract`** — `RpcGroup` definitions (payload/success/error as Effect Schema), imported by both backend (implements handlers) and mobile (typed client). This is the "router." Typed errors travel over the wire.
- **`packages/rpc-react`** — the owned library: wraps the `@effect/rpc` HTTP client + react-query, exposing `useRpcQuery(rpc, payload)` / `useRpcMutation(rpc)` (queryKey derived from the RPC tag + payload) and the MMKV persisted-cache config. Built on existing prior art (`effect-atom`, `effect-query`, community Effect-RPC↔TanStack wrappers), not from scratch.

The app depends on **our** `rpc-react` surface, never on `@effect/rpc` directly.

## Consequences

- Effect purity end-to-end; typed errors preserved across the network.
- We **own an integration** (`rpc-react`) and its maintenance — accepted cost.
- `@effect/rpc`'s `0.x`/v4 churn is **contained to `rpc-react`**; the app and screens never see it.
- Pioneer risk on RN remains (no prior shipped datapoint), but it's isolated behind one package + the `SyncClient` port, so it's swappable.

## Revisit trigger

If `rpc-react` proves too costly to maintain, or `@effect/rpc` on RN blocks us, **fall back to tRPC** — the `SyncClient` port + `rpc-react` boundary make that a contained swap, not a rewrite.

## Alternatives rejected

- **tRPC + react-query** — mature and lower-risk, but pulls a non-Effect framework into an all-Effect stack, flattens typed errors at the wire boundary, and isn't what we want to own. Kept as the documented fallback.
- **@effect/rpc client used directly (no wrapper)** — leaks a `0.x` API across the app; churn would hit every screen.
