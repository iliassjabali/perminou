import { Data } from 'effect';
export class AuthError extends Data.TaggedError('AuthError')<{ status?: number }> {}
export class SessionExpired extends Data.TaggedError('SessionExpired')<{ url: string }> {}
export class FetchError extends Data.TaggedError('FetchError')<{ url: string; cause: unknown }> {}
export class ScrapeShapeError extends Data.TaggedError('ScrapeShapeError')<{ url: string; reason: string; htmlSnippet: string }> {}
