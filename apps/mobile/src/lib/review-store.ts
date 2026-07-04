// Perminou — Plan 4, Task 3: the persisted "review later" id set.
//
// Mirrors `@perminou/rpc-react`'s MMKV persister pattern (`packages/rpc-react/src/persist.ts`):
// built against a minimal `KeyValueStorage` interface (matching `react-native-mmkv`'s
// `set`/`getString`/`delete`), so this loads and is testable under plain Vitest/Node with a fake
// — no native module required. `PracticeScreen.tsx` wires a real `MMKV` instance to it on-device.
export interface KeyValueStorage {
  set(key: string, value: string): void;
  getString(key: string): string | undefined;
  delete(key: string): void;
}

/** Storage key the review set is persisted under, unless overridden. */
export const REVIEW_SET_KEY = 'perminou-review-set';

export interface ReviewStore {
  /** Ids swiped left, in the order they were first added. */
  readonly getIds: () => readonly string[];
  /** Records `id`; a no-op if it's already in the set (no duplicate growth). */
  readonly addId: (id: string) => void;
  readonly clear: () => void;
}

function parseIds(raw: string | undefined): readonly string[] {
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    // Corrupt/foreign data under this key — treat as an empty set rather than throwing.
    return [];
  }
}

/** Builds a review-id store backed by any `KeyValueStorage` (real `MMKV`, or a fake in tests). */
export function createReviewStore(storage: KeyValueStorage, key: string = REVIEW_SET_KEY): ReviewStore {
  return {
    getIds: () => parseIds(storage.getString(key)),
    addId: (id: string) => {
      const ids = parseIds(storage.getString(key));
      if (ids.includes(id)) return;
      storage.set(key, JSON.stringify([...ids, id]));
    },
    clear: () => storage.delete(key),
  };
}
