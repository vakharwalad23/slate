import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { Button, Chip, Icon, PressableScale, Text, TextField } from '@/components/ui';
import { useStore } from '@/stores/store';
import { radii, spacing, useTheme } from '@/theme';

// ponytail: portrait only; landscape shows deck name + page position in the dock rail instead.
export function DeckNavBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    decks,
    currentDeckId,
    currentPageId,
    setCurrentDeck,
    setCurrentPage,
    addDeck,
    renameDeck,
    deleteDeck,
    addPage,
    deletePage,
  } = useStore(
    useShallow((s) => ({
      decks: s.decks,
      currentDeckId: s.currentDeckId,
      currentPageId: s.currentPageId,
      setCurrentDeck: s.setCurrentDeck,
      setCurrentPage: s.setCurrentPage,
      addDeck: s.addDeck,
      renameDeck: s.renameDeck,
      deleteDeck: s.deleteDeck,
      addPage: s.addPage,
      deletePage: s.deletePage,
    })),
  );

  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const deck = decks.find((d) => d.id === currentDeckId) ?? decks[0];
  if (deck === undefined) return null;

  const openRename = (id: string, name: string) => setEditing({ id, name });
  const onAddDeck = () => {
    addDeck();
    const created = useStore.getState().currentDeckId;
    const name = useStore.getState().decks.find((d) => d.id === created)?.name ?? '';
    if (created !== null) openRename(created, name);
  };
  const confirmDeletePage = (pageId: string) => {
    if (deck.pages.length <= 1) return;
    Alert.alert('Delete this page?', 'Its buttons will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePage(pageId) },
    ]);
  };

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
            onLongPress={() => openRename(d.id, d.name)}
          />
        ))}
        <PressableScale
          onPress={onAddDeck}
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
            onLongPress={() => confirmDeletePage(p.id)}
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

      <Modal
        visible={editing !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setEditing(null)}
      >
        <View style={styles.backdrop}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.bg,
                borderColor: colors.border,
                marginBottom: insets.bottom,
              },
            ]}
          >
            <Text variant="heading">Rename deck</Text>
            <TextField
              value={editing?.name ?? ''}
              onChangeText={(name) => setEditing((e) => (e === null ? e : { ...e, name }))}
              placeholder="Deck name"
              autoFocus
            />
            <View style={styles.sheetActions}>
              {decks.length > 1 ? (
                <Button
                  title="Delete"
                  variant="danger"
                  onPress={() => {
                    const target = editing;
                    if (target === null) return;
                    Alert.alert('Delete this deck?', 'All its pages and buttons are removed.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          deleteDeck(target.id);
                          setEditing(null);
                        },
                      },
                    ]);
                  }}
                />
              ) : null}
              <View style={styles.sheetRight}>
                <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
                <Button
                  title="Save"
                  onPress={() => {
                    if (editing !== null && editing.name.trim() !== '')
                      renameDeck(editing.id, editing.name.trim());
                    setEditing(null);
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  sheet: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetRight: { flexDirection: 'row', gap: spacing.sm, marginLeft: 'auto' },
});
