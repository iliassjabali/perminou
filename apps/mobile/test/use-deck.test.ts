import { describe, expect, it, vi } from 'vitest';

// `@perminou/rpc-react` is mocked wholesale: `useDeck` only ever forwards to `api.exam.*`, so
// there's no real hook internals to exercise here (no useState/useEffect of its own) — this lets
// the test run as a plain function call under Node, no React render / jsdom needed.
const { getExamQuery, getAllQuestionsQuery } = vi.hoisted(() => ({
  getExamQuery: vi.fn(),
  getAllQuestionsQuery: vi.fn(),
}));

vi.mock('@perminou/rpc-react', () => ({
  api: {
    exam: {
      getExam: { useQuery: (...args: unknown[]) => getExamQuery(...args) },
      getAllQuestions: { useQuery: (...args: unknown[]) => getAllQuestionsQuery(...args) },
    },
  },
}));

import { toDeckState, useDeck, type DeckQuestion } from '../src/features/deck/use-deck';

const makeQuestion = (id: string, category = 'B'): DeckQuestion => ({
  id,
  category,
  hasImage: false,
  hasAudio: false,
  answers: [],
});

describe('toDeckState', () => {
  it('defaults questions to [] while loading (data undefined)', () => {
    expect(toDeckState({ data: undefined, isLoading: true, error: null })).toEqual({
      questions: [],
      isLoading: true,
      error: null,
    });
  });

  it('passes through data/isLoading/error unchanged once resolved', () => {
    const data = [makeQuestion('1')];
    expect(toDeckState({ data, isLoading: false, error: null })).toEqual({
      questions: data,
      isLoading: false,
      error: null,
    });
  });

  it('surfaces the error as-is', () => {
    const error = new Error('boom');
    expect(toDeckState({ data: undefined, isLoading: false, error })).toEqual({
      questions: [],
      isLoading: false,
      error,
    });
  });
});

describe('useDeck', () => {
  it('practice mode reads getAllQuestions (enabled) and disables getExam', () => {
    const questions = [makeQuestion('1'), makeQuestion('2')];
    getExamQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
    getAllQuestionsQuery.mockReturnValue({ data: questions, isLoading: false, error: null });

    const result = useDeck('practice');

    expect(result).toEqual({ questions, isLoading: false, error: null });
    expect(getAllQuestionsQuery).toHaveBeenCalledWith(undefined, { enabled: true });
    expect(getExamQuery).toHaveBeenCalledWith({ count: 40 }, { enabled: false });
  });

  it('exam mode reads getExam({count:40}) (enabled) and disables getAllQuestions', () => {
    const questions = [makeQuestion('9')];
    getExamQuery.mockReturnValue({ data: questions, isLoading: false, error: null });
    getAllQuestionsQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });

    const result = useDeck('exam');

    expect(result).toEqual({ questions, isLoading: false, error: null });
    expect(getExamQuery).toHaveBeenCalledWith({ count: 40 }, { enabled: true });
    expect(getAllQuestionsQuery).toHaveBeenCalledWith(undefined, { enabled: false });
  });

  it('reports isLoading/error from the active query only', () => {
    getExamQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    getAllQuestionsQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error('inactive') });

    expect(useDeck('exam')).toEqual({ questions: [], isLoading: true, error: null });
  });
});
