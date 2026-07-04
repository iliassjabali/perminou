import { Context, Data, Effect } from 'effect';
import type { Question } from './entities';

export class DbError extends Data.TaggedError('DbError')<{ cause: unknown }> {}

export class QuestionRepository extends Context.Tag('QuestionRepository')<
  QuestionRepository,
  {
    readonly upsertQuestion: (q: Question) => Effect.Effect<void, DbError>;
    readonly questionsByCategory: (category: string) => Effect.Effect<Question[], DbError>;
    readonly allQuestions: () => Effect.Effect<Question[], DbError>;
    readonly randomQuestions: (count: number) => Effect.Effect<Question[], DbError>;
  }
>() {}
