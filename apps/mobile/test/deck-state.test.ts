// Perminou — Plan 4, Task 3: pure swipe-deck state, TDD red step.
//
// Deliberately has no dependency on React, `react-native-gesture-handler`, or
// `react-native-reanimated` — the swipe *decision* (advance the index; left additionally records
// the id into a review set) is unit-tested here as plain data transitions. `Deck.tsx` wires this
// to the actual pan-gesture layer, which isn't unit-testable under jsdom (verified instead by
// `expo export` bundling — see Plan 4 Task 3).
import { describe, expect, it } from 'vitest';
import { deckProgress, initialDeckState, swipeDeck } from '../src/features/deck/deck-state';

describe('initialDeckState', () => {
  it('starts at index 0 with an empty review set', () => {
    expect(initialDeckState()).toEqual({ index: 0, reviewIds: new Set() });
  });
});

describe('swipeDeck', () => {
  it('swiping right just advances the index', () => {
    const state = swipeDeck(initialDeckState(), 'right', 'q1');
    expect(state).toEqual({ index: 1, reviewIds: new Set() });
  });

  it('swiping left advances the index AND adds the id to the review set', () => {
    const state = swipeDeck(initialDeckState(), 'left', 'q1');
    expect(state).toEqual({ index: 1, reviewIds: new Set(['q1']) });
  });

  it('accumulates review ids across multiple left swipes, right swipes leave it untouched', () => {
    let state = initialDeckState();
    state = swipeDeck(state, 'left', 'q1');
    state = swipeDeck(state, 'right', 'q2');
    state = swipeDeck(state, 'left', 'q3');
    expect(state).toEqual({ index: 3, reviewIds: new Set(['q1', 'q3']) });
  });

  it('does not mutate the input state (pure)', () => {
    const before = initialDeckState();
    swipeDeck(before, 'left', 'q1');
    expect(before).toEqual({ index: 0, reviewIds: new Set() });
  });

  it('swiping the same id left twice keeps the review set a set (no duplicate growth)', () => {
    let state = initialDeckState();
    state = swipeDeck(state, 'left', 'q1');
    state = swipeDeck(state, 'left', 'q1');
    expect(state.reviewIds).toEqual(new Set(['q1']));
    expect(state.index).toBe(2);
  });
});

describe('deckProgress', () => {
  it('reports not done while index < total', () => {
    const state = swipeDeck(initialDeckState(), 'right', 'q1');
    expect(deckProgress(state, 3)).toEqual({ current: 1, total: 3, done: false });
  });

  it('flags done once index reaches total', () => {
    let state = initialDeckState();
    state = swipeDeck(state, 'right', 'q1');
    state = swipeDeck(state, 'right', 'q2');
    expect(deckProgress(state, 2)).toEqual({ current: 2, total: 2, done: true });
  });

  it('an empty deck (total 0) is immediately done', () => {
    expect(deckProgress(initialDeckState(), 0)).toEqual({ current: 0, total: 0, done: true });
  });
});
