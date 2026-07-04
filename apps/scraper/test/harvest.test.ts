import { test, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { QuestionRepository, type Question } from '@perminou/domain';
import { SourceGateway, type RawQuestion } from '../src/domain/ports/source-gateway';
import { harvest } from '../src/application/harvest';

const mkRaw = (id: string): RawQuestion => ({
  id, category: 'B', hasImage: true, hasAudio: false,
  answers: [
    { narsaId: Number(id) * 10, index: 1 },
    { narsaId: Number(id) * 10 + 1, index: 2 },
  ],
});

// Fake gateway serving a scripted list of exams (each = ordered question ids).
// nextExamQuestion serves the current slot; submitAndAdvance advances / signals 'done'.
const fakeGateway = (exams: string[][], correct: Record<string, number[]>) => {
  let examIdx = -1;
  let qIdx = 0;
  return Layer.succeed(SourceGateway, {
    login: () => Effect.succeed({ cookie: 'x' }),
    nextExamQuestion: () =>
      Effect.sync(() => {
        if (examIdx < 0 || qIdx >= exams[examIdx]!.length) { examIdx++; qIdx = 0; }
        return mkRaw(exams[examIdx]![qIdx]!);
      }),
    submitAndAdvance: () =>
      Effect.sync(() => {
        qIdx++;
        return qIdx >= exams[examIdx]!.length ? ('done' as const) : ('more' as const);
      }),
    fetchCorrection: () => Effect.succeed({ correctByQuestion: correct }),
  });
};

const fakeRepo = (store: Map<string, Question>) =>
  Layer.succeed(QuestionRepository, {
    upsertQuestion: (q: Question) => Effect.sync(() => { store.set(q.id, q); }),
    questionsByCategory: () => Effect.succeed([...store.values()]),
    allQuestions: () => Effect.succeed([...store.values()]),
    randomQuestions: (n: number) => Effect.succeed([...store.values()].slice(0, n)),
  });

test('harvest collects all unique questions and stops after dry rounds', async () => {
  const store = new Map<string, Question>();
  const exams = [['1', '2', '3'], ['3', '4', '5'], ['1', '2', '3'], ['4', '5', '1']];
  const correct = Object.fromEntries(['1', '2', '3', '4', '5'].map((id) => [id, [1]]));
  const summary = await Effect.runPromise(
    harvest({ dryRounds: 2 }).pipe(Effect.provide(Layer.merge(fakeGateway(exams, correct), fakeRepo(store)))),
  );
  expect(summary.totalQuestions).toBe(5);
  expect(store.size).toBe(5);
  expect(summary.rounds).toBe(4);
});

test('a question that fails to build is skipped without aborting the harvest', async () => {
  const store = new Map<string, Question>();
  const exams = [['1', '9', '2'], ['1', '9', '2'], ['1', '9', '2']];
  // question '9' points its correction at index 5, which is not among its 2 answers → buildQuestion fails
  const correct = { '1': [1], '2': [1], '9': [5] };
  const summary = await Effect.runPromise(
    harvest({ dryRounds: 2 }).pipe(Effect.provide(Layer.merge(fakeGateway(exams, correct), fakeRepo(store)))),
  );
  expect(store.has('9')).toBe(false);
  expect(store.has('1')).toBe(true);
  expect(store.has('2')).toBe(true);
  expect(summary.totalQuestions).toBe(2);
});
