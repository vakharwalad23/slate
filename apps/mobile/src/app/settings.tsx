import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Surface, Text } from '@/components/ui';
import { radii, spacing, type ThemeMode, useTheme } from '@/theme';

const MODES: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left + spacing.lg,
          paddingRight: insets.right + spacing.lg,
        },
      ]}
    >
      <View style={styles.header}>
        <Text variant="title">Settings</Text>
        <Button title="Done" variant="ghost" onPress={() => router.back()} />
      </View>

      <Surface variant="surface" radius={radii.lg} style={styles.card}>
        <Text variant="heading">Appearance</Text>
        <Text variant="caption" tone="secondary">
          Theme
        </Text>
        <View style={styles.row}>
          {MODES.map((m) => (
            <Chip
              key={m.mode}
              label={m.label}
              selected={mode === m.mode}
              onPress={() => setMode(m.mode)}
            />
          ))}
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  card: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
