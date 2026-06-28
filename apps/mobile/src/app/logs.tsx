import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { Button, Surface, Text } from '@/components/ui';
import { useStore } from '@/stores/store';
import { spacing, useTheme } from '@/theme';

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString();
}

export default function LogsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { logs, clearLogs } = useStore(
    useShallow((s) => ({ logs: s.logs, clearLogs: s.clearLogs })),
  );
  const newestFirst = [...logs].reverse();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left + spacing.lg,
          paddingRight: insets.right + spacing.lg,
        },
      ]}
    >
      <View style={styles.header}>
        <Text variant="title">Logs</Text>
        <View style={styles.actions}>
          <Button title="Clear" variant="danger" onPress={clearLogs} disabled={logs.length === 0} />
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>

      {newestFirst.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text tone="secondary">Errors and warnings will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={newestFirst}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const levelColor = item.level === 'error' ? colors.danger : colors.warning;
            return (
              <Surface
                variant="recessed"
                style={[styles.row, { borderLeftWidth: 3, borderLeftColor: levelColor }]}
              >
                <Text variant="body" selectable>
                  {item.message}
                </Text>
                <Text variant="caption" tone="secondary">
                  {formatTime(item.at)}
                </Text>
              </Surface>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.sm },
  row: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.xs },
});
