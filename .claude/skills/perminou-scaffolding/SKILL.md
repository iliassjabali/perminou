---
name: perminou-scaffolding
description: Use BEFORE hand-writing any new backend feature, domain entity, or mobile screen in Perminou — scaffold the boilerplate with plop instead. Covers the `pnpm plop` generators (feature / entity / screen), what files each produces, the auto-wiring markers, and the "scaffold, don't hand-write" rule. Applies whenever you're about to create a new use-case + rpc + handler, a new Effect Schema entity, or a new Expo screen.
---

# Perminou Scaffolding

## Overview

Every feature in this hexagonal Effect monorepo is the **same file-shape** (rpc def + use-case + handler + test; or entity + test; or screen). Hand-writing that boilerplate is wasted effort and drifts from convention. **Scaffold it with plop, then fill only the logic.**

**Rule:** before creating a new feature/entity/screen by hand, run the matching generator. Hand-writing the boilerplate is the exception, not the default.

## Generators

Run `pnpm plop` for the menu, or `pnpm plop <generator>` directly.

| Generator | Command | Produces |
|---|---|---|
| **feature** | `pnpm plop feature` | a backend vertical slice: `@effect/rpc` def + Effect use-case + handler + **failing** Vitest test, and auto-exports the rpc |
| **entity** | `pnpm plop entity` | a domain Effect-Schema entity + failing test, auto-exported from `packages/domain` |
| **screen** | `pnpm plop screen` | an Expo screen wired to the `api` proxy (NativeWind) |

## `feature` — the main one

```
pnpm plop feature
  ? Bounded context: catalog
  ? Operation name:  GetChapterQuestions
```

Creates (and the test is intentionally **red** — you're now in TDD's red step):

```
packages/rpc-contract/src/rpcs/get-chapter-questions.rpc.ts    # Rpc.make('GetChapterQuestions', {...})
apps/backend/src/catalog/get-chapter-questions.usecase.ts      # pure Effect use-case (ports via R)
apps/backend/src/catalog/get-chapter-questions.handler.ts      # thin inbound adapter → RpcGroup.toLayer
apps/backend/src/catalog/get-chapter-questions.usecase.test.ts # failing Vitest test to drive TDD
```

and appends the rpc export into `packages/rpc-contract/src/index.ts`.

Then you: define the payload/success/error schemas, write the real test (red), implement the use-case (green), register the handler in the context's `RpcGroup.toLayer({...})`.

## Auto-wiring markers

Barrels ship with marker comments so generators wire exports with **zero manual edits**:

```ts
// packages/rpc-contract/src/index.ts
/* plop:rpc-export */
// packages/domain/src/index.ts
/* plop:entity-export */
```

Keep these markers in place. If you delete one, the corresponding generator's `append` action silently no-ops.

## Common mistakes

- **Hand-writing a new use-case + rpc + handler.** Run `pnpm plop feature` first; edit the output.
- **Deleting the `/* plop:* */` markers.** They're how exports auto-wire; keep them.
- **Leaving the generated `// TODO`s.** Scaffolds are starting points — the payload schemas, real test, and use-case logic are yours to fill (that's the only code you should write by hand).
- **Renaming generated files off-convention.** The generator names encode the convention (`kebab-case` files, `PascalCase` rpc tags); keep them so future readers can predict paths.
- **Adding a new generator ad hoc in a screen.** New generators go in `plopfile.mjs` with an inline template, then document them here.

## Extending

New repetitive shape? Add a `plop.setGenerator(...)` in `plopfile.mjs` (inline `template` strings keep it one file), then add a row to the table above. Prefer one generator done well over many half-baked ones.

## Related skills

- `perminou-architecture` — the conventions the generators encode
- `perminou-effect` — what to fill into a generated use-case/handler
- `perminou-mobile-ui` — what to fill into a generated screen (the `api` proxy)
