// Perminou — media URL helpers.
//
// `@perminou/domain`'s `mediaUrl` builds the *relative* NARSA media path
// (`/media/uploads/questions/{images|son}/{fr|ar}/{id}.{png|mp3}`). That path is served by
// NARSA's own public host, NOT our backend — `EXPO_PUBLIC_API_URL` only points at the
// `@effect/rpc` API. `MEDIA_HOST` is hardcoded here so image/audio URLs never accidentally
// point at our API host.
import { mediaUrl, type Lang, type QuestionId } from '@perminou/domain';

export { mediaUrl };
export type { Lang, QuestionId };

/** NARSA's public media bucket — images/audio are served here directly, no auth required. */
export const MEDIA_HOST = 'https://perminou.narsa.gov.ma';

/** Absolute, fetchable media URL for a question (image or sound), for `expo-image`/`expo-audio`. */
export function absoluteMediaUrl(kind: 'image' | 'sound', lang: Lang, id: QuestionId): string {
  return `${MEDIA_HOST}${mediaUrl(kind, lang, id)}`;
}
