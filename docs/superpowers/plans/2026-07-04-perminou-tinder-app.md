# Perminou Tinder App Implementation Plan (Plan 4)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. READING: `perminou-mobile-ui`, `perminou-architecture`. The app is Expo + NativeWind + React Native Reusables.

**Goal:** An audio-first "Tinder for questions" deck on the real 385-question bank: swipeable cards, auto-playing audio, tap-to-answer reveal, swipe right=got-it / left=review; Practice + Mock-Exam + Review modes; fr/ar toggle + RTL. Data via `@perminou/rpc-react`.

**Current state:** `apps/mobile` is the throwaway prototype (Expo + NativeWind, one hardcoded QuizScreen). Plan 4 EVOLVES it into the real app — reuse the Expo/NativeWind/expo-image/expo-audio setup; replace `src/*` screens; delete the hardcoded samples.

**Media:** derive URLs client-side from the question id + selected lang via domain `mediaUrl` (`/media/uploads/questions/{images|son}/{fr|ar}/{id}.{png|mp3}`) — media is PUBLIC. Every question has audio (100%).

## Global Constraints
- Expo (Android-first), NativeWind, TypeScript. App talks to the backend ONLY via `@perminou/rpc-react` (`api` proxy + `@perminou/rpc-react/native` persisted provider). Backend base URL from `EXPO_PUBLIC_API_URL`. Commit per green step. Keep `pnpm typecheck` + `pnpm test` green.

### Task 1: App foundation + data wiring
- Add `@perminou/rpc-react`, `@perminou/domain` deps. Wrap the app in `PerminouRpcReactProvider` (from `@perminou/rpc-react/native`) with `baseUrl = process.env.EXPO_PUBLIC_API_URL`. Import Hermes polyfills at entry per the rpc-react README.
- `src/lib/media.ts`: re-export/derive `mediaUrl` from `@perminou/domain`.
- `src/features/deck/use-deck.ts`: a hook returning questions for a mode — Practice = `api.exam.getAllQuestions.useQuery()`, Mock Exam = `api.exam.getExam.useQuery({count:40})`. Loading/error states.
- Delete the prototype `samples.ts` + old QuizScreen; keep AnswerOption (adapt).
- [ ] TDD where possible (a `use-deck` logic test with a mocked api); commit `feat(mobile): rpc-react wiring + deck data hook`.

### Task 2: The question card (audio-first)
- `src/features/deck/QuestionCard.tsx`: shows the image (expo-image, if `hasImage`), an audio play/pause control (expo-audio) that **auto-plays on mount** (every question has audio), and the numbered answer chips (from `answers`, multi-select). Tap answers → local selection; a "Valider" reveals green (correct) / red (wrongly picked) using `answers[].correct`.
- Reuse `AnswerOption` styling (green/red states).
- [ ] Component test (RN Testing Library, jsdom) for the reveal logic; commit `feat(mobile): audio-first question card with reveal`.

### Task 3: Swipe deck + Practice mode
- Add a maintained swipe-deck lib (e.g. `rn-swiper-list` or `react-native-deck-swiper`) OR build with `react-native-reanimated` + `react-native-gesture-handler`.
- `src/features/deck/Deck.tsx`: a stack of `QuestionCard`s. Swipe RIGHT = "got it" (advance), LEFT = "review later" (push id to a review set, persisted). Show progress (n/total).
- `src/screens/PracticeScreen.tsx`: the deck over `use-deck('practice')`.
- [ ] Deck logic test (swipe→advance, left→review set); commit `feat(mobile): swipe deck + practice mode`.

### Task 4: Home menu + Mock Exam + Review
- `src/screens/HomeScreen.tsx`: a menu — **Practice** (all 385), **Mock Exam** (random 40, scored), **Review** (the swiped-left set). NativeWind/RNR cards.
- `src/screens/ExamScreen.tsx`: 40-question deck; on finish, a score summary (correct/total).
- `src/screens/ReviewScreen.tsx`: deck over the persisted review-set ids.
- Navigation via `expo-router` (file-based) or a simple stack.
- [ ] Score-calc test; commit `feat(mobile): home menu + mock exam (scored) + review deck`.

### Task 5: fr/ar language toggle + RTL
- `src/lib/lang.tsx`: a Lang context (`fr`|`ar`, persisted) + toggle. Media URLs use the selected lang; apply `I18nManager`/RTL styles for `ar`.
- Toggle in the Home header.
- [ ] Test that `mediaUrl` switches lang; commit `feat(mobile): fr/ar language toggle + RTL`.

## Run (after build)
`docker compose up -d db` (has 385 questions) → `pnpm --filter @perminou/backend dev` (serves on :3000) → set `EXPO_PUBLIC_API_URL=http://<mac-lan-ip>:3000` → `pnpm --filter mobile start` → Expo Go. Backend `/rpc` must be reachable from the phone (same wifi / LAN IP).

## Self-Review
Covers the Tinder UX (audio-first cards, swipe got-it/review, T2/T3), modes (Practice/Exam/Review, T3/T4), fr/ar+RTL (T5), all on real data via rpc-react (T1). Menu scope = mock-exam/practice/review (course-categories deferred — need more scraping).
