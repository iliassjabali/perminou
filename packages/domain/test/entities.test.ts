import { test, expect } from 'vitest';
import { Effect, Either } from 'effect';
import { Schema } from 'effect';
import { Question, decodeQuestion } from '../src/entities';

const valid = {
  id: 'q_1', sourceUrl: 'https://perminou.narsa.gov.ma/fr/quiz/1', chapterId: 'ch_1',
  lang: 'fr', text: 'Que signifie ce panneau ?', ordinal: 1,
  answers: [{ label: 'Stop', correct: true }, { label: 'Cédez', correct: false }],
};

test('decodes a valid question', () => {
  const q = Schema.decodeUnknownSync(Question)(valid);
  expect(q.answers.filter((a) => a.correct)).toHaveLength(1);
  expect(q.lang).toBe('fr');
});

test('rejects an empty question text', async () => {
  const res = await Effect.runPromise(Effect.either(decodeQuestion({ ...valid, text: '' })));
  expect(Either.isLeft(res)).toBe(true);
});

test('rejects an unknown lang', async () => {
  const res = await Effect.runPromise(Effect.either(decodeQuestion({ ...valid, lang: 'en' })));
  expect(Either.isLeft(res)).toBe(true);
});
