import { Schema } from 'effect';
import { QuestionId } from './ids';

export const Lang = Schema.Literal('fr', 'ar');
export type Lang = Schema.Schema.Type<typeof Lang>;

export const Answer = Schema.Struct({
  narsaId: Schema.Int, index: Schema.Int, correct: Schema.Boolean,
});
export type Answer = Schema.Schema.Type<typeof Answer>;

export const Question = Schema.Struct({
  id: QuestionId,
  category: Schema.NonEmptyString,
  hasImage: Schema.Boolean,
  hasAudio: Schema.Boolean,
  answers: Schema.Array(Answer),
});
export type Question = Schema.Schema.Type<typeof Question>;
export const decodeQuestion = Schema.decodeUnknown(Question);

const MEDIA = '/media/uploads/questions';
export const mediaUrl = (kind: 'image' | 'sound', lang: Lang, id: QuestionId): string =>
  kind === 'image' ? `${MEDIA}/images/${lang}/${id}.png` : `${MEDIA}/son/${lang}/${id}.mp3`;
