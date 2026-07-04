import { Context, Effect } from 'effect';
import type { AuthError, SessionExpired, FetchError } from '../errors';

export interface Session { readonly cookie: string; }
export interface RawQuestion { readonly id: number; readonly category: string; readonly hasImage: boolean; readonly hasAudio: boolean; readonly answers: ReadonlyArray<{ narsaId: number; index: number }>; }
export interface RawCorrection { readonly correctByQuestion: Readonly<Record<number, number[]>>; }

export class SourceGateway extends Context.Tag('SourceGateway')<
  SourceGateway,
  {
    readonly login: () => Effect.Effect<Session, AuthError>;
    readonly nextExamQuestion: (s: Session) => Effect.Effect<RawQuestion, FetchError | SessionExpired>;
    readonly submitAndAdvance: (s: Session, answerNarsaIds: number[]) => Effect.Effect<'more' | 'done', FetchError | SessionExpired>;
    readonly fetchCorrection: (s: Session) => Effect.Effect<RawCorrection, FetchError | SessionExpired>;
  }
>() {}
