import './global.css';

import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PerminouRpcReactProvider } from '@perminou/rpc-react/native';
import { MMKV } from 'react-native-mmkv';

import { HomeScreen } from './src/screens/HomeScreen';
import { PracticeScreen } from './src/screens/PracticeScreen';
import { ExamScreen } from './src/screens/ExamScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { LangProvider, LANG_STORE_ID } from './src/lib/lang';
import type { RootStackParamList } from './src/navigation/types';

// Perminou — Plan 4, Task 4: `HomeScreen`'s menu (Practice / Mock Exam / Review) is now the app's
// entry point, replacing Task 3's direct-to-`PracticeScreen` wiring. Navigation is a minimal
// `@react-navigation/native-stack` (over `expo-router`) — this app has only four flat screens and
// no route params, so the stack avoids expo-router's extra entry-point/babel/metro restructuring
// for no real UX benefit here. `EXPO_PUBLIC_API_URL` is the backend host; the `@effect/rpc`
// endpoint itself is mounted at `/rpc` (see apps/backend/src/http.ts), appended below.
// `GestureHandlerRootView` must wrap the whole app exactly once, at the root, for
// `react-native-gesture-handler` (the deck's swipe gestures) to work at all.
//
// Task 5: `LangProvider` wraps the navigation tree (above `NavigationContainer`, per the plan) so
// every screen can read/toggle the fr/ar language via `useLang()`. It's handed its own `MMKV`
// instance here — same DI pattern as the review store (`HomeScreen`/`PracticeScreen`/
// `ReviewScreen` each construct `new MMKV({ id: REVIEW_STORE_ID })`) — kept separate from both the
// review-set store and `PerminouRpcReactProvider`'s query-cache store.
const API_HOST = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [langStorage] = useState(() => new MMKV({ id: LANG_STORE_ID }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PerminouRpcReactProvider baseUrl={`${API_HOST}/rpc`}>
          <LangProvider storage={langStorage}>
            <NavigationContainer>
              <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen
                  name="Practice"
                  component={PracticeScreen}
                  options={{ headerShown: true, title: 'Practice' }}
                />
                <Stack.Screen
                  name="Exam"
                  component={ExamScreen}
                  options={{ headerShown: true, title: 'Mock Exam' }}
                />
                <Stack.Screen
                  name="Review"
                  component={ReviewScreen}
                  options={{ headerShown: true, title: 'Review' }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </LangProvider>
        </PerminouRpcReactProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
