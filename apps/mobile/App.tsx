import './global.css';

import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PerminouRpcReactProvider } from '@perminou/rpc-react/native';

import { PracticeScreen } from './src/screens/PracticeScreen';

// Perminou — Plan 4, Task 3: the real swipeable Practice deck is now the app's main screen,
// replacing Task 1's placeholder `QuizScreen` list. `EXPO_PUBLIC_API_URL` is the backend host;
// the `@effect/rpc` endpoint itself is mounted at `/rpc` (see apps/backend/src/http.ts), appended
// below. `GestureHandlerRootView` must wrap the whole app exactly once, at the root, for
// `react-native-gesture-handler` (the deck's swipe gestures) to work at all.
const API_HOST = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PerminouRpcReactProvider baseUrl={`${API_HOST}/rpc`}>
          <PracticeScreen />
        </PerminouRpcReactProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
