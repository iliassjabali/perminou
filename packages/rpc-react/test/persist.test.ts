import { expect, test } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  createStoragePersister,
  persistNow,
  restoreNow,
  PERSISTED_QUERY_DEFAULT_OPTIONS,
  DEFAULT_PERSIST_KEY,
  type KeyValueStorage,
} from '../src/persist';

// Plan 3, Task 3: the MMKV persister. `react-native-mmkv` is a native module that can't load
// under Node/Vitest, so the persister is built against a minimal `KeyValueStorage` interface
// (`set`/`getString`/`delete` — matching MMKV's own API) and exercised here with a fake backed
// by a plain `Map`. `native.ts` (the Expo preset) passes a real `MMKV` instance at the app layer.

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

const examQueryKey = ['exam', 'GetExam', { count: 2 }] as const;
const examQuestions = [{ id: '1' }, { id: '2' }];

test('persists a query client cache to storage and restores it into a fresh client', async () => {
  const storage = new FakeStorage();
  const persister = createStoragePersister(storage);

  const sourceClient = new QueryClient();
  sourceClient.setQueryData(examQueryKey, examQuestions);

  await persistNow(sourceClient, persister);
  expect(storage.getString(DEFAULT_PERSIST_KEY)).toBeDefined();

  const restoredClient = new QueryClient();
  expect(restoredClient.getQueryData(examQueryKey)).toBeUndefined();

  await restoreNow(restoredClient, persister);
  expect(restoredClient.getQueryData(examQueryKey)).toEqual(examQuestions);
});

test('createStoragePersister supports a custom storage key and removeClient clears it', async () => {
  const storage = new FakeStorage();
  const persister = createStoragePersister(storage, 'custom-key');

  const client = new QueryClient();
  client.setQueryData(['a'], 1);
  await persistNow(client, persister);

  expect(storage.getString('custom-key')).toBeDefined();
  expect(storage.getString(DEFAULT_PERSIST_KEY)).toBeUndefined();

  await persister.removeClient();
  expect(storage.getString('custom-key')).toBeUndefined();
});

test('restoreClient returns undefined when nothing has been persisted yet', async () => {
  const storage = new FakeStorage();
  const persister = createStoragePersister(storage);
  expect(await persister.restoreClient()).toBeUndefined();
});

test('persisted query defaults keep the bank cached long-term', () => {
  expect(PERSISTED_QUERY_DEFAULT_OPTIONS.gcTime).toBe(Number.POSITIVE_INFINITY);
  expect(PERSISTED_QUERY_DEFAULT_OPTIONS.staleTime).toBe(1000 * 60 * 60 * 24);
});
