import * as React from 'react';
import { Effect, Exit, Scope } from 'effect';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeExamClient, type ExamClient } from './client';

const ExamClientContext = React.createContext<Promise<ExamClient> | null>(null);

export interface RpcReactProviderProps {
  /** The backend's `/rpc` endpoint. Ignored when `client` is provided. */
  readonly baseUrl?: string;
  /** Inject a client directly — used by tests to avoid any real network. */
  readonly client?: ExamClient;
  /** Reuse an existing `QueryClient` (e.g. one with a persisted cache); defaults to a fresh one. */
  readonly queryClient?: QueryClient;
  readonly children: React.ReactNode;
}

interface ManagedClient {
  readonly promise: Promise<ExamClient>;
  /** Present only when this provider built the client itself (and so owns its lifetime). */
  readonly scope: Scope.CloseableScope | null;
}

// The imperative `prefetch` API (see `api.ts`) has no React context to read from, so the most
// recently mounted provider's client is also tracked here as a plain module-level singleton.
let activeExamClientPromise: Promise<ExamClient> | null = null;

const buildManagedClient = (baseUrl: string): ManagedClient => {
  // `makeExamClient` requires a `Scope` (see its doc comment): we open one here and keep it open
  // for as long as the provider is mounted, instead of closing it right after construction.
  const scope = Effect.runSync(Scope.make());
  const promise = Effect.runPromise(makeExamClient(baseUrl).pipe(Effect.provideService(Scope.Scope, scope)));
  return { promise, scope };
};

export const RpcReactProvider = (props: RpcReactProviderProps): React.ReactElement => {
  const { baseUrl, client, children } = props;
  const [defaultQueryClient] = React.useState(() => props.queryClient ?? new QueryClient());

  const managed = React.useMemo<ManagedClient>(() => {
    if (client) return { promise: Promise.resolve(client), scope: null };
    if (!baseUrl) {
      throw new Error('RpcReactProvider requires either a `client` prop (tests) or a `baseUrl` prop.');
    }
    return buildManagedClient(baseUrl);
  }, [client, baseUrl]);

  React.useEffect(() => {
    activeExamClientPromise = managed.promise;
    return () => {
      if (activeExamClientPromise === managed.promise) activeExamClientPromise = null;
      if (managed.scope) void Effect.runPromise(Scope.close(managed.scope, Exit.succeed(undefined)));
    };
  }, [managed]);

  return (
    <QueryClientProvider client={defaultQueryClient}>
      <ExamClientContext.Provider value={managed.promise}>{children}</ExamClientContext.Provider>
    </QueryClientProvider>
  );
};

/** Hook form — reads the client promise from the nearest `RpcReactProvider`. */
export const useExamClientPromise = (): Promise<ExamClient> => {
  const ctx = React.useContext(ExamClientContext);
  if (!ctx) throw new Error('useExamClientPromise must be used within an RpcReactProvider.');
  return ctx;
};

/** Non-hook form for imperative use (e.g. `api.exam.getExam.prefetch(...)` outside render). */
export const getActiveExamClientPromise = (): Promise<ExamClient> => {
  if (!activeExamClientPromise) {
    throw new Error('No active RpcReactProvider — mount one before calling `prefetch`.');
  }
  return activeExamClientPromise;
};
