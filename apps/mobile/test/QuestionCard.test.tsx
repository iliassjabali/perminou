// Perminou — Plan 4, Task 2: the audio-first question card, reveal-logic test.
//
// `react-native` core (Flow syntax, native-module requires) doesn't load under plain
// Vitest/esbuild — this project's `vitest.config.ts` aliases it to `react-native-web` (already an
// Expo dependency) so `View`/`Text`/`Pressable` render to real DOM nodes under jsdom, testable
// with `@testing-library/react`. `expo-image`/`expo-audio` are native modules with no such
// web-alias wired here, so they're mocked wholesale — this test exercises the reveal LOGIC
// (selection -> validate -> green/red -> `onAnswered`), not native media playback.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { playMock, pauseMock, seekToMock, useAudioPlayerMock } = vi.hoisted(() => ({
  playMock: vi.fn(),
  pauseMock: vi.fn(),
  seekToMock: vi.fn(),
  useAudioPlayerMock: vi.fn(),
}));

vi.mock('expo-audio', () => ({
  useAudioPlayer: useAudioPlayerMock,
}));

vi.mock('expo-image', () => ({
  Image: (props: { testID?: string }) => <div data-testid={props.testID ?? 'question-image'} />,
}));

import { QuestionCard } from '../src/features/deck/QuestionCard';
import type { DeckQuestion } from '../src/features/deck/use-deck';

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  useAudioPlayerMock.mockReturnValue({ play: playMock, pause: pauseMock, seekTo: seekToMock, playing: false });
});

function makeQuestion(overrides: Partial<DeckQuestion> = {}): DeckQuestion {
  return {
    id: '42',
    category: 'B',
    hasImage: false,
    hasAudio: true,
    answers: [
      { narsaId: 901, index: 0, correct: false },
      { narsaId: 902, index: 1, correct: true },
      { narsaId: 903, index: 2, correct: false },
      { narsaId: 904, index: 3, correct: true },
    ],
    ...overrides,
  };
}

describe('QuestionCard reveal logic', () => {
  it('auto-plays audio on mount', () => {
    render(<QuestionCard question={makeQuestion()} lang="fr" />);
    expect(playMock).toHaveBeenCalled();
  });

  it('disables Valider until at least one answer is selected', () => {
    render(<QuestionCard question={makeQuestion()} lang="fr" />);
    const validate = screen.getByTestId('validate-button');
    expect(validate.getAttribute('aria-disabled')).toBe('true');
  });

  it('selecting exactly the correct set reveals all-green and calls onAnswered(true)', () => {
    const onAnswered = vi.fn();
    render(<QuestionCard question={makeQuestion()} lang="fr" onAnswered={onAnswered} />);

    fireEvent.click(screen.getByTestId('answer-1-idle'));
    fireEvent.click(screen.getByTestId('answer-3-idle'));
    fireEvent.click(screen.getByTestId('validate-button'));

    expect(screen.getByTestId('answer-1-correct')).toBeTruthy();
    expect(screen.getByTestId('answer-3-correct')).toBeTruthy();
    expect(screen.getByTestId('answer-0-idle')).toBeTruthy();
    expect(screen.getByTestId('answer-2-idle')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledTimes(1);
    expect(onAnswered).toHaveBeenCalledWith(true);
  });

  it('selecting a wrong answer marks it red, corrects stay green, and onAnswered(false)', () => {
    const onAnswered = vi.fn();
    render(<QuestionCard question={makeQuestion()} lang="fr" onAnswered={onAnswered} />);

    fireEvent.click(screen.getByTestId('answer-0-idle')); // wrong
    fireEvent.click(screen.getByTestId('answer-1-idle')); // correct
    fireEvent.click(screen.getByTestId('validate-button'));

    expect(screen.getByTestId('answer-0-wrong')).toBeTruthy();
    expect(screen.getByTestId('answer-1-correct')).toBeTruthy();
    // index 3 is correct but was never selected — still surfaced as correct on reveal.
    expect(screen.getByTestId('answer-3-correct')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledTimes(1);
    expect(onAnswered).toHaveBeenCalledWith(false);
  });

  it('locks chips after reveal — further taps do not change the outcome or refire onAnswered', () => {
    const onAnswered = vi.fn();
    render(<QuestionCard question={makeQuestion()} lang="fr" onAnswered={onAnswered} />);

    fireEvent.click(screen.getByTestId('answer-1-idle'));
    fireEvent.click(screen.getByTestId('answer-3-idle'));
    fireEvent.click(screen.getByTestId('validate-button'));
    expect(onAnswered).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('answer-0-idle'));
    expect(screen.getByTestId('answer-1-correct')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledTimes(1);
  });

  it('renders the image when hasImage is true', () => {
    render(<QuestionCard question={makeQuestion({ hasImage: true })} lang="fr" />);
    expect(screen.getByTestId('question-image')).toBeTruthy();
  });

  it('does not render the image when hasImage is false', () => {
    render(<QuestionCard question={makeQuestion({ hasImage: false })} lang="fr" />);
    expect(screen.queryByTestId('question-image')).toBeNull();
  });
});
