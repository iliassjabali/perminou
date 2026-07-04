// Perminou — Plan 4, Task 2: the audio-first question card.
//
// Every question's audio track reads out the question and its numbered options — answers carry
// no text of their own (`{narsaId, index, correct}`), so each chip is labeled only by its 1-based
// position. Audio auto-plays on mount (and again whenever the question/lang changes, e.g. the
// deck advances) via `expo-audio`'s `useAudioPlayer`; a big replay button re-triggers it. Tapping
// answers is a local multi-select; "Valider" reveals green (correct) / red (selected-but-wrong)
// using `AnswerOption`'s existing states, locks further taps, and reports whether the pick was
// exactly the correct set via `onAnswered`.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAudioPlayer } from 'expo-audio';
import { QuestionId } from '@perminou/domain';

import { AnswerOption, type AnswerOptionState } from '../../components/AnswerOption';
import { absoluteMediaUrl, type Lang } from '../../lib/media';
import type { DeckQuestion } from './use-deck';

export interface QuestionCardProps {
  readonly question: DeckQuestion;
  readonly lang: Lang;
  readonly onAnswered?: (correct: boolean) => void;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function QuestionCard({ question, lang, onAnswered }: QuestionCardProps) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [revealed, setRevealed] = useState(false);

  // A new question card (deck advanced, or the lang toggled) starts fresh: no selection, no
  // reveal.
  useEffect(() => {
    setSelected(new Set());
    setRevealed(false);
  }, [question.id, lang]);

  // Wire questions carry a plain `string` id (`DeckQuestion.id`); `mediaUrl` wants the branded
  // `QuestionId` domain type. `.make` is the schema's unsafe (non-validating) constructor — the id
  // already round-tripped through the RPC layer, so re-validating it here would be redundant.
  const id = QuestionId.make(question.id);
  const soundUrl = absoluteMediaUrl('sound', lang, id);
  const player = useAudioPlayer(soundUrl);

  // Every question has audio (100% coverage) — auto-play on mount, and again whenever the source
  // changes (question/lang), since `useAudioPlayer` only reloads its source on re-render, not
  // playback.
  useEffect(() => {
    player.play();
  }, [player, soundUrl]);

  const answers = useMemo(() => [...question.answers].sort((a, b) => a.index - b.index), [question.answers]);

  const toggle = (index: number) => {
    if (revealed) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const stateFor = (index: number, correct: boolean): AnswerOptionState => {
    if (!revealed) return 'idle';
    if (correct) return 'correct';
    if (selected.has(index)) return 'wrong';
    return 'idle';
  };

  const canValidate = selected.size > 0 && !revealed;

  const handleValidate = () => {
    if (!canValidate) return;
    const allCorrectSelected = answers.every((a) => !a.correct || selected.has(a.index));
    const noWrongSelected = answers.every((a) => !selected.has(a.index) || a.correct);
    setRevealed(true);
    onAnswered?.(allCorrectSelected && noWrongSelected);
  };

  const replay = () => {
    player.seekTo(0);
    player.play();
  };

  return (
    <View testID="question-card" className="flex-1 rounded-3xl bg-white p-4">
      {question.hasImage && (
        <Image
          testID="question-image"
          source={{ uri: absoluteMediaUrl('image', lang, id) }}
          contentFit="cover"
          className="mb-4 h-48 w-full rounded-2xl"
        />
      )}

      <Pressable
        testID="replay-button"
        onPress={replay}
        className="mb-4 flex-row items-center justify-center rounded-full bg-blue-600 p-5 active:opacity-80"
      >
        <Text className="text-lg font-bold text-white">{'▶'} Réécouter</Text>
      </Pressable>

      <View testID="answers">
        {answers.map((answer) => (
          <AnswerOption
            key={answer.narsaId}
            testID={`answer-${answer.index}`}
            label={`Réponse ${answer.index + 1}`}
            checked={selected.has(answer.index)}
            state={stateFor(answer.index, answer.correct)}
            onPress={() => toggle(answer.index)}
          />
        ))}
      </View>

      <Pressable
        testID="validate-button"
        disabled={!canValidate}
        onPress={handleValidate}
        className={cx(
          'mt-2 items-center justify-center rounded-2xl p-4',
          canValidate ? 'bg-green-600 active:opacity-80' : 'bg-gray-300',
        )}
      >
        <Text className="text-base font-bold text-white">Valider</Text>
      </Pressable>
    </View>
  );
}
