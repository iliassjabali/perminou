// Perminou — Plan 4, Task 3: the persisted "review later" id set.
//
// Mirrors `@perminou/rpc-react`'s MMKV persister pattern (`packages/rpc-react/src/persist.ts` /
// its `persist.test.ts`): built against a minimal `KeyValueStorage` interface matching
// `react-native-mmkv`'s `set`/`getString`/`delete`, so it's testable under plain Vitest/Node with
// a `Map`-backed fake — no native module required. `PracticeScreen.tsx` wires a real `MMKV`
// instance to this at the app layer.
import { describe, expect, it } from 'vitest';
import { createReviewStore, REVIEW_SET_KEY, type KeyValueStorage } from '../src/lib/review-store';

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

describe('createReviewStore', () => {
  it('getIds returns [] when nothing has been persisted yet', () => {
    const store = createReviewStore(new FakeStorage());
    expect(store.getIds()).toEqual([]);
  });

  it('addId persists the id and getIds reflects it', () => {
    const store = createReviewStore(new FakeStorage());
    store.addId('q1');
    expect(store.getIds()).toEqual(['q1']);
  });

  it('addId accumulates across calls, preserving insertion order', () => {
    const store = createReviewStore(new FakeStorage());
    store.addId('q1');
    store.addId('q2');
    expect(store.getIds()).toEqual(['q1', 'q2']);
  });

  it('addId de-duplicates — adding the same id twice does not grow the set', () => {
    const store = createReviewStore(new FakeStorage());
    store.addId('q1');
    store.addId('q1');
    expect(store.getIds()).toEqual(['q1']);
  });

  it('persists under REVIEW_SET_KEY by default, readable across store instances sharing storage', () => {
    const storage = new FakeStorage();
    createReviewStore(storage).addId('q1');
    expect(storage.getString(REVIEW_SET_KEY)).toBeDefined();
    expect(createReviewStore(storage).getIds()).toEqual(['q1']);
  });

  it('supports a custom key, isolated from the default', () => {
    const storage = new FakeStorage();
    createReviewStore(storage, 'custom-key').addId('q1');
    expect(storage.getString('custom-key')).toBeDefined();
    expect(storage.getString(REVIEW_SET_KEY)).toBeUndefined();
  });

  it('clear removes the persisted set', () => {
    const storage = new FakeStorage();
    const store = createReviewStore(storage);
    store.addId('q1');
    store.clear();
    expect(store.getIds()).toEqual([]);
    expect(storage.getString(REVIEW_SET_KEY)).toBeUndefined();
  });

  it('tolerates corrupt/non-JSON persisted data by treating it as empty', () => {
    const storage = new FakeStorage();
    storage.set(REVIEW_SET_KEY, 'not json');
    expect(createReviewStore(storage).getIds()).toEqual([]);
  });
});
