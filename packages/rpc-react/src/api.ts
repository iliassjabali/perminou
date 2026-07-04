import { Effect } from 'effect';
import type * as Rpc from '@effect/rpc/Rpc';
import type * as RpcGroup from '@effect/rpc/RpcGroup';
import type { QueryClient, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { ExamRpcs } from '@perminou/rpc-contract';
import { rpcQueryKey, useRpcQuery, prefetchRpcQuery } from './query';
import { useExamClientPromise, getActiveExamClientPromise } from './provider';

/** Loosely-typed runtime shape of an `@effect/rpc` client: one callable method per rpc tag. */
type RpcClientLike = Record<string, (payload: unknown) => Effect.Effect<unknown, unknown, never>>;

interface RpcClientAccessor {
  /** Hook form, backed by React context — for use inside `useQuery`. */
  readonly useClientPromise: () => Promise<RpcClientLike>;
  /** Non-hook form, backed by a module-level singleton — for imperative `prefetch`. */
  readonly getActiveClientPromise: () => Promise<RpcClientLike>;
}

/** `true` iff `R`'s payload can be constructed with no arguments (an empty-fields rpc). */
type HasOptionalPayload<R extends Rpc.Any> = {} extends Rpc.PayloadConstructor<R> ? true : false;

type UseQueryFn<R extends Rpc.Any> = HasOptionalPayload<R> extends true
  ? (
      payload?: Rpc.PayloadConstructor<R>,
      options?: Omit<UseQueryOptions<Rpc.Success<R>>, 'queryKey' | 'queryFn'>,
    ) => UseQueryResult<Rpc.Success<R>>
  : (
      payload: Rpc.PayloadConstructor<R>,
      options?: Omit<UseQueryOptions<Rpc.Success<R>>, 'queryKey' | 'queryFn'>,
    ) => UseQueryResult<Rpc.Success<R>>;

type PrefetchFn<R extends Rpc.Any> = HasOptionalPayload<R> extends true
  ? (queryClient: QueryClient, payload?: Rpc.PayloadConstructor<R>) => Promise<void>
  : (queryClient: QueryClient, payload: Rpc.PayloadConstructor<R>) => Promise<void>;

/** Per-rpc surface: `api.<namespace>.<rpcTag lowerCamel>.{useQuery,prefetch}`, typed from the rpc's payload/success schemas. */
export type RpcMethods<Rpcs extends Rpc.Any> = {
  readonly [Current in Rpcs as Uncapitalize<Rpc.Tag<Current>>]: {
    readonly useQuery: UseQueryFn<Current>;
    readonly prefetch: PrefetchFn<Current>;
  };
};

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Builds `{ [namespace]: RpcMethods<Rpcs> }` for one `RpcGroup` — a nested Proxy whose leaves
 * (`useQuery`/`prefetch`) are generated lazily and cached per rpc tag the first time they're
 * accessed. The Proxy is only a runtime dispatch mechanism; its *type* comes from `RpcMethods`,
 * derived from the group's own payload/success Effect Schemas.
 */
const createRpcReact = <Namespace extends string, Rpcs extends Rpc.Any>(
  namespace: Namespace,
  group: RpcGroup.RpcGroup<Rpcs>,
  accessor: RpcClientAccessor,
): Record<Namespace, RpcMethods<Rpcs>> => {
  const leafCache = new Map<string, unknown>();

  const makeThunk = (tag: string, clientPromise: Promise<RpcClientLike>, payload: unknown) => () =>
    clientPromise.then((client) => {
      const call = client[tag];
      if (!call) throw new Error(`No RPC method registered for tag "${tag}" in namespace "${namespace}"`);
      return call(payload ?? {});
    });

  const proxy = new Proxy({} as RpcMethods<Rpcs>, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      const cached = leafCache.get(prop);
      if (cached) return cached;

      const tag = capitalize(prop);
      if (!group.requests.has(tag)) return undefined;

      const leaf = {
        useQuery: (payload?: unknown, options?: object) => {
          const clientPromise = accessor.useClientPromise();
          return useRpcQuery(
            rpcQueryKey(namespace, tag, payload ?? {}),
            makeThunk(tag, clientPromise, payload),
            options as never,
          );
        },
        prefetch: (queryClient: QueryClient, payload?: unknown) => {
          const clientPromise = accessor.getActiveClientPromise();
          return prefetchRpcQuery(queryClient, rpcQueryKey(namespace, tag, payload ?? {}), makeThunk(tag, clientPromise, payload));
        },
      };

      leafCache.set(prop, leaf);
      return leaf;
    },
  });

  return { [namespace]: proxy } as Record<Namespace, RpcMethods<Rpcs>>;
};

export type ExamApi = RpcMethods<RpcGroup.Rpcs<typeof ExamRpcs>>;

export const api: { readonly exam: ExamApi } = {
  ...createRpcReact('exam', ExamRpcs, {
    useClientPromise: useExamClientPromise as RpcClientAccessor['useClientPromise'],
    getActiveClientPromise: getActiveExamClientPromise as RpcClientAccessor['getActiveClientPromise'],
  }),
};
