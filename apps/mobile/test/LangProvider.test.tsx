// Perminou — Plan 4, Task 5: `LangProvider`/`useLang` context wiring.
//
// `LangProvider` takes a `KeyValueStorage` the same way `createReviewStore` does (see
// `review-store.ts`) — `App.tsx` wires a real `MMKV` instance; here a `Map`-backed fake stands in,
// so this renders under plain jsdom (`react-native` aliased to `react-native-web`, per
// `vitest.config.ts`) with no native module involved. Exercises: default lang, toggle, persistence
// across a provider remount sharing the same storage, and that `useLang` outside a provider throws
// with a clear message (a wiring-mistake guard, not user-facing behavior).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LangProvider, useLang } from '../src/lib/lang';
import type { KeyValueStorage } from '../src/lib/review-store';

afterEach(cleanup);

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

function Probe() {
  const { lang, setLang, toggle } = useLang();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <button data-testid="toggle" onClick={toggle} />
      <button data-testid="set-ar" onClick={() => setLang('ar')} />
    </div>
  );
}

describe('LangProvider / useLang', () => {
  it('defaults to fr', () => {
    render(
      <LangProvider storage={new FakeStorage()}>
        <Probe />
      </LangProvider>,
    );
    expect(screen.getByTestId('lang').textContent).toBe('fr');
  });

  it('toggle flips fr -> ar -> fr', () => {
    render(
      <LangProvider storage={new FakeStorage()}>
        <Probe />
      </LangProvider>,
    );
    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('lang').textContent).toBe('ar');
    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('lang').textContent).toBe('fr');
  });

  it('setLang persists so a fresh provider over the same storage picks it back up', () => {
    const storage = new FakeStorage();
    const { unmount } = render(
      <LangProvider storage={storage}>
        <Probe />
      </LangProvider>,
    );
    fireEvent.click(screen.getByTestId('set-ar'));
    expect(screen.getByTestId('lang').textContent).toBe('ar');
    unmount();

    render(
      <LangProvider storage={storage}>
        <Probe />
      </LangProvider>,
    );
    expect(screen.getByTestId('lang').textContent).toBe('ar');
  });

  it('useLang throws outside a LangProvider', () => {
    function Bare() {
      useLang();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/useLang must be used within a LangProvider/);
  });
});
