// Perminou — Plan 4, Task 4: Mock Exam scoring.
//
// Deliberately independent of `Deck`/`ExamScreen`/React — the tally is plain data, unit-tested
// in `test/score.test.ts` with no rendering involved. `ExamScreen.tsx` wires `recordAnswer` to
// `Deck`'s per-card `onAnswered(id, correct)` callback and reads `scoreSummary` once the deck
// reports it's exhausted.
export interface ScoreState {
  readonly correct: number;
  readonly total: number;
}

export interface ScoreSummary {
  readonly correct: number;
  readonly total: number;
  /** Rounded to the nearest integer percent; 0 (not NaN) when `total` is 0. */
  readonly percent: number;
}

export function initialScore(): ScoreState {
  return { correct: 0, total: 0 };
}

/** Never mutates `state` — `ExamScreen.tsx` calls this from a `useState` updater. */
export function recordAnswer(state: ScoreState, correct: boolean): ScoreState {
  return { correct: state.correct + (correct ? 1 : 0), total: state.total + 1 };
}

export function scoreSummary(state: ScoreState): ScoreSummary {
  const percent = state.total === 0 ? 0 : Math.round((state.correct / state.total) * 100);
  return { correct: state.correct, total: state.total, percent };
}
