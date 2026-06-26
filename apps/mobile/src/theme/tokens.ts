import type { TextStyle } from 'react-native';

export type ColorTokens = {
  bg: string;
  surface: string;
  elevated: string;
  recessed: string;
  border: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  onAccent: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  success: string;
  warning: string;
  danger: string;
  shadow: string;
};

// Indigo "calm control surface" palette. Dark is luminance-layered (bg < recessed < surface <
// elevated); light leans on a soft shadow. WCAG AA: never pure white-on-black, never state-by-color.
export const darkColors: ColorTokens = {
  bg: '#0B0C0F',
  surface: '#16181D',
  elevated: '#1F2228',
  recessed: '#0E1014',
  border: '#2A2E37',
  accent: '#818CF8',
  accentPressed: '#6366F1',
  accentSoft: 'rgba(129,140,248,0.16)',
  onAccent: '#0B0C0F',
  textPrimary: '#E7E9EE',
  textSecondary: '#9AA0AD',
  textDisabled: '#5B616E',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  shadow: 'transparent',
};

export const lightColors: ColorTokens = {
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  recessed: '#ECEEF1',
  border: '#E3E5EA',
  accent: '#4F46E5',
  accentPressed: '#4338CA',
  accentSoft: 'rgba(79,70,229,0.12)',
  onAccent: '#FFFFFF',
  textPrimary: '#14161B',
  textSecondary: '#5B616E',
  textDisabled: '#A1A6B0',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  shadow: 'rgba(20,22,27,0.10)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 24, xxl: 30 } as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const motion = {
  fast: 120,
  base: 180,
  spring: { damping: 18, stiffness: 200, mass: 0.6 },
} as const;
