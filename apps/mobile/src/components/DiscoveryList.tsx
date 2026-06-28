import { StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { PressableScale, Surface, Text } from '@/components/ui';
import { useStore } from '@/stores/store';
import { radii, spacing } from '@/theme';

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
      <Text variant="caption" tone="secondary" style={styles.note}>
        {scanning
          ? 'Scanning your Wi-Fi for the Mac...'
          : 'No Mac found. Check the helper is running and you are on the same Wi-Fi, or enter the host below.'}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {found.map((helper) => (
        <PressableScale
          key={`${helper.host}:${helper.port}`}
          onPress={() => onSelect(helper.host, helper.port, helper.name)}
        >
          <Surface variant="elevated" radius={radii.lg} style={styles.row}>
            <Text variant="body">{helper.name}</Text>
            <Text variant="caption" tone="secondary">
              {helper.host}:{helper.port}
            </Text>
          </Surface>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { padding: spacing.md, gap: spacing.xs },
  note: { textAlign: 'center' },
});
