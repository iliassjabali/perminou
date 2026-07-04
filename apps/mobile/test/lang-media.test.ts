// Perminou — Plan 4, Task 5: lang store + media URL integration.
//
// `QuestionCard`/`Deck` derive image/audio URLs from whatever `lang` the screen passes down
// (ultimately sourced from `useLang()`, ADR-free plain prop threading — see `PracticeScreen.tsx`
// etc). This test asserts the piece that actually matters for the toggle: for the SAME question
// id, `absoluteMediaUrl` resolves to a different host path (`/fr/` vs `/ar/`) as the persisted
// lang (via `createLangStore`) is switched — i.e. toggling the store is sufficient to swap which
// media file gets fetched, with no other moving part required.
import { describe, expect, it } from 'vitest';
import { createLangStore } from '../src/lib/lang';
import { absoluteMediaUrl, type QuestionId } from '../src/lib/media';
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

describe('lang store drives media URL selection', () => {
  const id = '46' as QuestionId;

  it('defaults to the fr media path', () => {
    const store = createLangStore(new FakeStorage());
    expect(absoluteMediaUrl('image', store.getLang(), id)).toBe(
      'https://perminou.narsa.gov.ma/media/uploads/questions/images/fr/46.png',
    );
  });

  it('switches to the ar media path once the store is toggled', () => {
    const store = createLangStore(new FakeStorage());
    store.setLang('ar');
    expect(absoluteMediaUrl('image', store.getLang(), id)).toBe(
      'https://perminou.narsa.gov.ma/media/uploads/questions/images/ar/46.png',
    );
  });

  it('switches back to fr when toggled again', () => {
    const store = createLangStore(new FakeStorage());
    store.setLang('ar');
    store.setLang('fr');
    expect(absoluteMediaUrl('sound', store.getLang(), id)).toBe(
      'https://perminou.narsa.gov.ma/media/uploads/questions/son/fr/46.mp3',
    );
  });

  it('the fr and ar URLs for the same id differ only in the lang path segment', () => {
    const store = createLangStore(new FakeStorage());
    const frUrl = absoluteMediaUrl('sound', store.getLang(), id);
    store.setLang('ar');
    const arUrl = absoluteMediaUrl('sound', store.getLang(), id);

    expect(frUrl).not.toBe(arUrl);
    expect(frUrl.replace('/fr/', '/ar/')).toBe(arUrl);
  });
});
