import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { DeckButtonFace } from '@/components/DeckButtonCell';
import type { DeckButton } from '@/schemas';
import { motion } from '@/theme';

type Props = {
  buttons: DeckButton[];
  cols: number;
  size: number;
  gap: number;
  onReorder: (from: number, to: number) => void;
  onEdit: (buttonId: string) => void;
};

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function moveId(order: string[], id: string, to: number): string[] {
  'worklet';
  const from = order.indexOf(id);
  if (from < 0 || from === to) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function SortableGrid({ buttons, cols, size, gap, onReorder, onEdit }: Props) {
  const order = useSharedValue<string[]>(buttons.map((b) => b.id));
  // Resync ids on any structural change (add / delete / committed reorder); never fires mid-drag.
  useEffect(() => {
    order.value = buttons.map((b) => b.id);
  }, [buttons, order]);

  const span = size + gap;
  const rows = Math.max(1, Math.ceil(buttons.length / cols));
  const width = cols * size + (cols - 1) * gap;
  const height = rows * size + (rows - 1) * gap;

  return (
    <View style={{ width, height }}>
      {buttons.map((button, index) => (
        <SortableItem
          key={button.id}
          button={button}
          index={index}
          cols={cols}
          span={span}
          size={size}
          count={buttons.length}
          order={order}
          onReorder={onReorder}
          onEdit={onEdit}
        />
      ))}
    </View>
  );
}

type ItemProps = {
  button: DeckButton;
  index: number;
  cols: number;
  span: number;
  size: number;
  count: number;
  order: SharedValue<string[]>;
  onReorder: (from: number, to: number) => void;
  onEdit: (buttonId: string) => void;
};

function SortableItem({
  button,
  index,
  cols,
  span,
  size,
  count,
  order,
  onReorder,
  onEdit,
}: ItemProps) {
  const id = button.id;
  const tx = useSharedValue((index % cols) * span);
  const ty = useSharedValue(Math.floor(index / cols) * span);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startIndex = useSharedValue(index);
  const active = useSharedValue(false);

  // Follow this id's slot whenever the order shifts, unless this item is the one under the finger.
  useAnimatedReaction(
    () => order.value.indexOf(id),
    (idx) => {
      if (idx < 0 || active.value) return;
      tx.value = withSpring((idx % cols) * span, motion.spring);
      ty.value = withSpring(Math.floor(idx / cols) * span, motion.spring);
    },
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(160)
    .onStart(() => {
      active.value = true;
      startX.value = tx.value;
      startY.value = ty.value;
      startIndex.value = order.value.indexOf(id);
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
      const col = clamp(Math.round(tx.value / span), 0, cols - 1);
      const row = Math.max(0, Math.round(ty.value / span));
      const target = clamp(row * cols + col, 0, count - 1);
      if (target !== order.value.indexOf(id)) order.value = moveId(order.value, id, target);
    })
    .onEnd(() => {
      const idx = order.value.indexOf(id);
      tx.value = withSpring((idx % cols) * span, motion.spring);
      ty.value = withSpring(Math.floor(idx / cols) * span, motion.spring);
    })
    .onFinalize(() => {
      if (!active.value) return;
      active.value = false;
      const end = order.value.indexOf(id);
      if (end !== startIndex.value) runOnJS(onReorder)(startIndex.value, end);
    });

  // Quick tap (released before the 160ms drag arms) opens the editor; hold-and-drag still reorders.
  const tap = Gesture.Tap()
    .maxDuration(200)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) onEdit(id);
    });
  const gesture = Gesture.Exclusive(pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: withSpring(active.value ? 1.08 : 1, motion.spring) },
    ],
    zIndex: active.value ? 10 : 0,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.item, { width: size, height: size }, style]}>
        <DeckButtonFace button={button} size={size} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  item: { position: 'absolute', top: 0, left: 0 },
});
