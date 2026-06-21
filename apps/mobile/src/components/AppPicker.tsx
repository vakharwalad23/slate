import { FlashList } from '@shopify/flash-list';
import type { AppInfo } from '@slate/protocol';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { IconView } from '@/components/IconView';
import { useStore } from '@/stores/store';

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
      <Text style={styles.note}>
        This helper has no app list. Enter a bundle id manually below.
      </Text>
    );
  }
  if (appsState === 'loading') {
    return <Text style={styles.note}>Loading apps...</Text>;
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
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
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.bundle} numberOfLines={1}>
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
  container: { flex: 1, gap: 8 },
  search: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  text: { flex: 1 },
  name: { fontSize: 16 },
  bundle: { fontSize: 12, opacity: 0.5 },
  note: { padding: 16, textAlign: 'center', opacity: 0.6 },
});
