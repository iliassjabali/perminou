import { test, expect } from 'vitest';
import { Effect } from 'effect';
import { buildQuestion } from '../src/domain/build-question';

const raw = { id: 565, category: 'B', hasImage: true, hasAudio: true,
  answers: [ { narsaId: 933, index: 1 }, { narsaId: 934, index: 2 }, { narsaId: 935, index: 3 }, { narsaId: 936, index: 4 } ] };

test('marks the correct answer set from the correction', async () => {
  const q = await Effect.runPromise(buildQuestion(raw as never, [933, 935]));
  expect(q.answers.filter((a) => a.correct).map((a) => a.narsaId)).toEqual([933, 935]);
});
test('fails typed when a correct id is not among the answers', async () => {
  const exit = await Effect.runPromiseExit(buildQuestion(raw as never, [999]));
  expect(exit._tag).toBe('Failure'); // ScrapeShapeError — correction/answers mismatch
});
