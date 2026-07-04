// Perminou — prototype quiz screen.
//
// This is a throwaway, static-data prototype meant to prove that a real
// NARSA question (image + audio + answers) can be rendered and interacted
// with on a phone via Expo Go. It is NOT the real mobile app: no rpc-react,
// no @effect/rpc, no persisted cache, no RNR — see apps/mobile/README.md and
// the `perminou-mobile-ui` skill for what the real Plan 4 app looks like.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { SAMPLES } from './samples';
import { AnswerOption, type AnswerOptionState } from './components/AnswerOption';

export function QuizScreen() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);

  const question = SAMPLES[index]!;

  // expo-audio: the player is created once per mount; when the sample
  // changes we swap the loaded source with `replace` (changing the `source`
  // argument on re-render does not reload the audio automatically).
  const player = useAudioPlayer(question.soundUrl ?? undefined);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setSelected([]);
    setRevealed(false);
    if (question.soundUrl) {
      player.replace(question.soundUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const toggleAnswer = (id: string) => {
    if (revealed) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const handleValidate = () => setRevealed(true);
  const handleNext = () => setIndex((i) => (i + 1) % SAMPLES.length);
  const handleTogglePlay = () => (status.playing ? player.pause() : player.play());

  const stateFor = (answerId: string): AnswerOptionState => {
    if (!revealed) return 'idle';
    if (question.correctAnswerIds.includes(answerId)) return 'correct';
    if (selected.includes(answerId)) return 'wrong';
    return 'idle';
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-4 pb-12">
      <Text className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Perminou — prototype
      </Text>
      <Text className="mb-4 text-lg font-bold text-gray-900">
        Question {question.id} — Category {question.category}
      </Text>

      {question.imageUrl ? (
        <Image
          source={question.imageUrl}
          contentFit="contain"
          style={{ width: '100%', height: 220, borderRadius: 12, backgroundColor: '#f3f4f6' }}
          className="mb-4"
        />
      ) : null}

      {question.soundUrl ? (
        <Pressable
          onPress={handleTogglePlay}
          className="mb-4 self-start rounded-full bg-gray-900 px-5 py-3 active:opacity-80"
        >
          <Text className="font-medium text-white">
            {status.playing ? '⏸  Pause audio' : '▶  Play audio'}
          </Text>
        </Pressable>
      ) : null}

      <View className="mb-6">
        {question.answers.map((answer) => (
          <AnswerOption
            key={answer.id}
            label={answer.label}
            checked={selected.includes(answer.id)}
            state={stateFor(answer.id)}
            onPress={() => toggleAnswer(answer.id)}
          />
        ))}
      </View>

      <View className="flex-row gap-3">
        <Pressable
          onPress={handleValidate}
          disabled={revealed || selected.length === 0}
          className={
            revealed || selected.length === 0
              ? 'flex-1 items-center rounded-2xl bg-gray-300 py-4'
              : 'flex-1 items-center rounded-2xl bg-blue-600 py-4 active:opacity-80'
          }
        >
          <Text className="text-base font-semibold text-white">Valider</Text>
        </Pressable>
        <Pressable
          onPress={handleNext}
          className="flex-1 items-center rounded-2xl bg-gray-800 py-4 active:opacity-80"
        >
          <Text className="text-base font-semibold text-white">Suivant</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
