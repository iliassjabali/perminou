// Minimal hand-rolled numbered-checkbox row, styled with NativeWind classes.
//
// This is intentionally NOT a React Native Reusables (RNR) component — RNR
// (copy-paste shadcn-for-RN) is scoped to the real mobile app (Plan 4 / ADR
// 0004). This prototype sticks to plain Pressable/View/Text.
import { Pressable, Text, View } from 'react-native';

export type AnswerOptionState = 'idle' | 'correct' | 'wrong';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AnswerOption({
  label,
  checked,
  state,
  onPress,
}: {
  label: string;
  checked: boolean;
  state: AnswerOptionState;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cx(
        'flex-row items-center rounded-2xl border p-4 mb-3 active:opacity-80',
        state === 'idle' && 'border-gray-200 bg-gray-50',
        state === 'correct' && 'border-green-500 bg-green-50',
        state === 'wrong' && 'border-red-500 bg-red-50',
      )}
    >
      <View
        className={cx(
          'w-7 h-7 rounded-md border items-center justify-center mr-3',
          checked ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400',
        )}
      >
        <Text className={checked ? 'text-white font-bold' : 'text-transparent'}>✓</Text>
      </View>
      <Text className="text-base text-gray-900">{label}</Text>
    </Pressable>
  );
}
