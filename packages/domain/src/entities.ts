import { Schema } from 'effect';
import { CategoryId, ChapterId, QuestionId } from './ids';

export const Lang = Schema.Literal('fr', 'ar');
export type Lang = Schema.Schema.Type<typeof Lang>;

export const Answer = Schema.Struct({
  label: Schema.NonEmptyString,
  correct: Schema.Boolean,
});
export type Answer = Schema.Schema.Type<typeof Answer>;

export const Question = Schema.Struct({
  id: QuestionId,
  sourceUrl: Schema.NonEmptyString,
  chapterId: ChapterId,
  lang: Lang,
  text: Schema.NonEmptyString,
  imageUrl: Schema.optional(Schema.String),
  ordinal: Schema.Int,
  answers: Schema.Array(Answer),
});
export type Question = Schema.Schema.Type<typeof Question>;
export const decodeQuestion = Schema.decodeUnknown(Question);

export const Chapter = Schema.Struct({
  id: ChapterId, categoryId: CategoryId, title: Schema.NonEmptyString, ordinal: Schema.Int,
});
export type Chapter = Schema.Schema.Type<typeof Chapter>;

export const Category = Schema.Struct({
  id: CategoryId, title: Schema.NonEmptyString, ordinal: Schema.Int,
});
export type Category = Schema.Schema.Type<typeof Category>;
