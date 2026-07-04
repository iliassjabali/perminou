// Perminou — Plan 4, Task 4: the home menu — Practice / Mock Exam / Review.
//
// Three big NativeWind cards, each navigating to its own route (`App.tsx`'s `Stack.Navigator`).
// The Review card's subtitle shows the persisted review-set count, read via the same
// `review-store.ts` + shared `REVIEW_STORE_ID` that `PracticeScreen` writes to. Recomputed on
// every focus (via `useFocusEffect`), not just on mount — react-navigation's native-stack keeps
// `HomeScreen` mounted underneath the other screens, so a plain `useEffect`/`useMemo` on mount
// would go stale after the user practices, swipes some left, and comes back.
//
// Task 5: the fr/ar toggle lives in this header — `useLang()`'s `toggle()` flips the app-wide
// language (persisted via `LangProvider`, threaded into every screen's `Deck`/`QuestionCard`).
// RTL is pragmatic here, not a full native mirror: the header row reverses and its texts
// right-align when `lang === 'ar'` via plain NativeWind classes; `LangProvider` also calls
// `I18nManager.forceRTL`, but per Expo/RN's own limitation that only takes full effect (mirrored
// `flexDirection` defaults across the whole native tree) after the app is reloaded — see
// `src/lib/lang.tsx`'s header comment.
import { useCallback, useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLang } from '../lib/lang';
import { createReviewStore, REVIEW_STORE_ID } from '../lib/review-store';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface MenuCardProps {
  readonly testID: string;
  readonly title: string;
  readonly subtitle: string;
  readonly onPress: () => void;
  readonly rtl: boolean;
}

function MenuCard({ testID, title, subtitle, onPress, rtl }: MenuCardProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      className="mb-4 rounded-3xl bg-blue-600 p-6 active:opacity-80"
    >
      <Text className={cx('text-xl font-bold text-white', rtl && 'text-right')}>{title}</Text>
      <Text className={cx('mt-1 text-sm text-blue-100', rtl && 'text-right')}>{subtitle}</Text>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { lang, toggle } = useLang();
  const isRTL = lang === 'ar';
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
        <View className={cx('mb-8 items-center justify-between', isRTL ? 'flex-row-reverse' : 'flex-row')}>
          <Text className={cx('text-3xl font-bold text-gray-900', isRTL && 'text-right')}>Perminou</Text>
          <Pressable
            testID="lang-toggle"
            onPress={toggle}
            className="rounded-full bg-gray-100 px-4 py-2 active:opacity-80"
          >
            <Text testID="lang-toggle-label" className="text-sm font-semibold text-gray-700">
              {isRTL ? 'FR' : 'العربية'}
            </Text>
          </Pressable>
        </View>

        <MenuCard
          testID="menu-practice"
          title="Practice"
          subtitle="All 385 questions"
          onPress={() => navigation.navigate('Practice')}
          rtl={isRTL}
        />
        <MenuCard
          testID="menu-exam"
          title="Mock Exam"
          subtitle="40 random questions, scored"
          onPress={() => navigation.navigate('Exam')}
          rtl={isRTL}
        />
        <MenuCard
          testID="menu-review"
          title="Review"
          subtitle={`${reviewCount} saved for review`}
          onPress={() => navigation.navigate('Review')}
          rtl={isRTL}
        />
      </View>
    </SafeAreaView>
  );
}
