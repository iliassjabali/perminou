// Perminou — the deck's data hook (Plan 4, Task 1).
//
// Talks to the backend ONLY via `@perminou/rpc-react`'s typed `api` proxy — no `@effect/rpc`,
// no raw fetch. Practice mode reads the full bank (`getAllQuestions`); Mock Exam reads a random
// 40-question sample (`getExam`). Tasks 2-3 build the actual swipeable card/deck UI on top of
// this; here we only prove the data flows.
import { api } from '@perminou/rpc-react';

export type DeckMode = 'practice' | 'exam';

const EXAM_QUESTION_COUNT = 40;

// Derived from `api` itself (rather than importing `@perminou/rpc-contract` directly) so this
// hook only ever depends on the one blessed data-access surface.
type ExamQueryResult = ReturnType<typeof api.exam.getExam.useQuery>;
export type DeckQuestion = NonNullable<ExamQueryResult['data']>[number];
type Questions = readonly DeckQuestion[];

export interface DeckState {
  readonly questions: Questions;
  readonly isLoading: boolean;
  readonly error: unknown;
}

interface RawQueryResult {
  readonly data: Questions | undefined;
  readonly isLoading: boolean;
  readonly error: unknown;
}

/**
 * Pure: react-query's `{ data, isLoading, error }` -> the deck's public shape. Extracted so it's
 * unit-testable without rendering a component (this package's tests run under plain Node, no
 * jsdom — see the root `vitest.workspace.ts`).
 */
export function toDeckState(result: RawQueryResult): DeckState {
  return {
    questions: result.data ?? [],
    isLoading: result.isLoading,
    error: result.error,
  };
}

/**
 * Practice = the full question bank; Mock Exam = a random 40-question sample. Both `useQuery`
 * calls are made unconditionally (Rules of Hooks) — only the active mode's query is `enabled`,
 * so the inactive one neither fetches nor reports `isLoading`.
 */
export function useDeck(mode: DeckMode): DeckState {
  const exam = api.exam.getExam.useQuery({ count: EXAM_QUESTION_COUNT }, { enabled: mode === 'exam' });
  const allQuestions = api.exam.getAllQuestions.useQuery(undefined, { enabled: mode === 'practice' });

  return toDeckState(mode === 'exam' ? exam : allQuestions);
}
