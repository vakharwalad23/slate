import { Image } from 'expo-image';
import { StyleSheet, Text } from 'react-native';
import { useAppIcon } from '@/hooks/useAppIcon';
import type { IconRef } from '@/schemas';

function AppIcon({ bundleId, size }: { bundleId: string; size: number }) {
  const uri = useAppIcon(bundleId);
  if (uri === null) return <Text style={{ fontSize: size * 0.5 }}>{'...'}</Text>;
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size * 0.18 }}
      contentFit="contain"
      cachePolicy="memory"
      allowDownscaling
    />
  );
}

export function IconView({ icon, size }: { icon: IconRef; size: number }) {
  switch (icon.kind) {
    case 'appIcon':
      return <AppIcon bundleId={icon.bundleId} size={size} />;
    case 'emoji':
      return <Text style={[styles.glyph, { fontSize: size * 0.6 }]}>{icon.value}</Text>;
    case 'glyph':
      return <Text style={[styles.glyph, { fontSize: size * 0.4 }]}>{icon.name}</Text>;
  }
}

const styles = StyleSheet.create({
  glyph: { textAlign: 'center' },
});
