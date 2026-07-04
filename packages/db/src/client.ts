import { PgClient } from '@effect/sql-pg';
import { layer as pgDrizzleLayer } from '@effect/sql-drizzle/Pg';
import { Layer, Config, Redacted } from 'effect';

// Deviations from plan (installed pre-1.0 versions differ from the plan's assumed shape):
// 1. `PgClient.layer(config)` expects `url: Redacted.Redacted<string>` in the installed
//    @effect/sql-pg@0.24.4, not `Config.Config<string>`. The variant that accepts a
//    `Config.Config.Wrap<PgClientConfig>` (so `Config.succeed(...)` values resolve) is
//    `PgClient.layerConfig`. Using that instead of `PgClient.layer` — and the wrapped
//    value itself must already be `Redacted.Redacted<string>`, so we wrap with
//    `Redacted.make` before handing it to `Config.succeed`.
// 2. `layer` is a separate named export from `@effect/sql-drizzle/Pg`, not a static
//    property `PgDrizzle.layer` on the `PgDrizzle` class as the plan's snippet assumes.
export const PgLive = (connectionUri: string) =>
  PgClient.layerConfig({ url: Config.succeed(Redacted.make(connectionUri)) });

export const DrizzleLive = (connectionUri: string) =>
  pgDrizzleLayer.pipe(Layer.provide(PgLive(connectionUri)));
