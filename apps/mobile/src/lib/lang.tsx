// Perminou — Plan 4, Task 5: the persisted fr/ar language toggle.
//
// `createLangStore` mirrors `review-store.ts`'s `createReviewStore`: built against the same
// minimal `KeyValueStorage` interface (`set`/`getString`/`delete`, matching `react-native-mmkv`),
// so it's testable under plain Vitest/Node with a fake — no native module required
// (`test/lang.test.ts`). `LangProvider` wires that pure store to React context; `App.tsx` passes
// it a real `MMKV` instance (same pattern as `PracticeScreen`/`HomeScreen`/`ReviewScreen` do for
// the review store), so this file itself never imports `react-native-mmkv`.
//
// RTL: `I18nManager.forceRTL`/`allowRTL` are called whenever `lang` changes, but per Expo/React
// Native's own limitation, a *native* RTL layout flip (mirrored `flexDirection`, `writingDirection`
// defaults, etc.) only takes full effect after the app is reloaded/restarted — calling `forceRTL`
// mid-session persists the setting for next launch but does NOT retroactively re-layout already
// mounted native views. Screens that render Arabic content (`HomeScreen`'s header, `QuestionCard`)
// therefore ALSO apply pragmatic per-view style overrides (row-reverse / text-align: right) keyed
// directly off `lang`, so the toggle looks correct within the same session; a full native mirror
// (e.g. `I18nManager`-driven `flexDirection: 'row'` defaults from RN's layout engine) requires the
// user to relaunch the app after toggling.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager } from 'react-native';

import type { Lang } from './media';
import type { KeyValueStorage } from './review-store';

/** Storage key the selected language is persisted under, unless overridden. */
export const LANG_KEY = 'perminou-lang';

/** MMKV instance id for the language store — separate from the review-set and rpc-react caches. */
export const LANG_STORE_ID = 'perminou-lang-store';

const DEFAULT_LANG: Lang = 'fr';

function isLang(value: string | undefined): value is Lang {
  return value === 'fr' || value === 'ar';
}

export interface LangStore {
  /** Currently persisted language, defaulting to `'fr'` if unset or corrupt. */
  readonly getLang: () => Lang;
  /** Persists `lang`. */
  readonly setLang: (lang: Lang) => void;
}

/** Builds a lang store backed by any `KeyValueStorage` (a real `MMKV`, or a fake in tests). */
export function createLangStore(storage: KeyValueStorage, key: string = LANG_KEY): LangStore {
  return {
    getLang: () => {
      const raw = storage.getString(key);
      return isLang(raw) ? raw : DEFAULT_LANG;
    },
    setLang: (lang: Lang) => storage.set(key, lang),
  };
}

export interface LangContextValue {
  readonly lang: Lang;
  readonly setLang: (lang: Lang) => void;
  /** Flips fr <-> ar. */
  readonly toggle: () => void;
}

const LangContext = createContext<LangContextValue | undefined>(undefined);

export interface LangProviderProps {
  readonly children: ReactNode;
  /** Backing storage for the persisted language — a real `MMKV` instance on-device, a fake in tests. */
  readonly storage: KeyValueStorage;
}

/** Mount once near the app root (above navigation) — see `App.tsx`. */
export function LangProvider({ children, storage }: LangProviderProps) {
  const store = useMemo(() => createLangStore(storage), [storage]);
  const [lang, setLangState] = useState<Lang>(() => store.getLang());

  const setLang = useCallback(
    (next: Lang) => {
      store.setLang(next);
      setLangState(next);
    },
    [store],
  );

  const toggle = useCallback(() => {
    setLang(lang === 'fr' ? 'ar' : 'fr');
  }, [lang, setLang]);

  // Best-effort native RTL flag — see the reload caveat in this file's header comment.
  useEffect(() => {
    const rtl = lang === 'ar';
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }, [lang]);

  const value = useMemo<LangContextValue>(() => ({ lang, setLang, toggle }), [lang, setLang, toggle]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (ctx === undefined) throw new Error('useLang must be used within a LangProvider');
  return ctx;
}
