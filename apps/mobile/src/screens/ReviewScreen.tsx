// Perminou — Plan 4, Task 4: Review — a deck over the persisted "swiped left" question set.
//
// There's no dedicated `getReviewQuestions` RPC — the review set is a client-only MMKV id list
// (`review-store.ts`), so this screen fetches the full bank the same way Practice does
// (`useDeck('practice')`) and filters it down to the persisted ids via the pure
// `filterReviewQuestions` (unit-tested in `test/review-filter.test.ts`). Empty state when nothing
// has been swiped left yet.
import { useMemo } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { MMKV } from 'react-native-mmkv';

import { Deck } from '../features/deck/Deck';
import { useDeck } from '../features/deck/use-deck';
import { useLang } from '../lib/lang';
import { createReviewStore, REVIEW_STORE_ID } from '../lib/review-store';
import { filterReviewQuestions } from '../lib/review-filter';

export function ReviewScreen() {
  const { lang } = useLang();
  const { questions, isLoading, error } = useDeck('practice');

  // Read once per mount: the review set only grows while swiping in `PracticeScreen`, a
  // different screen — there's no concurrent writer to go stale against while this screen is up.
  const reviewIds = useMemo(() => createReviewStore(new MMKV({ id: REVIEW_STORE_ID })).getIds(), []);
  const reviewQuestions = useMemo(
    () => filterReviewQuestions(questions, reviewIds),
    [questions, reviewIds],
  );

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View testID="review-error" className="flex-1 items-center justify-center p-8">
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
        <View testID="review-loading" className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-500">Loading questions…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (reviewQuestions.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View testID="review-empty" className="flex-1 items-center justify-center p-8">
          <Text className="text-base text-gray-500">
            No questions marked for review yet — swipe left on a question in Practice to add it
            here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Deck questions={reviewQuestions} lang={lang} />
    </SafeAreaView>
  );
}
