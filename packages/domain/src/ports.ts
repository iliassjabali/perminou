import { Context, Data, Effect } from 'effect';
import type { Question } from './entities';
import type { ChapterId } from './ids';

export class DbError extends Data.TaggedError('DbError')<{ cause: unknown }> {}

export class QuestionRepository extends Context.Tag('QuestionRepository')<
  QuestionRepository,
  {
    readonly upsertQuestion: (q: Question) => Effect.Effect<void, DbError>;
    readonly questionsForChapter: (id: ChapterId) => Effect.Effect<Question[], DbError>;
  }
>() {}
