import { pgTable, integer, text, boolean, primaryKey } from 'drizzle-orm/pg-core';

export const questions = pgTable('questions', {
  id: text('id').primaryKey(),              // NARSA id — stable identity; ~10% are alphanumeric (e.g. IS014)
  category: text('category').notNull(),
  hasImage: boolean('has_image').notNull(),
  hasAudio: boolean('has_audio').notNull(),
});

export const answers = pgTable('answers', {
  questionId: text('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  narsaId: integer('narsa_id').notNull(),
  index: integer('index').notNull(),
  correct: boolean('correct').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.questionId, t.narsaId] }) }));
