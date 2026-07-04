import { Schema } from 'effect';
import { Rpc, RpcGroup } from '@effect/rpc';
import { QuestionWire } from './question';

export const ExamRpcs = RpcGroup.make(
  Rpc.make('GetExam', {
    payload: { count: Schema.Int },
    success: Schema.Array(QuestionWire),
  }),
  Rpc.make('GetAllQuestions', {
    payload: {},
    success: Schema.Array(QuestionWire),
  }),
);
