// Perminou — Plan 4, Task 3: Practice mode over the full question bank.
//
// `useDeck('practice')` (Task 1) supplies the real 385-question bank via `@perminou/rpc-react`;
// this screen just handles loading/error/empty and hands the questions to `Deck` (Task 3's
// swipe UI). The review set (questions swiped left) is persisted to a dedicated `MMKV` instance
// via `review-store.ts`'s `KeyValueStorage`-backed store — Task 4's `ReviewScreen` reads the same
// ids back out. Language is hardcoded to `fr` here; Task 5 adds the fr/ar toggle.
import { useMemo } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { MMKV } from 'react-native-mmkv';

import { Deck } from '../features/deck/Deck';
import { useDeck } from '../features/deck/use-deck';
import { createReviewStore, REVIEW_STORE_ID } from '../lib/review-store';

export function PracticeScreen() {
  const { questions, isLoading, error } = useDeck('practice');
  // `reviewStore` is a write-through persister, not screen state: this screen only appends ids as
  // the deck is swiped left; Task 4's ReviewScreen is what reads the accumulated set back out.
  const reviewStore = useMemo(() => createReviewStore(new MMKV({ id: REVIEW_STORE_ID })), []);

  const addToReview = (id: string) => {
    reviewStore.addId(id);
  };

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View testID="practice-error" className="flex-1 items-center justify-center p-8">
          <Text className="text-base font-semibold text-red-600">
            No API — check the backend is running and EXPO_PUBLIC_API_URL is reachable.
            {'\n'}
            {error instanceof Error ? error.message : String(error)}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View testID="practice-loading" className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-500">Loading questions…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View testID="practice-empty" className="flex-1 items-center justify-center p-8">
          <Text className="text-base text-gray-500">No questions available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Deck questions={questions} lang="fr" onReview={addToReview} />
    </SafeAreaView>
  );
}
