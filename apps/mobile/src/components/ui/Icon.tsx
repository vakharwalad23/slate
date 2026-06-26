import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTheme } from '@/theme';

type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Curated glyph set offered in the button-icon picker. Typed as MCIName[] so a typo fails the build.
export const ICON_CHOICES = [
  'rocket-launch',
  'play',
  'pause',
  'stop',
  'skip-next',
  'skip-previous',
  'volume-high',
  'volume-off',
  'microphone',
  'microphone-off',
  'video',
  'camera',
  'monitor',
  'desktop-classic',
  'laptop',
  'keyboard',
  'folder',
  'file',
  'magnify',
  'cog',
  'power',
  'restart',
  'lock',
  'lock-open',
  'wifi',
  'bluetooth',
  'bell',
  'bell-off',
  'email',
  'message',
  'phone',
  'calendar',
  'clock',
  'home',
  'star',
  'heart',
  'bookmark',
  'download',
  'upload',
  'refresh',
  'trash-can',
  'pencil',
  'plus',
  'check',
  'close',
  'arrow-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
  'music',
  'headphones',
  'github',
  'slack',
  'console',
  'code-tags',
  'bug',
  'robot',
  'lightbulb',
  'palette',
  'brush',
  'image',
  'share',
  'link',
  'map-marker',
  'flag',
  'tag',
  'filter',
  'view-dashboard',
  'apps',
  'application',
] as const satisfies readonly MCIName[];

export function toIconName(name: string): MCIName {
  for (const choice of ICON_CHOICES) if (choice === name) return choice;
  return 'help-circle-outline';
}

export function Icon({ name, size = 24, color }: { name: string; size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <MaterialCommunityIcons
      name={toIconName(name)}
      size={size}
      color={color ?? colors.textPrimary}
    />
  );
}
