import { FlashList } from '@shopify/flash-list';
import type { AppInfo } from '@slate/protocol';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { IconView } from '@/components/IconView';
import { Text, TextField } from '@/components/ui';
import { useStore } from '@/stores/store';
import { spacing } from '@/theme';

export function AppPicker({ onSelect }: { onSelect: (app: AppInfo) => void }) {
  const { apps, appsState } = useStore(
    useShallow((s) => ({ apps: s.apps, appsState: s.appsState })),
  );
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return apps;
    return apps.filter(
      (app) => app.name.toLowerCase().includes(q) || app.bundleId.toLowerCase().includes(q),
    );
  }, [apps, query]);

  if (appsState === 'error') {
    return (
      <Text tone="secondary" style={styles.note}>
        This helper has no app list. Enter a bundle id manually below.
      </Text>
    );
  }
  if (appsState === 'loading') {
    return (
      <Text tone="secondary" style={styles.note}>
        Loading apps...
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search apps"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.bundleId}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onSelect(item)}>
            <IconView icon={{ kind: 'appIcon', bundleId: item.bundleId }} size={32} />
            <View style={styles.text}>
              <Text variant="body" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {item.bundleId}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  text: { flex: 1 },
  note: { padding: spacing.lg, textAlign: 'center' },
});
