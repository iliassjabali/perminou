# Perminou — mobile (prototype)

**This is a throwaway prototype, not the real mobile app.** It exists to prove
that a real NARSA driving-exam question — image, audio, numbered
multi-select answers — can be rendered and interacted with on a phone via
Expo Go.

It deliberately skips everything the real app (Plan 4, see
`.claude/skills/perminou-mobile-ui/SKILL.md` and
`docs/adr/0004-expo-nativewind-rnr.md`) will have:

- No backend, no `rpc-react`, no `@effect/rpc` — the questions below are
  hardcoded in `src/samples.ts`.
- No React Native Reusables (RNR) — components in `src/components/` are
  plain hand-rolled `Pressable`/`View`/`Text`, styled with NativeWind.
  RNR's copy-paste `components/ui/` workflow is scoped to Plan 4.
- No persisted query cache / offline support.
- `correctAnswerIds` in `src/samples.ts` are **DEMO placeholders** — the
  real correct answers come from the scraper (Plan 5).

## Stack

- [Expo](https://expo.dev) SDK 57 (TypeScript)
- [NativeWind](https://www.nativewind.dev) v4 (Tailwind for React Native)
- `expo-image` for the question image (NARSA's public media bucket, no auth)
- `expo-audio` for the question sound clip

## Run it

From the **repo root**:

```bash
pnpm install
```

Then, from `apps/mobile`:

```bash
cd apps/mobile
npx expo start
```

Scan the QR code with **Expo Go** (iOS or Android) to open the app on your
phone. The first screen is the quiz prototype — it starts on Question 46
(Category B). Select one or more numbered answers, tap **Valider** to reveal
correct (green) / wrongly-picked (red) answers, then tap **Suivant** to move
to the next sample question. Questions with a sound clip show a play/pause
button above the answers.

## Verifying it bundles without a device

If you just want to confirm Metro can bundle the app (no simulator/device
needed):

```bash
cd apps/mobile
npx expo export --platform ios   # or --platform web
```

A successful export (no bundling errors) is the proof the app runs.
