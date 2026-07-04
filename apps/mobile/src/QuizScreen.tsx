// Perminou — Plan 4, Task 1 placeholder screen.
//
// Proves the rpc-react data flow works end-to-end on the real 385-question bank: renders
// `useDeck('practice')` as a bare list of question ids/categories, with a visible
// no-API/loading/loaded state. This is NOT the real Tinder deck — Tasks 2-3 replace this with
// the audio-first `QuestionCard`/`Deck` swipe UI (see the Plan 4 doc).
import { ScrollView, Text, View } from 'react-native';

import { useDeck } from './features/deck/use-deck';

export function QuizScreen() {
  const { questions, isLoading, error } = useDeck('practice');

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-4 pb-12">
      <Text className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Perminou — data wiring check (Task 1)
      </Text>

      {error ? (
        <Text testID="deck-error" className="text-base font-semibold text-red-600">
          No API — check the backend is running and EXPO_PUBLIC_API_URL is reachable.
          {'\n'}
          {error instanceof Error ? error.message : String(error)}
        </Text>
      ) : isLoading ? (
        <Text testID="deck-loading" className="text-base text-gray-500">
          Loading questions…
        </Text>
      ) : (
        <>
          <Text testID="deck-count" className="mb-4 text-lg font-bold text-gray-900">
            {questions.length} questions loaded
          </Text>
          <View>
            {questions.map((q) => (
              <Text key={q.id} className="border-b border-gray-100 py-2 text-base text-gray-800">
                #{q.id} — {q.category}
              </Text>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
