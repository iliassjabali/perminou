// Perminou — Plan 4, Task 4: the home menu — Practice / Mock Exam / Review.
//
// Three big NativeWind cards, each navigating to its own route (`App.tsx`'s `Stack.Navigator`).
// The Review card's subtitle shows the persisted review-set count, read via the same
// `review-store.ts` + shared `REVIEW_STORE_ID` that `PracticeScreen` writes to. Recomputed on
// every focus (via `useFocusEffect`), not just on mount — react-navigation's native-stack keeps
// `HomeScreen` mounted underneath the other screens, so a plain `useEffect`/`useMemo` on mount
// would go stale after the user practices, swipes some left, and comes back.
import { useCallback, useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { createReviewStore, REVIEW_STORE_ID } from '../lib/review-store';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface MenuCardProps {
  readonly testID: string;
  readonly title: string;
  readonly subtitle: string;
  readonly onPress: () => void;
}

function MenuCard({ testID, title, subtitle, onPress }: MenuCardProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      className="mb-4 rounded-3xl bg-blue-600 p-6 active:opacity-80"
    >
      <Text className="text-xl font-bold text-white">{title}</Text>
      <Text className="mt-1 text-sm text-blue-100">{subtitle}</Text>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: Props) {
  const [reviewCount, setReviewCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const store = createReviewStore(new MMKV({ id: REVIEW_STORE_ID }));
      setReviewCount(store.getIds().length);
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center p-6">
        <Text className="mb-8 text-3xl font-bold text-gray-900">Perminou</Text>

        <MenuCard
          testID="menu-practice"
          title="Practice"
          subtitle="All 385 questions"
          onPress={() => navigation.navigate('Practice')}
        />
        <MenuCard
          testID="menu-exam"
          title="Mock Exam"
          subtitle="40 random questions, scored"
          onPress={() => navigation.navigate('Exam')}
        />
        <MenuCard
          testID="menu-review"
          title="Review"
          subtitle={`${reviewCount} saved for review`}
          onPress={() => navigation.navigate('Review')}
        />
      </View>
    </SafeAreaView>
  );
}
