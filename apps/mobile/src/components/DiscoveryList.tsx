import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/stores/store';

export function DiscoveryList({ onSelect }: { onSelect: (host: string, port: number) => void }) {
  const { found, discoveryGate, scanning } = useStore(
    useShallow((s) => ({ found: s.found, discoveryGate: s.discoveryGate, scanning: s.scanning })),
  );

  if (discoveryGate === 'disabled') {
    return (
      <Text style={styles.note}>
        Auto-discovery unavailable on this device; enter the host manually.
      </Text>
    );
  }
  if (found.length === 0) {
    return <Text style={styles.note}>{scanning ? 'Searching...' : ''}</Text>;
  }
  return (
    <View style={styles.list}>
      {found.map((helper) => (
        <Pressable
          key={`${helper.host}:${helper.port}`}
          style={styles.row}
          onPress={() => onSelect(helper.host, helper.port)}
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
