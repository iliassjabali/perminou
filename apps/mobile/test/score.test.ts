// Perminou — Plan 4, Task 4: Mock Exam scoring, pure logic, TDD red step.
//
// Deliberately independent of `Deck`/`ExamScreen` — the score tally (correct/total, and the
// derived rounded percentage) is plain data, unit-tested here with no rendering involved.
// `ExamScreen.tsx` wires this to `Deck`'s `onAnswered` callback and to the exhaustion signal.
import { describe, expect, it } from 'vitest';
import { initialScore, recordAnswer, scoreSummary } from '../src/lib/score';

describe('initialScore', () => {
  it('starts at 0 correct / 0 total', () => {
    expect(initialScore()).toEqual({ correct: 0, total: 0 });
  });
});

describe('recordAnswer', () => {
  it('a correct answer increments both correct and total', () => {
    expect(recordAnswer(initialScore(), true)).toEqual({ correct: 1, total: 1 });
  });

  it('a wrong answer increments only total', () => {
    expect(recordAnswer(initialScore(), false)).toEqual({ correct: 0, total: 1 });
  });

  it('accumulates across multiple answers', () => {
    let state = initialScore();
    state = recordAnswer(state, true);
    state = recordAnswer(state, false);
    state = recordAnswer(state, true);
    expect(state).toEqual({ correct: 2, total: 3 });
  });

  it('does not mutate the input state (pure)', () => {
    const before = initialScore();
    recordAnswer(before, true);
    expect(before).toEqual({ correct: 0, total: 0 });
  });
});

describe('scoreSummary', () => {
  it('0/0 reports 0%, not NaN', () => {
    expect(scoreSummary(initialScore())).toEqual({ correct: 0, total: 0, percent: 0 });
  });

  it('computes an exact percentage', () => {
    expect(scoreSummary({ correct: 30, total: 40 })).toEqual({ correct: 30, total: 40, percent: 75 });
  });

  it('rounds to the nearest integer percent', () => {
    expect(scoreSummary({ correct: 1, total: 3 })).toEqual({ correct: 1, total: 3, percent: 33 });
  });

  it('a perfect score reports 100%', () => {
    expect(scoreSummary({ correct: 40, total: 40 })).toEqual({ correct: 40, total: 40, percent: 100 });
  });
});
