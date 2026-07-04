import { test, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { QuestionRepository } from '../src/ports';

test('a Layer can satisfy the QuestionRepository port', async () => {
  const fake = Layer.succeed(QuestionRepository, {
    upsertQuestion: () => Effect.void,
    questionsForChapter: () => Effect.succeed([]),
  });
  const program = Effect.gen(function* () {
    const repo = yield* QuestionRepository;
    yield* repo.upsertQuestion({} as never);
    return yield* repo.questionsForChapter('ch_1' as never);
  });
  const out = await Effect.runPromise(program.pipe(Effect.provide(fake)));
  expect(out).toEqual([]);
});
