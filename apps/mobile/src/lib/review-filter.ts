// Perminou — Plan 4, Task 4: Review-deck question filtering.
//
// `ReviewScreen.tsx` has the full question bank (`useDeck('practice')`) and the persisted
// "review later" id set (`review-store.ts`'s `getIds()`); this derives the subset to hand to
// `Deck`. Kept as a plain data transformation — no MMKV, no rendering — so it's unit-tested
// directly in `test/review-filter.test.ts`.
import type { DeckQuestion } from '../features/deck/use-deck';

/** Filters `questions` down to those whose id is in `reviewIds`, preserving `questions`' order. */
export function filterReviewQuestions(
  questions: readonly DeckQuestion[],
  reviewIds: ReadonlySet<string> | readonly string[],
): readonly DeckQuestion[] {
  const ids = reviewIds instanceof Set ? reviewIds : new Set(reviewIds);
  return questions.filter((question) => ids.has(question.id));
}
