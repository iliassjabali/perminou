import { test, expect } from 'vitest';
import { Effect, Either, Schema } from 'effect';
import { Question, decodeQuestion, mediaUrl } from '../src/entities';

const valid = { id: '565', category: 'B', hasImage: true, hasAudio: true,
  answers: [ { narsaId: 933, index: 1, correct: true }, { narsaId: 934, index: 2, correct: false },
             { narsaId: 935, index: 3, correct: true }, { narsaId: 936, index: 4, correct: false } ] };

test('decodes a valid multi-select question', () => {
  const q = Schema.decodeUnknownSync(Question)(valid);
  expect(q.answers.filter((a) => a.correct)).toHaveLength(2);
});
test('decodes a valid alphanumeric signage question id', () => {
  const q = Schema.decodeUnknownSync(Question)({ ...valid, id: 'IS014' });
  expect(q.id).toBe('IS014');
});
test('rejects an empty string id', async () => {
  const r = await Effect.runPromise(Effect.either(decodeQuestion({ ...valid, id: '' })));
  expect(Either.isLeft(r)).toBe(true);
});
test('builds media urls by id + lang', () => {
  expect(mediaUrl('image', 'fr', '565' as never)).toBe('/media/uploads/questions/images/fr/565.png');
  expect(mediaUrl('sound', 'ar', '800' as never)).toBe('/media/uploads/questions/son/ar/800.mp3');
  expect(mediaUrl('image', 'fr', 'IS014' as never)).toBe('/media/uploads/questions/images/fr/IS014.png');
});
