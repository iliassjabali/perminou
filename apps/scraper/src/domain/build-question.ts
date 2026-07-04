import { Effect, Schema } from 'effect';
import { Question } from '@perminou/domain';
import { ScrapeShapeError } from './errors';
import type { RawQuestion } from './ports/source-gateway';

export const buildQuestion = (raw: RawQuestion, correctIndexes: number[]) =>
  Effect.gen(function* () {
    // The correction reveals correctness by 1-based *index* (on-page
    // position), never by the answer's own narsaId — the correction markup
    // never exposes narsaId at all. Join on index, not narsaId.
    const known = new Set(raw.answers.map((a) => a.index));
    const unknown = correctIndexes.filter((i) => !known.has(i));
    if (unknown.length) {
      return yield* Effect.fail(new ScrapeShapeError({ url: `question/${raw.id}`, reason: `correct indexes not in answers: ${unknown}`, htmlSnippet: '' }));
    }
    return yield* Schema.decodeUnknown(Question)({
      id: raw.id, category: raw.category, hasImage: raw.hasImage, hasAudio: raw.hasAudio,
      answers: raw.answers.map((a) => ({ narsaId: a.narsaId, index: a.index, correct: correctIndexes.includes(a.index) })),
    }).pipe(Effect.mapError((cause) => new ScrapeShapeError({ url: `question/${raw.id}`, reason: String(cause), htmlSnippet: '' })));
  });
