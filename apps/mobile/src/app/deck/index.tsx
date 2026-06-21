import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { AddCell, DeckButtonCell } from '@/components/DeckButtonCell';
import { useStore } from '@/stores/store';

export default function DeckScreen() {
  const { decks, currentDeckId, currentPageId, helperName, requestApps, sendCommand, disconnect } =
    useStore(
      useShallow((s) => ({
        decks: s.decks,
        currentDeckId: s.currentDeckId,
        currentPageId: s.currentPageId,
        helperName: s.helper?.name ?? 'helper',
        requestApps: s.requestApps,
        sendCommand: s.sendCommand,
        disconnect: s.disconnect,
      })),
    );

  // Populate app list (and thus icon versions) once paired so grid icons resolve.
  useEffect(() => {
    requestApps();
  }, [requestApps]);

  const deck = decks.find((d) => d.id === currentDeckId) ?? decks[0];
  const page = deck?.pages.find((p) => p.id === currentPageId) ?? deck?.pages[0];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: helperName,
          headerRight: () => <Button title="Disconnect" onPress={disconnect} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.grid}>
        {page?.buttons.map((button) => (
          <DeckButtonCell
            key={button.id}
            button={button}
            onPress={() => sendCommand(button.action)}
            onLongPress={() => router.push(`/deck/button/${button.id}`)}
          />
        ))}
        {page ? <AddCell onPress={() => router.push('/deck/button/new')} /> : null}
      </ScrollView>
      {page === undefined ? <Text style={styles.empty}>No page</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16, justifyContent: 'center' },
  empty: { textAlign: 'center', opacity: 0.5, marginTop: 40 },
});
