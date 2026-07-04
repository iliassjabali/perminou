import { Effect, Layer } from 'effect';
import * as HttpApp from '@effect/platform/HttpApp';
import * as RpcServer from '@effect/rpc/RpcServer';
import * as RpcSerialization from '@effect/rpc/RpcSerialization';
import { Hono } from 'hono';
import { ExamRpcs } from '@perminou/rpc-contract';
import { type QuestionRepository as QuestionRepositoryTag } from '@perminou/domain';
import { ExamHandlersLive } from './adapters/inbound/exam.handlers';

// Mounts the @effect/rpc server (JSON serialization) as a Fetch-API web handler and
// wires it into a Hono app at POST /rpc, alongside a plain GET /health.
//
// We build the web handler with `HttpApp.toWebHandlerLayerWith` + `RpcServer.toHttpApp`
// directly (rather than the higher-level `RpcServer.toWebHandler`) because
// `RpcServer.toWebHandler`'s declared type additionally requires
// `HttpRouter.HttpRouter.DefaultServices` (FileSystem/Path/Etag/HttpPlatform) in the
// provided layer — services this RPC-only server never actually uses. Calling
// `RpcServer.toHttpApp` + `HttpApp.toWebHandlerLayerWith` directly (which is exactly
// what `toWebHandler` does under the hood, see its source) avoids that unused
// dependency entirely.
export function makeApp<E>(questionRepositoryLayer: Layer.Layer<QuestionRepositoryTag, E>) {
  const RpcLayer = Layer.provideMerge(
    Layer.mergeAll(ExamHandlersLive, RpcSerialization.layerJson),
    questionRepositoryLayer,
  );

  const { handler, dispose } = HttpApp.toWebHandlerLayerWith(Layer.merge(RpcLayer, Layer.scope), {
    toHandler: (runtime) => Effect.provide(RpcServer.toHttpApp(ExamRpcs), runtime),
  });

  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.post('/rpc', (c) => handler(c.req.raw));

  return { app, dispose };
}
