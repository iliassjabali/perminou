// Perminou code generators. Run: `pnpm plop <generator>` (or `pnpm plop` for the menu).
// Philosophy: scaffold the repetitive hexagonal/Effect boilerplate; a human/agent only fills the logic.
// See .claude/skills/perminou-scaffolding.

const RPC_TPL = `import { Rpc } from '@effect/rpc';
import { Schema } from 'effect';

// TODO: define payload / success / error schemas (typed errors travel over the wire).
export const {{camelCase name}}Rpc = Rpc.make('{{pascalCase name}}', {
  payload: {},
  success: Schema.Unknown,
  error: Schema.Never,
});
`;

const USECASE_TPL = `import { Effect } from 'effect';
// TODO: import the ports this use-case needs, e.g. { QuestionRepository } from '@perminou/domain'.

// Pure Effect use-case. Ports appear in the R channel; failures in the E channel.
export const {{camelCase name}} = (input: unknown) =>
  Effect.gen(function* () {
    // const repo = yield* QuestionRepository;   // <- a port
    // TODO: implement
    return yield* Effect.succeed(input as never);
  });
`;

const HANDLER_TPL = `import { {{camelCase name}} } from './{{kebabCase name}}.usecase';

// Thin inbound adapter: map the RPC tag to the use-case. Register in the context's RpcGroup.toLayer({...}).
export const {{camelCase name}}Handler = { '{{pascalCase name}}': {{camelCase name}} } as const;
`;

const TEST_TPL = `import { test, expect } from 'vitest';
import { Effect } from 'effect';
import { {{camelCase name}} } from './{{kebabCase name}}.usecase';

// RED first: describe the behavior, provide fake port Layers, then implement the use-case.
test('{{camelCase name}}: TODO describe behavior', async () => {
  const out = await Effect.runPromise({{camelCase name}}({}));
  expect(out).toBeDefined();
});
`;

const ENTITY_TPL = `import { Schema } from 'effect';

export const {{pascalCase name}} = Schema.Struct({
  // TODO: fields, e.g. id: Schema.String, text: Schema.NonEmptyString
});
export type {{pascalCase name}} = Schema.Schema.Type<typeof {{pascalCase name}}>;
export const decode{{pascalCase name}} = Schema.decodeUnknown({{pascalCase name}});
`;

const ENTITY_TEST_TPL = `import { test, expect } from 'vitest';
import { Schema } from 'effect';
import { {{pascalCase name}} } from '../src/entities/{{kebabCase name}}';

test('{{pascalCase name}}: decodes a valid value', () => {
  const v = Schema.decodeUnknownSync({{pascalCase name}})({ /* TODO */ });
  expect(v).toBeDefined();
});
`;

const SCREEN_TPL = `import { View, Text } from 'react-native';
import { api } from '@perminou/rpc-react';   // one import — typed proxy over the contract

export default function {{pascalCase name}}Screen() {
  // const { data, isLoading, error } = api.<ns>.<rpc>.useQuery({ /* TODO */ });
  return (
    <View className="flex-1 bg-background p-4">
      <Text className="text-lg text-foreground">{{pascalCase name}}</Text>
    </View>
  );
}
`;

/** @param {import('plop').NodePlopAPI} plop */
export default function (plop) {
  plop.setGenerator('feature', {
    description: 'Backend feature slice: @effect/rpc def + Effect use-case + handler + failing test',
    prompts: [
      { type: 'input', name: 'context', message: 'Bounded context (e.g. catalog):' },
      { type: 'input', name: 'name', message: 'Operation name (e.g. GetChapterQuestions):' },
    ],
    actions: [
      { type: 'add', path: 'packages/rpc-contract/src/rpcs/{{kebabCase name}}.rpc.ts', template: RPC_TPL },
      { type: 'add', path: 'apps/backend/src/{{kebabCase context}}/{{kebabCase name}}.usecase.ts', template: USECASE_TPL },
      { type: 'add', path: 'apps/backend/src/{{kebabCase context}}/{{kebabCase name}}.handler.ts', template: HANDLER_TPL },
      { type: 'add', path: 'apps/backend/src/{{kebabCase context}}/{{kebabCase name}}.usecase.test.ts', template: TEST_TPL },
      // auto-wire the rpc export (barrel ships with the marker)
      { type: 'append', path: 'packages/rpc-contract/src/index.ts', pattern: '/* plop:rpc-export */',
        template: "export * from './rpcs/{{kebabCase name}}.rpc';" },
    ],
  });

  plop.setGenerator('entity', {
    description: 'Domain Effect-Schema entity + failing test',
    prompts: [{ type: 'input', name: 'name', message: 'Entity name (e.g. Exam):' }],
    actions: [
      { type: 'add', path: 'packages/domain/src/entities/{{kebabCase name}}.ts', template: ENTITY_TPL },
      { type: 'add', path: 'packages/domain/test/{{kebabCase name}}.test.ts', template: ENTITY_TEST_TPL },
      { type: 'append', path: 'packages/domain/src/index.ts', pattern: '/* plop:entity-export */',
        template: "export * from './entities/{{kebabCase name}}';" },
    ],
  });

  plop.setGenerator('screen', {
    description: 'Expo mobile screen wired to the api proxy',
    prompts: [{ type: 'input', name: 'name', message: 'Screen name (e.g. ChapterQuiz):' }],
    actions: [
      { type: 'add', path: 'apps/mobile/app/{{kebabCase name}}.tsx', template: SCREEN_TPL },
    ],
  });
}
