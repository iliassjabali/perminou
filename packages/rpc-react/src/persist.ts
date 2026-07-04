import type { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClient,
  persistQueryClientSave,
  persistQueryClientRestore,
  type Persister,
  type PersistedClient,
} from '@tanstack/react-query-persist-client';

/**
 * Minimal key/value surface the persister needs. Deliberately NOT `react-native-mmkv`'s `MMKV`
 * type — this file must load under plain Node/Vitest (no native module), so it only depends on
 * this structural interface. `native.ts` (the Expo preset, never imported by tests) passes a
 * real `MMKV` instance, which already implements this shape (`set`/`getString`/`delete`).
 */
export interface KeyValueStorage {
  set(key: string, value: string): void;
  getString(key: string): string | undefined;
  delete(key: string): void;
}

/** Storage key the persister writes the whole react-query cache under, unless overridden. */
export const DEFAULT_PERSIST_KEY = 'perminou-rpc-react-cache';

/**
 * Builds a `@tanstack/react-query-persist-client` `Persister` backed by any `KeyValueStorage`
 * (a real `MMKV` instance on-device, a fake `Map`-backed one in tests).
 */
export const createStoragePersister = (storage: KeyValueStorage, key: string = DEFAULT_PERSIST_KEY): Persister => ({
  persistClient: (persistedClient: PersistedClient) => {
    storage.set(key, JSON.stringify(persistedClient));
  },
  restoreClient: () => {
    const cached = storage.getString(key);
    return cached === undefined ? undefined : (JSON.parse(cached) as PersistedClient);
  },
  removeClient: () => {
    storage.delete(key);
  },
});

/**
 * Default `queries` options for a persisted `QueryClient`: the exam bank rarely changes, so
 * cached data is served instantly and kept in memory indefinitely rather than garbage-collected.
 */
export const PERSISTED_QUERY_DEFAULT_OPTIONS = {
  staleTime: 1000 * 60 * 60 * 24, // 24h
  gcTime: Number.POSITIVE_INFINITY,
} as const;

/** Forces an immediate write of `queryClient`'s current cache via `persister`. */
export const persistNow = (queryClient: QueryClient, persister: Persister): Promise<void> =>
  persistQueryClientSave({ queryClient, persister });

/** Restores a previously-persisted cache from `persister` into `queryClient`. */
export const restoreNow = (queryClient: QueryClient, persister: Persister, maxAge?: number): Promise<void> =>
  persistQueryClientRestore({ queryClient, persister, maxAge: maxAge ?? Number.POSITIVE_INFINITY });

export interface SetupPersistedQueryClientOptions {
  readonly storage: KeyValueStorage;
  readonly queryClient: QueryClient;
  /** Overrides `DEFAULT_PERSIST_KEY` — useful when persisting more than one cache. */
  readonly key?: string;
  /**
   * How long a persisted cache stays valid before being discarded on restore. Defaults to
   * Infinity: the bank rarely changes, so stale-but-present data beats an empty cache.
   */
  readonly maxAge?: number;
}

export interface PersistedQueryClientHandle {
  /** Stops the ongoing persistence subscription (e.g. on provider unmount). */
  readonly unsubscribe: () => void;
  /** Resolves once the persisted cache (if any) has been restored into the `QueryClient`. */
  readonly restored: Promise<void>;
}

/**
 * Wires ongoing persistence for `queryClient`: restores whatever was previously persisted to
 * `storage`, then subscribes to keep persisting every subsequent cache change. This is the
 * function the Expo preset (`native.ts`) uses; it is exercised end-to-end in Plan 4, on-device.
 */
export const setupPersistedQueryClient = (options: SetupPersistedQueryClientOptions): PersistedQueryClientHandle => {
  const persister = createStoragePersister(options.storage, options.key);
  const [unsubscribe, restored] = persistQueryClient({
    queryClient: options.queryClient,
    persister,
    maxAge: options.maxAge ?? Number.POSITIVE_INFINITY,
  });
  return { unsubscribe, restored };
};
