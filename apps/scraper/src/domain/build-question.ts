import { Effect, Schema } from 'effect';
import { Question } from '@perminou/domain';
import { ScrapeShapeError } from './errors';
import type { RawQuestion } from './ports/source-gateway';

export const buildQuestion = (raw: RawQuestion, correct: number[]) =>
  Effect.gen(function* () {
    const known = new Set(raw.answers.map((a) => a.narsaId));
    const unknown = correct.filter((id) => !known.has(id));
    if (unknown.length) {
      return yield* Effect.fail(new ScrapeShapeError({ url: `question/${raw.id}`, reason: `correct ids not in answers: ${unknown}`, htmlSnippet: '' }));
    }
    return yield* Schema.decodeUnknown(Question)({
      id: raw.id, category: raw.category, hasImage: raw.hasImage, hasAudio: raw.hasAudio,
      answers: raw.answers.map((a) => ({ narsaId: a.narsaId, index: a.index, correct: correct.includes(a.narsaId) })),
    }).pipe(Effect.mapError((cause) => new ScrapeShapeError({ url: `question/${raw.id}`, reason: String(cause), htmlSnippet: '' })));
  });
