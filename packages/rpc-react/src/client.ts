import { Effect, Layer } from 'effect';
import * as RpcClient from '@effect/rpc/RpcClient';
import * as RpcSerialization from '@effect/rpc/RpcSerialization';
import { FetchHttpClient } from '@effect/platform';
import { ExamRpcs } from '@perminou/rpc-contract';

/**
 * Builds an Effect that yields a typed `@effect/rpc` client for `ExamRpcs`, talking to
 * `baseUrl` (the backend's `/rpc` endpoint) over plain HTTP with JSON serialization.
 *
 * The client's HTTP protocol layer is scoped (`RpcClient.make` requires `Scope.Scope`),
 * so callers should run the returned Effect inside `Effect.scoped` — or provide their
 * own longer-lived scope — for as long as they intend to keep using the client.
 *
 * Usage:
 *   const program = Effect.gen(function* () {
 *     const client = yield* makeExamClient(`${baseUrl}/rpc`);
 *     return yield* client.GetExam({ count: 20 });
 *   });
 *   await Effect.runPromise(program.pipe(Effect.scoped));
 */
export const makeExamClient = (baseUrl: string) => {
  const ClientLayer = RpcClient.layerProtocolHttp({ url: baseUrl }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerJson),
  );

  return RpcClient.make(ExamRpcs).pipe(Effect.provide(ClientLayer));
};

export type ExamClient = Effect.Effect.Success<ReturnType<typeof makeExamClient>>;
