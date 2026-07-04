import { Effect } from 'effect';
import { QuestionRepository, type Question } from '@perminou/domain';

// Pure Effect use-case: the full practice set.
export const getAllQuestions = (): Effect.Effect<Question[], never, QuestionRepository> =>
  Effect.gen(function* () {
    const repo = yield* QuestionRepository;
    return yield* repo.allQuestions();
  }).pipe(Effect.orDie);
