import { Schema } from 'effect';

export const AnswerWire = Schema.Struct({
  narsaId: Schema.Int,
  index: Schema.Int,
  correct: Schema.Boolean,
});
export type AnswerWire = Schema.Schema.Type<typeof AnswerWire>;

export const QuestionWire = Schema.Struct({
  id: Schema.String,
  category: Schema.String,
  hasImage: Schema.Boolean,
  hasAudio: Schema.Boolean,
  answers: Schema.Array(AnswerWire),
});
export type QuestionWire = Schema.Schema.Type<typeof QuestionWire>;
