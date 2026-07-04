import { Effect, Layer } from 'effect';
import { eq, sql } from 'drizzle-orm';
import { PgDrizzle } from '@effect/sql-drizzle/Pg';
import { QuestionRepository, DbError, decodeQuestion, type Question } from '@perminou/domain';
import { questions, answers } from './schema';
import { DrizzleLive } from './client';

const make = Effect.gen(function* () {
  const db = yield* PgDrizzle;
  const decodeRows = (rows: (typeof questions.$inferSelect)[]) =>
    Effect.forEach(rows, (row) =>
      Effect.gen(function* () {
        const as = yield* db.select().from(answers).where(eq(answers.questionId, row.id)).orderBy(answers.index);
        return yield* decodeQuestion({ id: row.id, category: row.category, hasImage: row.hasImage, hasAudio: row.hasAudio,
          answers: as.map((a) => ({ narsaId: a.narsaId, index: a.index, correct: a.correct })) });
      }));
  const upsertQuestion = (q: Question) =>
    Effect.gen(function* () {
      yield* db.insert(questions).values({ id: q.id, category: q.category, hasImage: q.hasImage, hasAudio: q.hasAudio })
        .onConflictDoUpdate({ target: questions.id, set: { category: q.category, hasImage: q.hasImage, hasAudio: q.hasAudio } });
      yield* db.delete(answers).where(eq(answers.questionId, q.id));
      if (q.answers.length) yield* db.insert(answers).values(q.answers.map((a) => ({ questionId: q.id, narsaId: a.narsaId, index: a.index, correct: a.correct })));
    }).pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));
  const questionsByCategory = (category: string) =>
    Effect.gen(function* () {
      const qs = yield* db.select().from(questions).where(eq(questions.category, category)).orderBy(questions.id);
      return yield* decodeRows(qs);
    }).pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));
  const allQuestions = () =>
    Effect.gen(function* () {
      return yield* decodeRows(yield* db.select().from(questions).orderBy(questions.id));
    }).pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));
  const randomQuestions = (count: number) =>
    Effect.gen(function* () {
      return yield* decodeRows(yield* db.select().from(questions).orderBy(sql`random()`).limit(count));
    }).pipe(Effect.catchAll((cause) => Effect.fail(new DbError({ cause }))));
  return { upsertQuestion, questionsByCategory, allQuestions, randomQuestions };
});
export const QuestionRepositoryLive = (uri: string) =>
  Layer.effect(QuestionRepository, make).pipe(Layer.provide(DrizzleLive(uri)));
