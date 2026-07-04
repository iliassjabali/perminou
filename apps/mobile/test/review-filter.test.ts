// Perminou — Plan 4, Task 4: Review-deck question filtering, pure logic, TDD red step.
//
// Given the full question bank (from `useDeck('practice')`) and the persisted "review later" id
// set (from `review-store.ts`), derives the subset `ReviewScreen.tsx` hands to `Deck`. Kept as
// plain data transformation — no MMKV, no rendering — so it's unit-tested here directly.
import { describe, expect, it } from 'vitest';
import { filterReviewQuestions } from '../src/lib/review-filter';
import type { DeckQuestion } from '../src/features/deck/use-deck';

function makeQuestion(id: string): DeckQuestion {
  return { id, category: 'B', hasImage: false, hasAudio: true, answers: [] };
}

describe('filterReviewQuestions', () => {
  const all = [makeQuestion('1'), makeQuestion('2'), makeQuestion('3')];

  it('returns [] when the review set is empty', () => {
    expect(filterReviewQuestions(all, [])).toEqual([]);
  });

  it('returns only the questions whose id is in the review set', () => {
    expect(filterReviewQuestions(all, ['2'])).toEqual([makeQuestion('2')]);
  });

  it('preserves the original question order, not the review-id order', () => {
    expect(filterReviewQuestions(all, ['3', '1'])).toEqual([makeQuestion('1'), makeQuestion('3')]);
  });

  it('ignores review ids that do not match any question', () => {
    expect(filterReviewQuestions(all, ['999'])).toEqual([]);
  });

  it('accepts a Set as well as an array of ids', () => {
    expect(filterReviewQuestions(all, new Set(['1', '3']))).toEqual([makeQuestion('1'), makeQuestion('3')]);
  });

  it('an empty question bank filters to []', () => {
    expect(filterReviewQuestions([], ['1'])).toEqual([]);
  });
});
