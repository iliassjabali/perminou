// Perminou — Plan 4, Task 3: the swipeable practice deck.
//
// Swipe RIGHT = "got it" (just advance); swipe LEFT = "review later" (report the question id via
// `onReview`, then advance). The swipe *decision* — which card is current, and which ids have
// been reviewed — lives in the pure `deck-state` reducer (unit-tested in
// `test/deck-state.test.ts`, no gesture lib involved); this component only wires that reducer to
// a `react-native-gesture-handler` pan gesture animated with `react-native-reanimated`, and
// renders `QuestionCard`s. The gesture/animation wiring itself isn't unit-testable under jsdom —
// it's verified by `expo export` bundling cleanly (Plan 4 Task 3 acceptance).
import { useCallback, useReducer } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Lang } from '../../lib/media';
import { deckProgress, initialDeckState, swipeDeck, type DeckState, type SwipeDirection } from './deck-state';
import { QuestionCard } from './QuestionCard';
import type { DeckQuestion } from './use-deck';

export interface DeckProps {
  readonly questions: readonly DeckQuestion[];
  readonly lang: Lang;
  /** Called once per left-swiped question, with its id (Task 3 persists these via a review store). */
  readonly onReview?: (id: string) => void;
}

/** Horizontal drag distance (px) past which a release counts as a swipe rather than a snap-back. */
const SWIPE_THRESHOLD = 120;
const EXIT_DISTANCE = 500;

function swipeReducer(state: DeckState, action: { direction: SwipeDirection; id: string }): DeckState {
  return swipeDeck(state, action.direction, action.id);
}

export function Deck({ questions, lang, onReview }: DeckProps) {
  const [state, dispatch] = useReducer(swipeReducer, undefined, initialDeckState);
  const total = questions.length;
  const progress = deckProgress(state, total);
  const translateX = useSharedValue(0);

  // Runs on the JS thread (via `runOnJS` from the gesture's UI-thread worklet): records the
  // review id (if any) as a side effect, then advances the pure reducer, then resets the
  // animated offset so the next card starts centered.
  const advance = useCallback(
    (direction: SwipeDirection, id: string) => {
      if (direction === 'left') onReview?.(id);
      dispatch({ direction, id });
      translateX.value = 0;
    },
    [onReview, translateX],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { rotate: `${translateX.value / 20}deg` }],
  }));

  if (total === 0) {
    return (
      <View testID="deck-empty" className="flex-1 items-center justify-center p-8">
        <Text className="text-base text-gray-500">No questions to practice.</Text>
      </View>
    );
  }

  if (progress.done) {
    return (
      <View testID="deck-done" className="flex-1 items-center justify-center p-8">
        <Text className="text-xl font-bold text-gray-900">Deck complete</Text>
        <Text testID="deck-progress" className="mt-2 text-base text-gray-500">
          {progress.total} / {progress.total}
        </Text>
      </View>
    );
  }

  const current = questions[state.index]!;

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(EXIT_DISTANCE, { duration: 200 });
        runOnJS(advance)('right', current.id);
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-EXIT_DISTANCE, { duration: 200 });
        runOnJS(advance)('left', current.id);
      } else {
        translateX.value = withSpring(0);
      }
    });

  return (
    <View testID="deck" className="flex-1">
      <View className="items-center py-2">
        <Text testID="deck-progress" className="text-sm font-semibold text-gray-500">
          {progress.current + 1} / {progress.total}
        </Text>
      </View>
      <GestureDetector gesture={gesture}>
        <Animated.View testID="deck-card" style={[{ flex: 1 }, cardStyle]}>
          <QuestionCard question={current} lang={lang} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
