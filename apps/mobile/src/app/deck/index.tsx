import type { Command } from '@slate/protocol';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { GestureType } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { AddCell, DeckButtonCell, type SwipeHandlers } from '@/components/DeckButtonCell';
import { DeckGestures } from '@/components/DeckGestures';
import { DeckNavBar } from '@/components/DeckNavBar';
import { SortableGrid } from '@/components/SortableGrid';
import { Button, connState, Icon, PressableScale, StatusPill, Text } from '@/components/ui';
import type { DeckButton } from '@/schemas';
import { useStore } from '@/stores/store';
import { radii, spacing, useTheme } from '@/theme';

const MAX_GRID = 640;

function swipeHandlersFor(
  gestures: DeckButton['gestures'],
  send: (command: Command) => void,
): SwipeHandlers | undefined {
  if (gestures === undefined) return undefined;
  const handlers: SwipeHandlers = {};
  const { swipeUp, swipeDown, swipeLeft, swipeRight } = gestures;
  if (swipeUp) handlers.up = () => send(swipeUp);
  if (swipeDown) handlers.down = () => send(swipeDown);
  if (swipeLeft) handlers.left = () => send(swipeLeft);
  if (swipeRight) handlers.right = () => send(swipeRight);
  return Object.keys(handlers).length > 0 ? handlers : undefined;
}

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

  const {
    decks,
    currentDeckId,
    currentPageId,
    helperName,
    status,
    requestApps,
    sendCommand,
    reorderButton,
    setCurrentDeck,
    setCurrentPage,
  } = useStore(
    useShallow((s) => ({
      decks: s.decks,
      currentDeckId: s.currentDeckId,
      currentPageId: s.currentPageId,
      helperName: s.helper?.name ?? 'helper',
      status: s.status,
      requestApps: s.requestApps,
      sendCommand: s.sendCommand,
      reorderButton: s.reorderButton,
      setCurrentDeck: s.setCurrentDeck,
      setCurrentPage: s.setCurrentPage,
    })),
  );
  const disconnect = useStore((s) => s.disconnect);
  const [editing, setEditing] = useState(false);
  const pageNavRef = useRef<GestureType | undefined>(undefined);

  // Populate app list (and thus icon versions) once paired so grid icons resolve.
  useEffect(() => {
    requestApps();
  }, [requestApps]);

  const deck = decks.find((d) => d.id === currentDeckId) ?? decks[0];
  const page = deck?.pages.find((p) => p.id === currentPageId) ?? deck?.pages[0];
  const { state, label } = connState(status);

  const hasButtons = page !== undefined && page.buttons.length > 0;
  useEffect(() => {
    if (!hasButtons) setEditing(false);
  }, [hasButtons]);

  const pageIndex = deck && page ? deck.pages.findIndex((p) => p.id === page.id) : -1;
  const deckIndex = deck ? decks.findIndex((d) => d.id === deck.id) : -1;
  const step = (
    list: { id: string }[],
    index: number,
    dir: 1 | -1,
    apply: (id: string) => void,
  ) => {
    const next = list[index + dir];
    if (next !== undefined) apply(next.id);
  };
  const onPage = (dir: 1 | -1) => {
    if (deck) step(deck.pages, pageIndex, dir, setCurrentPage);
  };
  const onDeck = (dir: 1 | -1) => step(decks, deckIndex, dir, setCurrentDeck);

  const cols = landscape ? 6 : 4;
  const rail = landscape ? 84 : 0;
  const gridWidth = Math.min(
    (landscape ? width - rail : width) - insets.left - insets.right - spacing.lg * 2,
    MAX_GRID,
  );
  const tile = Math.floor((gridWidth - (cols - 1) * spacing.md) / cols);

  const controls = (
    <>
      {hasButtons ? (
        <PressableScale onPress={() => setEditing((e) => !e)} haptics={false}>
          <Icon
            name={editing ? 'check' : 'pencil'}
            size={22}
            color={editing ? colors.accent : colors.textSecondary}
          />
        </PressableScale>
      ) : null}
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
          {deck ? (
            <Text variant="caption" tone="secondary" numberOfLines={2} style={styles.railText}>
              {deck.name}
            </Text>
          ) : null}
          {deck && deck.pages.length > 0 ? (
            <Text variant="caption" tone="secondary" style={styles.railText}>
              {pageIndex + 1}/{deck.pages.length}
            </Text>
          ) : null}
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
        <DeckGestures enabled={!editing} onPage={onPage} onDeck={onDeck} navRef={pageNavRef}>
          <ScrollView contentContainerStyle={styles.gridScroll}>
            {editing && page !== undefined && page.buttons.length > 0 ? (
              <SortableGrid
                buttons={page.buttons}
                cols={cols}
                size={tile}
                gap={spacing.md}
                onReorder={(from, to) => reorderButton(page.id, from, to)}
                onEdit={(id) => router.push(`/deck/button/${id}`)}
              />
            ) : (
              <View style={[styles.grid, { width: gridWidth }]}>
                {page?.buttons.map((button) => {
                  // View-mode long-press fires the mapped command; editing moved to the pencil toggle.
                  const longPress = button.gestures?.longPress;
                  const doubleTap = button.gestures?.doubleTap;
                  return (
                    <DeckButtonCell
                      key={button.id}
                      button={button}
                      size={tile}
                      onPress={() => sendCommand(button.action)}
                      onLongPress={longPress ? () => sendCommand(longPress) : undefined}
                      onDoubleTap={doubleTap ? () => sendCommand(doubleTap) : undefined}
                      onSwipe={swipeHandlersFor(button.gestures, sendCommand)}
                      navRef={pageNavRef}
                    />
                  );
                })}
                {page ? (
                  <AddCell size={tile} onPress={() => router.push('/deck/button/new')} />
                ) : null}
              </View>
            )}
            {page !== undefined && page.buttons.length === 0 ? (
              <Text tone="secondary" style={styles.empty}>
                No buttons yet - tap + to add
              </Text>
            ) : null}
            {page === undefined ? (
              <Text tone="secondary" style={styles.empty}>
                No page
              </Text>
            ) : null}
          </ScrollView>
        </DeckGestures>
      </View>

      {landscape ? null : <DeckNavBar />}
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
  railText: { textAlign: 'center' },
  dot: { width: 10, height: 10, borderRadius: radii.pill },
  gridArea: { flex: 1 },
  gridScroll: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'flex-start' },
  empty: { textAlign: 'center', marginTop: spacing.xl },
});
