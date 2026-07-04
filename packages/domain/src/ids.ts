import { Schema } from 'effect';
export const QuestionId = Schema.NonEmptyString.pipe(Schema.brand('QuestionId'));
export type QuestionId = Schema.Schema.Type<typeof QuestionId>;
