import { test, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { MediaProbe } from '../src/domain/ports/media-probe';

/**
 * Contract test: any Layer satisfying MediaProbe must let dependent code
 * check media existence without ever touching the network. This uses a
 * fake Layer backed by a Map<url, boolean> — the real `got`-based adapter
 * is exercised only by the opt-in drift test (Task 8), never here.
 */
const fakeMediaProbe = (known: Map<string, boolean>) =>
  Layer.succeed(MediaProbe, {
    exists: (url: string) => Effect.succeed(known.get(url) ?? false),
  });

test('exists resolves true for a known-present url', async () => {
  const known = new Map([['/media/uploads/questions/images/fr/565.png', true]]);
  const out = await Effect.runPromise(
    Effect.gen(function* () {
      const probe = yield* MediaProbe;
      return yield* probe.exists('/media/uploads/questions/images/fr/565.png');
    }).pipe(Effect.provide(fakeMediaProbe(known))),
  );
  expect(out).toBe(true);
});

test('exists resolves false for a missing url', async () => {
  const known = new Map([['/media/uploads/questions/images/fr/565.png', true]]);
  const out = await Effect.runPromise(
    Effect.gen(function* () {
      const probe = yield* MediaProbe;
      return yield* probe.exists('/media/uploads/questions/son/ar/999.mp3');
    }).pipe(Effect.provide(fakeMediaProbe(known))),
  );
  expect(out).toBe(false);
});

test('exists never fails the Effect — it is typed Effect<boolean, never>', async () => {
  // Type-level proof: this compiles only because MediaProbe.exists has error channel `never`.
  const layer = fakeMediaProbe(new Map());
  const program: Effect.Effect<boolean> = Effect.gen(function* () {
    const probe = yield* MediaProbe;
    return yield* probe.exists('/anything');
  }).pipe(Effect.provide(layer));
  const out = await Effect.runPromise(program);
  expect(out).toBe(false);
});
