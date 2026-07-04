import { describe, expect, it } from 'vitest';
import { MEDIA_HOST, absoluteMediaUrl, mediaUrl } from '../src/lib/media';

describe('media', () => {
  it('re-exports domain mediaUrl unchanged', () => {
    expect(mediaUrl('image', 'fr', '46' as never)).toBe('/media/uploads/questions/images/fr/46.png');
  });

  it('absoluteMediaUrl prefixes the NARSA public media host, not our API host', () => {
    expect(absoluteMediaUrl('sound', 'ar', '565' as never)).toBe(
      'https://perminou.narsa.gov.ma/media/uploads/questions/son/ar/565.mp3',
    );
  });

  it('MEDIA_HOST is the NARSA public host, hardcoded (not derived from EXPO_PUBLIC_API_URL)', () => {
    expect(MEDIA_HOST).toBe('https://perminou.narsa.gov.ma');
  });
});
