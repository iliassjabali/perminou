import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Effect } from 'effect';
import { RpcReactProvider } from '../src/provider';
import { api } from '../src/api';
import type { ExamClient } from '../src/client';
import type { QuestionWire } from '@perminou/rpc-contract';

// Plan 3, Task 2: the react-query binding + typed `api` proxy over `@effect/rpc`. No network —
// `RpcReactProvider` is handed a FAKE client so this exercises only our query/proxy wiring.

afterEach(cleanup);

const fakeQuestions: readonly QuestionWire[] = [
  { id: '1', category: 'B', hasImage: false, hasAudio: false, answers: [] },
  { id: '2', category: 'B', hasImage: false, hasAudio: false, answers: [] },
];

// `ExamClient`'s methods are generic (`<AsMailbox, Discard>`, from `@effect/rpc`'s `RpcClient.From`)
// so a plain fake implementation needs a boundary cast rather than a structural match.
const makeFakeClient = (): ExamClient =>
  ({
    GetExam: () => Effect.succeed(fakeQuestions),
    GetAllQuestions: () => Effect.succeed(fakeQuestions),
  }) as unknown as ExamClient;

function ExamList() {
  const { data, isLoading } = api.exam.getExam.useQuery({ count: 2 });
  if (isLoading || !data) return <div data-testid="loading" />;
  return (
    <ul>
      {data.map((q) => (
        <li key={q.id} data-testid="question">
          {q.id}
        </li>
      ))}
    </ul>
  );
}

function AllQuestionsList() {
  const { data, isLoading } = api.exam.getAllQuestions.useQuery();
  if (isLoading || !data) return <div data-testid="loading" />;
  return <div data-testid="all-count">{data.length}</div>;
}

test('api.exam.getExam.useQuery renders questions from a fake client', async () => {
  render(
    <RpcReactProvider client={makeFakeClient()}>
      <ExamList />
    </RpcReactProvider>,
  );

  const items = await screen.findAllByTestId('question');
  expect(items).toHaveLength(2);
  expect(items.map((el) => el.textContent)).toEqual(['1', '2']);
});

test('api.exam.getAllQuestions.useQuery() takes no payload', async () => {
  render(
    <RpcReactProvider client={makeFakeClient()}>
      <AllQuestionsList />
    </RpcReactProvider>,
  );

  const count = await screen.findByTestId('all-count');
  expect(count.textContent).toBe('2');
});
