import './global.css';

import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QuizScreen } from './src/QuizScreen';

// Perminou — prototype. See apps/mobile/README.md for what this is (and
// isn't). The real mobile app (Plan 4) is designed in the `perminou-mobile-ui`
// skill and ADR 0004; this app deliberately skips rpc-react/@effect/rpc and
// React Native Reusables to stay a minimal, runnable proof of the quiz UI.
export default function App() {
  return (
    <SafeAreaProvider>
      <QuizScreen />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
