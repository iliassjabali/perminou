import { pgTable, text, integer, boolean, uuid, index } from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  ordinal: integer('ordinal').notNull(),
});

export const chapters = pgTable('chapters', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  title: text('title').notNull(),
  ordinal: integer('ordinal').notNull(),
});

export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  sourceUrl: text('source_url').notNull().unique(),   // stable upsert key
  chapterId: text('chapter_id').notNull().references(() => chapters.id),
  lang: text('lang').notNull(),                        // 'fr' | 'ar'
  text: text('text').notNull(),
  imageUrl: text('image_url'),
  ordinal: integer('ordinal').notNull(),
}, (t) => ({ byChapter: index('questions_chapter_idx').on(t.chapterId) }));

export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionId: text('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  correct: boolean('correct').notNull(),
});
