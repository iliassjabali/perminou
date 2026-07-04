import { Effect, Layer } from 'effect';
import { eq } from 'drizzle-orm';
import { PgDrizzle } from '@effect/sql-drizzle/Pg';
import { QuestionRepository, DbError, decodeQuestion, type Question, type ChapterId } from '@perminou/domain';
import { questions, answers } from './schema';
import { DrizzleLive } from './client';

const make = Effect.gen(function* () {
  const db = yield* PgDrizzle;

  const upsertQuestion = (q: Question) =>
    Effect.gen(function* () {
      yield* db.insert(questions).values({
        id: q.id, sourceUrl: q.sourceUrl, chapterId: q.chapterId, lang: q.lang,
        text: q.text, imageUrl: q.imageUrl ?? null, ordinal: q.ordinal,
      }).onConflictDoUpdate({
        target: questions.sourceUrl,
        set: { text: q.text, lang: q.lang, imageUrl: q.imageUrl ?? null, ordinal: q.ordinal },
      });
      yield* db.delete(answers).where(eq(answers.questionId, q.id));
      if (q.answers.length > 0) {
        yield* db.insert(answers).values(q.answers.map((a) => ({ questionId: q.id, label: a.label, correct: a.correct })));
      }
    }).pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));

  const questionsForChapter = (id: ChapterId) =>
    Effect.gen(function* () {
      const qs = yield* db.select().from(questions).where(eq(questions.chapterId, id)).orderBy(questions.ordinal);
      return yield* Effect.forEach(qs, (row) =>
        Effect.gen(function* () {
          const as = yield* db.select().from(answers).where(eq(answers.questionId, row.id));
          return yield* decodeQuestion({
            id: row.id, sourceUrl: row.sourceUrl, chapterId: row.chapterId, lang: row.lang,
            text: row.text, imageUrl: row.imageUrl ?? undefined, ordinal: row.ordinal,
            answers: as.map((a) => ({ label: a.label, correct: a.correct })),
          });
        }));
    }).pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));

  return { upsertQuestion, questionsForChapter };
});

export const QuestionRepositoryLive = (connectionUri: string) =>
  Layer.effect(QuestionRepository, make).pipe(Layer.provide(DrizzleLive(connectionUri)));
