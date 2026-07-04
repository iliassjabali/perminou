import { Effect } from 'effect';
import {
  useQuery as useReactQuery,
  type QueryClient,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';

/**
 * `[namespace, rpcTag, payload]` — stable react-query cache key for a single RPC call.
 * Same shape every time so react-query can dedupe/cache correctly.
 */
export type RpcQueryKey = readonly [namespace: string, rpcTag: string, payload: unknown];

export const rpcQueryKey = (namespace: string, rpcTag: string, payload: unknown): RpcQueryKey =>
  [namespace, rpcTag, payload] as const;

/**
 * Produces the `@effect/rpc` client call as an Effect, given the (possibly still-resolving)
 * client. Kept as a thunk so react-query only pays for constructing/awaiting the client when
 * the query actually runs (and re-runs on every fetch, e.g. refetch/retry).
 */
export type RpcEffectThunk<A> = () =>
  | Effect.Effect<A, unknown, never>
  | Promise<Effect.Effect<A, unknown, never>>;

const runEffectThunk = async <A>(thunk: RpcEffectThunk<A>): Promise<A> => {
  const effect = await thunk();
  return Effect.runPromise(effect);
};

/**
 * Bridges one `@effect/rpc` call to react-query's `useQuery`: builds the queryFn from the
 * Effect thunk and runs it to a Promise via `Effect.runPromise`.
 */
export const useRpcQuery = <A>(
  queryKey: RpcQueryKey,
  thunk: RpcEffectThunk<A>,
  options?: Omit<UseQueryOptions<A>, 'queryKey' | 'queryFn'>,
): UseQueryResult<A> =>
  useReactQuery({
    ...options,
    queryKey,
    queryFn: () => runEffectThunk(thunk),
  });

/**
 * Imperative counterpart of `useRpcQuery`, for warming the cache outside of a component render
 * (e.g. a first-launch prefetch).
 */
export const prefetchRpcQuery = <A>(
  queryClient: QueryClient,
  queryKey: RpcQueryKey,
  thunk: RpcEffectThunk<A>,
): Promise<void> =>
  queryClient.prefetchQuery({
    queryKey,
    queryFn: () => runEffectThunk(thunk),
  });
