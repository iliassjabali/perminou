import { Effect } from 'effect';
import { QuestionRepository, type Question } from '@perminou/domain';

// Pure Effect use-case: draw a random mock-exam-sized batch from the repository.
export const getExam = (count: number): Effect.Effect<Question[], never, QuestionRepository> =>
  Effect.gen(function* () {
    const repo = yield* QuestionRepository;
    return yield* repo.randomQuestions(count);
  }).pipe(Effect.orDie);
