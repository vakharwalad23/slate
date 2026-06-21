import { router } from 'expo-router';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/stores/store';

export default function LogsScreen() {
  const { logs, clearLogs } = useStore(
    useShallow((s) => ({ logs: s.logs, clearLogs: s.clearLogs })),
  );
  const newestFirst = [...logs].reverse();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Logs</Text>
        <Button title="Clear" onPress={clearLogs} disabled={logs.length === 0} />
      </View>
      {newestFirst.length === 0 ? (
        <Text style={styles.empty}>No warnings or errors</Text>
      ) : (
        <FlatList
          data={newestFirst}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Text style={item.level === 'error' ? styles.err : styles.warn} selectable>
              {item.message}
            </Text>
          )}
        />
      )}
      <Button title="Back" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '600' },
  empty: { flex: 1, textAlign: 'center', marginTop: 40, opacity: 0.5 },
  warn: { color: '#b26a00', fontSize: 13, paddingVertical: 4 },
  err: { color: '#c62828', fontSize: 13, paddingVertical: 4 },
});
