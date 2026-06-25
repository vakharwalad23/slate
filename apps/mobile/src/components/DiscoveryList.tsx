import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/stores/store';

export function DiscoveryList({
  onSelect,
}: {
  onSelect: (host: string, port: number, name: string) => void;
}) {
  const { found, scanning } = useStore(
    useShallow((s) => ({ found: s.found, scanning: s.scanning })),
  );

  if (found.length === 0) {
    return (
      <Text style={styles.note}>
        {scanning ? 'Scanning your Wi-Fi for the Mac...' : 'No helper found. Enter the host below.'}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {found.map((helper) => (
        <Pressable
          key={`${helper.host}:${helper.port}`}
          style={styles.row}
          onPress={() => onSelect(helper.host, helper.port, helper.name)}
        >
          <Text style={styles.name}>{helper.name}</Text>
          <Text style={styles.addr}>
            {helper.host}:{helper.port}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  row: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  name: { fontSize: 16 },
  addr: { fontSize: 12, opacity: 0.5 },
  note: { fontSize: 13, opacity: 0.5, textAlign: 'center' },
});
