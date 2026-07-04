// Perminou — Plan 4, Task 5: the persisted fr/ar language store.
//
// Mirrors `review-store.test.ts`'s pattern: `createLangStore` is built against the same
// `KeyValueStorage` interface (`set`/`getString`/`delete`), so it's testable under plain
// Vitest/Node with a `Map`-backed fake — no native `react-native-mmkv` module required.
// `LangProvider` (a React context, exercised separately in `LangProvider.test.tsx`) wires a real
// `MMKV` instance to this at the app layer (`App.tsx`).
import { describe, expect, it } from 'vitest';
import { createLangStore, LANG_KEY } from '../src/lib/lang';
import type { KeyValueStorage } from '../src/lib/review-store';

class FakeStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  getString(key: string): string | undefined {
    return this.map.get(key);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
}

describe('createLangStore', () => {
  it('getLang defaults to "fr" when nothing has been persisted yet', () => {
    const store = createLangStore(new FakeStorage());
    expect(store.getLang()).toBe('fr');
  });

  it('setLang persists the value and getLang reflects it', () => {
    const store = createLangStore(new FakeStorage());
    store.setLang('ar');
    expect(store.getLang()).toBe('ar');
  });

  it('round-trips across store instances sharing storage, under LANG_KEY', () => {
    const storage = new FakeStorage();
    createLangStore(storage).setLang('ar');
    expect(storage.getString(LANG_KEY)).toBe('ar');
    expect(createLangStore(storage).getLang()).toBe('ar');
  });

  it('supports a custom key, isolated from the default', () => {
    const storage = new FakeStorage();
    createLangStore(storage, 'custom-lang-key').setLang('ar');
    expect(storage.getString('custom-lang-key')).toBe('ar');
    expect(storage.getString(LANG_KEY)).toBeUndefined();
  });

  it('tolerates corrupt/foreign persisted data by defaulting to "fr"', () => {
    const storage = new FakeStorage();
    storage.set(LANG_KEY, 'not-a-lang');
    expect(createLangStore(storage).getLang()).toBe('fr');
  });

  it('toggling fr -> ar -> fr round-trips correctly', () => {
    const store = createLangStore(new FakeStorage());
    expect(store.getLang()).toBe('fr');
    store.setLang('ar');
    expect(store.getLang()).toBe('ar');
    store.setLang('fr');
    expect(store.getLang()).toBe('fr');
  });
});
