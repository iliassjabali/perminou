import { test, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { QuestionRepository, type Question } from '@perminou/domain';
import { getExam } from '../src/application/get-exam';
import { getAllQuestions } from '../src/application/get-all-questions';

const fakeQuestion = (id: string): Question => ({
  id: id as Question['id'],
  category: 'B',
  hasImage: true,
  hasAudio: false,
  answers: [
    { narsaId: 1, index: 1, correct: true },
    { narsaId: 2, index: 2, correct: false },
  ],
});

const FakeQuestionRepositoryLive = (questions: Question[]) =>
  Layer.succeed(QuestionRepository, {
    upsertQuestion: () => Effect.void,
    questionsByCategory: () => Effect.succeed(questions),
    allQuestions: () => Effect.succeed(questions),
    randomQuestions: (count: number) => Effect.succeed(questions.slice(0, count)),
  });

test('getExam returns `count` questions from the repository', async () => {
  const seed = ['1', '2', '3', '4', '5'].map(fakeQuestion);
  const result = await Effect.runPromise(
    getExam(3).pipe(Effect.provide(FakeQuestionRepositoryLive(seed))),
  );
  expect(result).toHaveLength(3);
});

test('getAllQuestions returns every question from the repository', async () => {
  const seed = ['1', '2', '3'].map(fakeQuestion);
  const result = await Effect.runPromise(
    getAllQuestions().pipe(Effect.provide(FakeQuestionRepositoryLive(seed))),
  );
  expect(result).toHaveLength(3);
});
