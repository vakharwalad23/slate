import { ScrollView, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { Chip, Icon, PressableScale } from '@/components/ui';
import { useStore } from '@/stores/store';
import { radii, spacing, useTheme } from '@/theme';

// ponytail: portrait only; the landscape dock rail stays single-deck. Add landscape nav when asked.
export function DeckNavBar() {
  const { colors } = useTheme();
  const { decks, currentDeckId, currentPageId, setCurrentDeck, setCurrentPage, addDeck, addPage } =
    useStore(
      useShallow((s) => ({
        decks: s.decks,
        currentDeckId: s.currentDeckId,
        currentPageId: s.currentPageId,
        setCurrentDeck: s.setCurrentDeck,
        setCurrentPage: s.setCurrentPage,
        addDeck: s.addDeck,
        addPage: s.addPage,
      })),
    );

  const deck = decks.find((d) => d.id === currentDeckId) ?? decks[0];
  if (deck === undefined) return null;

  return (
    <View style={[styles.bar, { borderColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.decks}
      >
        {decks.map((d) => (
          <Chip
            key={d.id}
            label={d.name}
            selected={d.id === deck.id}
            onPress={() => setCurrentDeck(d.id)}
          />
        ))}
        <PressableScale
          onPress={addDeck}
          haptics={false}
          style={[styles.add, { borderColor: colors.border }]}
        >
          <Icon name="plus" size={18} color={colors.textSecondary} />
        </PressableScale>
      </ScrollView>

      <View style={styles.pages}>
        {deck.pages.map((p) => (
          <PressableScale
            key={p.id}
            onPress={() => setCurrentPage(p.id)}
            haptics={false}
            style={styles.dotHit}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: p.id === currentPageId ? colors.accent : colors.textDisabled },
              ]}
            />
          </PressableScale>
        ))}
        <PressableScale onPress={() => addPage(deck.id)} haptics={false} style={styles.dotHit}>
          <Icon name="plus" size={16} color={colors.textSecondary} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  decks: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center' },
  add: {
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pages: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  dotHit: { padding: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
});
