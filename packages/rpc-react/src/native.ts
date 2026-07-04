import * as React from 'react';
import { QueryClient } from '@tanstack/react-query';
import { MMKV } from 'react-native-mmkv';
import { RpcReactProvider } from './provider';
import { setupPersistedQueryClient, PERSISTED_QUERY_DEFAULT_OPTIONS } from './persist';

/**
 * Expo-facing preset for `@perminou/rpc-react`. Import this from `@perminou/rpc-react/native`
 * ONLY inside the Expo app — it pulls in `react-native-mmkv`, a native module that can't load
 * under Node/Vitest (see this package's README for the plain-`@perminou/rpc-react` vs
 * `@perminou/rpc-react/native` split, and the Hermes polyfills this preset requires).
 *
 * Plan 3, Task 3 (de-risk gate, ADR 0007): wires one `RpcReactProvider` to a `QueryClient` whose
 * cache is persisted to MMKV with long staleTime/gcTime defaults (the exam bank rarely changes).
 * Typecheck-clean here; exercised end-to-end on-device in Plan 4.
 */

export interface PerminouRpcReactProviderProps {
  /** The backend's `/rpc` endpoint. */
  readonly baseUrl: string;
  readonly children: React.ReactNode;
  /** Override the MMKV instance (e.g. a second cache, or a test double); defaults to a fresh one scoped to this cache. */
  readonly storage?: MMKV;
}

const createDefaultStorage = (): MMKV => new MMKV({ id: 'perminou-rpc-react-cache' });

/**
 * Mount once near the Expo app's root, above any screen that calls `api.*.useQuery` — see
 * `README.md` for the full setup (polyfills import order, entry-point wiring).
 */
export const PerminouRpcReactProvider = (props: PerminouRpcReactProviderProps): React.ReactElement => {
  const { baseUrl, children } = props;

  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: PERSISTED_QUERY_DEFAULT_OPTIONS } }),
  );
  const [storage] = React.useState<MMKV>(() => props.storage ?? createDefaultStorage());

  React.useEffect(() => {
    const handle = setupPersistedQueryClient({ storage, queryClient });
    return () => handle.unsubscribe();
  }, [storage, queryClient]);

  return React.createElement(RpcReactProvider, { baseUrl, queryClient, children });
};
