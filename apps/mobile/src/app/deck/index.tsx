import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { AddCell, DeckButtonCell } from '@/components/DeckButtonCell';
import { Button, connState, Icon, PressableScale, StatusPill, Text } from '@/components/ui';
import { useStore } from '@/stores/store';
import { radii, spacing, useTheme } from '@/theme';

const MAX_GRID = 640;

// Isolated so a command result re-renders only this, never the grid.
function AckHaptics() {
  const lastResult = useStore((s) => s.lastResult);
  useEffect(() => {
    if (lastResult === null) return;
    void Haptics.notificationAsync(
      lastResult.ok
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
  }, [lastResult]);
  return null;
}

export default function DeckScreen() {
  useKeepAwake();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = width > height;

  const { decks, currentDeckId, currentPageId, helperName, status, requestApps, sendCommand } =
    useStore(
      useShallow((s) => ({
        decks: s.decks,
        currentDeckId: s.currentDeckId,
        currentPageId: s.currentPageId,
        helperName: s.helper?.name ?? 'helper',
        status: s.status,
        requestApps: s.requestApps,
        sendCommand: s.sendCommand,
      })),
    );
  const disconnect = useStore((s) => s.disconnect);

  // Populate app list (and thus icon versions) once paired so grid icons resolve.
  useEffect(() => {
    requestApps();
  }, [requestApps]);

  const deck = decks.find((d) => d.id === currentDeckId) ?? decks[0];
  const page = deck?.pages.find((p) => p.id === currentPageId) ?? deck?.pages[0];
  const { state, label } = connState(status);

  const cols = landscape ? 6 : 4;
  const rail = landscape ? 84 : 0;
  const gridWidth = Math.min(
    (landscape ? width - rail : width) - insets.left - insets.right - spacing.lg * 2,
    MAX_GRID,
  );
  const tile = Math.floor((gridWidth - (cols - 1) * spacing.md) / cols);

  const controls = (
    <>
      <PressableScale onPress={() => router.push('/settings')} haptics={false}>
        <Icon name="cog" size={24} color={colors.textSecondary} />
      </PressableScale>
      <Button title="Disconnect" variant="ghost" onPress={disconnect} />
    </>
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          flexDirection: landscape ? 'row' : 'column',
        },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AckHaptics />

      {landscape ? (
        <View style={[styles.rail, { width: rail, borderColor: colors.border }]}>
          <View style={[styles.dot, { backgroundColor: dotColor(state, colors) }]} />
          <View style={styles.railSpacer} />
          {controls}
        </View>
      ) : (
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Text variant="heading" numberOfLines={1}>
              {helperName}
            </Text>
            <StatusPill state={state} label={label} />
          </View>
          <View style={styles.topBarRight}>{controls}</View>
        </View>
      )}

      <View style={styles.gridArea}>
        <ScrollView contentContainerStyle={styles.gridScroll}>
          <View style={[styles.grid, { width: gridWidth }]}>
            {page?.buttons.map((button) => (
              <DeckButtonCell
                key={button.id}
                button={button}
                size={tile}
                onPress={() => sendCommand(button.action)}
                onLongPress={() => router.push(`/deck/button/${button.id}`)}
              />
            ))}
            {page ? <AddCell size={tile} onPress={() => router.push('/deck/button/new')} /> : null}
          </View>
          {page === undefined ? (
            <Text tone="secondary" style={styles.empty}>
              No page
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function dotColor(
  state: ReturnType<typeof connState>['state'],
  colors: ReturnType<typeof useTheme>['colors'],
) {
  if (state === 'connected') return colors.success;
  if (state === 'reconnecting') return colors.warning;
  return colors.textDisabled;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  topBarLeft: { flex: 1, gap: spacing.xs },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rail: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.lg,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  railSpacer: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: radii.pill },
  gridArea: { flex: 1 },
  gridScroll: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'flex-start' },
  empty: { textAlign: 'center', marginTop: spacing.xl },
});
