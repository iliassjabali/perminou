// Perminou — Plan 4, Task 4: Mock Exam — 40 random questions, scored.
//
// `useDeck('exam')` (Task 1) supplies a random 40-question sample via `@perminou/rpc-react`. Each
// card's `onAnswered(id, correct)` (wired through `Deck` from `QuestionCard`'s "Valider") tallies
// a running `ScoreState` via the pure `score.ts` reducer (unit-tested in `test/score.test.ts`, no
// rendering involved). Once `Deck` reports the deck is exhausted (`onComplete`), this screen swaps
// the deck out for a score summary — `correct / total` and the rounded percentage.
import { useCallback, useState } from 'react';
import { SafeAreaView, Text, View } from 'react-native';

import { Deck } from '../features/deck/Deck';
import { useDeck } from '../features/deck/use-deck';
import { initialScore, recordAnswer, scoreSummary, type ScoreState } from '../lib/score';

export function ExamScreen() {
  const { questions, isLoading, error } = useDeck('exam');
  const [score, setScore] = useState<ScoreState>(initialScore());
  const [finished, setFinished] = useState(false);

  const handleAnswered = useCallback((_id: string, correct: boolean) => {
    setScore((prev) => recordAnswer(prev, correct));
  }, []);

  const handleComplete = useCallback(() => setFinished(true), []);

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View testID="exam-error" className="flex-1 items-center justify-center p-8">
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
        <View testID="exam-loading" className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-500">Loading exam…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View testID="exam-empty" className="flex-1 items-center justify-center p-8">
          <Text className="text-base text-gray-500">No questions available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (finished) {
    const summary = scoreSummary(score);
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View testID="exam-summary" className="flex-1 items-center justify-center p-8">
          <Text className="text-2xl font-bold text-gray-900">Exam complete</Text>
          <Text testID="exam-score" className="mt-4 text-xl text-gray-700">
            {summary.correct} / {summary.total}
          </Text>
          <Text testID="exam-percent" className="mt-1 text-base text-gray-500">
            {summary.percent}%
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Deck questions={questions} lang="fr" onAnswered={handleAnswered} onComplete={handleComplete} />
    </SafeAreaView>
  );
}
