import { test, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { SourceGateway } from '../src/domain/ports/source-gateway';

test('a Layer can satisfy SourceGateway', async () => {
  const fake = Layer.succeed(SourceGateway, {
    login: () => Effect.succeed({ cookie: 'x' } as never),
    nextExamQuestion: () => Effect.succeed({ id: '46', category: 'B', hasImage: true, hasAudio: false, answers: [{ narsaId: 1, index: 1 }] } as never),
    submitAndAdvance: () => Effect.succeed('more' as const),
    fetchCorrection: () => Effect.succeed({ correctByQuestion: { '46': [1] } } as never),
  });
  const out = await Effect.runPromise(Effect.gen(function* () {
    const gw = yield* SourceGateway; return yield* gw.nextExamQuestion({} as never);
  }).pipe(Effect.provide(fake)));
  expect(out.id).toBe('46');
});
