import { Pressable, StyleSheet, Text } from 'react-native';
import { IconView } from '@/components/IconView';
import type { DeckButton } from '@/schemas';

const CELL = 88;

export function DeckButtonCell({
  button,
  onPress,
  onLongPress,
}: {
  button: DeckButton;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.cell, button.color ? { backgroundColor: button.color } : null]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <IconView icon={button.icon} size={44} />
      {button.label ? (
        <Text style={styles.label} numberOfLines={1}>
          {button.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function AddCell({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={[styles.cell, styles.add]} onPress={onPress}>
      <Text style={styles.plus}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 16,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
  },
  add: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  plus: { fontSize: 32, color: '#999' },
  label: { fontSize: 11, textAlign: 'center' },
});
