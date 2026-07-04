import { Context, Effect } from 'effect';
import type { AuthError, SessionExpired, FetchError } from '../errors';

export interface Session { readonly cookie: string; }
export interface RawQuestion { readonly id: number; readonly category: string; readonly hasImage: boolean; readonly hasAudio: boolean; readonly answers: ReadonlyArray<{ narsaId: number; index: number }>; }
/**
 * `correctByQuestion[id]` is the set of correct answer **indices** (the
 * 1-based position each answer was presented in on the question page —
 * matches `RawQuestion.answers[].index`), NOT `narsaId`s. The NARSA
 * correction markup never exposes an answer's own DB id, only its
 * position, so callers must join on `index`. Discovered while recording
 * `apps/scraper/fixtures/exam-correction.html` (Task 5).
 */
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
