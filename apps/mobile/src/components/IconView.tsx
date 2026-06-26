import { Image } from 'expo-image';
import { StyleSheet, Text } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useAppIcon } from '@/hooks/useAppIcon';
import type { IconRef } from '@/schemas';
import { useTheme } from '@/theme';

function AppIcon({ bundleId, size }: { bundleId: string; size: number }) {
  const { colors } = useTheme();
  const uri = useAppIcon(bundleId);
  if (uri === null)
    return <Text style={{ fontSize: size * 0.5, color: colors.textSecondary }}>{'...'}</Text>;
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size * 0.18 }}
      contentFit="contain"
      cachePolicy="memory"
      recyclingKey={bundleId}
      allowDownscaling
    />
  );
}

export function IconView({ icon, size }: { icon: IconRef; size: number }) {
  const { colors } = useTheme();
  switch (icon.kind) {
    case 'appIcon':
      return <AppIcon bundleId={icon.bundleId} size={size} />;
    case 'emoji':
      return <Text style={[styles.glyph, { fontSize: size * 0.6 }]}>{icon.value}</Text>;
    case 'symbol':
      return <Icon name={icon.name} size={size} color={colors.textPrimary} />;
    case 'glyph':
      return (
        <Text style={[styles.glyph, { fontSize: size * 0.4, color: colors.textSecondary }]}>
          {icon.name}
        </Text>
      );
  }
}

const styles = StyleSheet.create({
  glyph: { textAlign: 'center' },
});
