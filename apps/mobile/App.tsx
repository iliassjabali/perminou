import './global.css';

import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PerminouRpcReactProvider } from '@perminou/rpc-react/native';

import { QuizScreen } from './src/QuizScreen';

// Perminou — Plan 4, Task 1: real data wiring over the throwaway prototype UI (still evolving —
// see apps/mobile/README.md). `EXPO_PUBLIC_API_URL` is the backend host; the `@effect/rpc`
// endpoint itself is mounted at `/rpc` (see apps/backend/src/http.ts), appended below.
const API_HOST = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function App() {
  return (
    <SafeAreaProvider>
      <PerminouRpcReactProvider baseUrl={`${API_HOST}/rpc`}>
        <QuizScreen />
      </PerminouRpcReactProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
