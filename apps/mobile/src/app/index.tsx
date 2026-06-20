import { PROTOCOL_VERSION } from '@slate/protocol';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>slate</Text>
      <Text style={styles.subtitle}>protocol v{PROTOCOL_VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '600' },
  subtitle: { fontSize: 14, marginTop: 4, opacity: 0.6 },
});
