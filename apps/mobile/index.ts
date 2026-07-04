// `react-native-gesture-handler` MUST be imported first, before anything else, on every entry
// point (its own docs/setup requirement) — it installs a native event-handling shim that other
// gesture-dependent code (Plan 4 Task 3's `Deck.tsx`) relies on at import time.
import 'react-native-gesture-handler';

// Hermes polyfills — MUST be the first thing evaluated, before any other import (including
// `expo`/`App`). `@effect/rpc`'s client (via `@perminou/rpc-react`) reads `crypto.getRandomValues`
// at module-eval time; Hermes on RN 0.86 doesn't provide it, so importing the polyfill any later
// (e.g. inside a screen) is a silent no-op. See `packages/rpc-react/README.md` ("Hermes
// polyfills"). `TextEncoder`/`TextDecoder` are NOT polyfilled here — Hermes has shipped both
// natively since well before RN 0.86; re-verify against this SDK's release notes if the rpc
// client throws a ReferenceError for either at runtime.
import 'react-native-get-random-values';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
