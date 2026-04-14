export const Colors = {
  // Primary palette — vibrant violet
  primary: '#7C5CFC',
  primaryLight: '#9B82FF',
  primaryDark: '#5A3FD6',

  // Secondary accent — teal
  secondary: '#2DD4BF',
  secondaryLight: '#5EEAD4',
  secondaryDark: '#14B8A6',

  // Status colors
  success: '#34D399',
  successDark: '#10B981',
  danger: '#F87171',
  dangerDark: '#EF4444',
  warning: '#FBBF24',
  warningDark: '#F59E0B',
  info: '#60A5FA',

  // Background & Surface — deeper, richer darks
  background: '#0C0F1A',
  backgroundLight: '#111528',
  surface: '#181D30',
  surfaceLight: '#222840',
  surfaceHighlight: '#2A3150',

  // Glass effect
  glass: 'rgba(255, 255, 255, 0.04)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassLight: 'rgba(255, 255, 255, 0.06)',

  // Text — improved contrast
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textDark: '#0C0F1A',

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(255, 255, 255, 0.12)',

  // Gradient arrays
  gradientPrimary: ['#7C5CFC', '#2DD4BF'],
  gradientSuccess: ['#34D399', '#10B981'],
  gradientDanger: ['#F87171', '#EF4444'],
  gradientDark: ['#0C0F1A', '#181D30'],
  gradientCard: ['#181D30', '#222840'],

  // New accent colors for cards
  amber: '#F59E0B',
  rose: '#FB7185',
  sky: '#38BDF8',
  emerald: '#34D399',
  violet: '#8B5CF6',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
};

export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 32,
  hero: 40,
};

export const BorderRadius = {
  sm: 8,
  base: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 50,
  full: 999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
};
