import { Context, Effect } from 'effect';

/**
 * Media (image/audio) is served PUBLICLY at
 * `/media/uploads/questions/{images|son}/{fr|ar}/{id}.{png|mp3}` — no session
 * required. `exists` is used to set `hasImage`/`hasAudio` per language.
 *
 * The error channel is `never`: a probe can never crash a harvest. A network
 * error, after the adapter's own retries, resolves to `false` (treated the
 * same as a 404 — "not present").
 */
export class MediaProbe extends Context.Tag('MediaProbe')<
  MediaProbe,
  {
    readonly exists: (url: string) => Effect.Effect<boolean, never>;
  }
>() {}
