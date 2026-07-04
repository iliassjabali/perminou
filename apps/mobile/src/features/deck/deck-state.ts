// Perminou — Plan 4, Task 3: the swipe deck's pure state transitions.
//
// Deliberately independent of `react-native-gesture-handler`/`react-native-reanimated` — `Deck.tsx`
// wires this reducer to the actual pan gesture, but the swipe *decision* (right = "got it", just
// advance; left = "review later", record the id then advance) is plain data, unit-tested in
// `test/deck-state.test.ts` with no rendering involved.
export type SwipeDirection = 'right' | 'left';

export interface DeckState {
  /** How many cards have been swiped away so far — also the index of the current top card. */
  readonly index: number;
  /** Ids swiped left ("review later"), accumulated across the whole session. */
  readonly reviewIds: ReadonlySet<string>;
}

export interface DeckProgress {
  /** 1-based count of cards swiped away so far, capped at `total` (e.g. "3" in "3 / 10"). */
  readonly current: number;
  readonly total: number;
  readonly done: boolean;
}

export function initialDeckState(): DeckState {
  return { index: 0, reviewIds: new Set() };
}

/**
 * Advances the deck past the current card. `direction: 'left'` additionally records `id` into
 * the review set (a plain `Set`, so re-swiping the same id left is a no-op beyond the index).
 * Never mutates `state` — callers (a `useReducer`) rely on referential identity to re-render.
 */
export function swipeDeck(state: DeckState, direction: SwipeDirection, id: string): DeckState {
  if (direction === 'right') {
    return { index: state.index + 1, reviewIds: state.reviewIds };
  }
  const reviewIds = new Set(state.reviewIds);
  reviewIds.add(id);
  return { index: state.index + 1, reviewIds };
}

/** Derives the "n / total" progress + exhaustion flag `Deck.tsx` renders from `state`. */
export function deckProgress(state: DeckState, total: number): DeckProgress {
  const current = Math.min(state.index, total);
  return { current, total, done: current >= total };
}
