# Perminou `rpc-react` Implementation Plan (Plan 3)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. READING: `perminou-architecture`, `perminou-mobile-ui`, ADR 0007.

**Goal:** `@perminou/rpc-react` — a typed `api` proxy over the `@effect/rpc` client (from `@perminou/rpc-contract`) wrapping `@tanstack/react-query` with an MMKV-persisted cache. App calls `api.exam.getExam.useQuery({count})` with one import.

**Risk (ADR 0007):** the `@effect/rpc` *client* has no shipped React-Native precedent. De-risk in stages: prove the client in Node against the real backend (T1) → react-query `api` proxy in jsdom (T2) → Expo + MMKV (T3). If the RN client fails at T3, fall back to tRPC (ADR 0007) — the `api` surface the app sees is unchanged.

## Global Constraints
- Node only for tooling. `@perminou/*`. Effect + Effect Schema. Vitest. `@effect/platform@^0.96` (match backend). App never imports `@effect/rpc` directly. Commit per green step.

### Task 1: Node client smoke (de-risk gate)
Create `packages/rpc-react` (deps: effect, @effect/rpc, @effect/platform, @perminou/rpc-contract; dev: tsx, @testcontainers/postgresql). `src/client.ts`: `makeExamClient(baseUrl)` → Effect yielding an `ExamRpcs` client over `RpcClient.layerProtocolHttp` + `FetchHttpClient` + `RpcSerialization.layerJson`.
- [ ] Integration test: boot the backend in-process (reuse `apps/backend` http app + Testcontainers Postgres seeded w/ a few questions on an ephemeral port), call `client.GetExam({count:2})`, assert 2 back. Red -> implement -> green.
- [ ] Commit `feat(rpc-react): @effect/rpc client factory verified against the backend`.
- [ ] If the client can't be made to work, STOP + escalate (tRPC fallback). Inspect `node_modules/@effect/rpc/dist/dts/RpcClient.d.ts`.

### Task 2: react-query binding + typed `api` proxy
`src/query.ts` (queryKey + runtime bridge), `src/api.ts` (nested Proxy: `<ns>.<rpc>` -> `{useQuery,useMutation,prefetch}` typed via mapped types over `ExamRpcs.requests`), `src/index.ts`, `RpcReactProvider` (wraps QueryClientProvider + client runtime).
- [ ] Failing test (Vitest + @testing-library/react, jsdom): component calling `api.exam.getExam.useQuery({count:2})` behind `RpcReactProvider` with a FAKE client (returns 2) -> asserts render. No network.
- [ ] Implement -> green. Commit `feat(rpc-react): typed api proxy over react-query`.

### Task 3: Expo wiring + MMKV persisted cache
`src/persist.ts` (MMKV persister, long gcTime/staleTime), `src/native.ts` (Expo provider preset, base URL from config), `README.md` (Hermes polyfills note).
- [ ] Unit-test the persister vs a fake in-memory MMKV. Implement `persistQueryClient` + persister.
- [ ] `native.ts` provider preset (typecheck-clean; Plan 4 exercises it end-to-end).
- [ ] Commit `feat(rpc-react): MMKV persisted cache + Expo provider preset`.
- [ ] DECISION GATE: if `@effect/rpc` client fails under Hermes despite polyfills, invoke ADR-0007 tRPC fallback (swap `client.ts`; `api.ts`/persistence/app surface unchanged).

## Self-Review
Client factory (T1) -> api proxy (T2) -> Expo/MMKV (T3). App-facing `api` stable across fallback. `api.exam.getExam/getAllQuestions` names match `ExamRpcs`. Risk gated w/ stated fallback.
