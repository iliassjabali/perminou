// MediaProbe adapter — checks whether a public media file exists on NARSA
// over anonymous HTTP (no session). Never touches Playwright, never fails:
// a HEAD request that never resolves cleanly (network error/timeout) is
// retried a bounded, gentle number of times and then treated as "absent"
// (same as a 404) — a probe must never crash a harvest.
import { Duration, Effect, Layer, Schedule } from 'effect';
import got from 'got';
import { MediaProbe } from '../domain/ports/media-probe';

const BASE_URL = 'https://perminou.narsa.gov.ma';
const REQUEST_TIMEOUT_MS = 5000;

// Gentle, bounded backoff: initial attempt + up to 2 retries (3 tries total),
// exponential starting at 200ms. Only reached on network errors/timeouts —
// a definitive HTTP response (2xx/404/5xx) resolves the promise and never
// enters this schedule at all.
const gentleRetry = Schedule.exponential(Duration.millis(200)).pipe(Schedule.intersect(Schedule.recurs(2)));

const resolveUrl = (url: string) => new URL(url, BASE_URL).toString();

const headStatus = (url: string): Effect.Effect<number, unknown> =>
  Effect.tryPromise({
    try: () =>
      got
        .head(resolveUrl(url), {
          timeout: { request: REQUEST_TIMEOUT_MS },
          throwHttpErrors: false, // a 404/5xx is a definitive answer, not a thrown error
          retry: { limit: 0 }, // we drive retries ourselves via Schedule, gently
        })
        .then((res) => res.statusCode),
    catch: (cause) => cause,
  });

const exists = (url: string): Effect.Effect<boolean, never> =>
  headStatus(url).pipe(
    Effect.retry(gentleRetry),
    Effect.map((status) => status >= 200 && status < 300),
    Effect.catchAll(() => Effect.succeed(false)),
  );

export const MediaProbeLive = Layer.succeed(MediaProbe, { exists });
