import { ExamRpcs } from '@perminou/rpc-contract';
import { getExam } from '../../application/get-exam';
import { getAllQuestions } from '../../application/get-all-questions';

// Thin inbound adapter: each handler just delegates to the use-case Effect.
export const ExamHandlersLive = ExamRpcs.toLayer({
  GetExam: ({ count }) => getExam(count),
  GetAllQuestions: () => getAllQuestions(),
});
