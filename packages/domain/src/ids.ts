import { Schema } from 'effect';
export const CategoryId = Schema.String.pipe(Schema.brand('CategoryId'));
export const ChapterId = Schema.String.pipe(Schema.brand('ChapterId'));
export const QuestionId = Schema.String.pipe(Schema.brand('QuestionId'));
export type CategoryId = Schema.Schema.Type<typeof CategoryId>;
export type ChapterId = Schema.Schema.Type<typeof ChapterId>;
export type QuestionId = Schema.Schema.Type<typeof QuestionId>;
