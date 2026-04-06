export const Colors = {
  // Primary palette
  primary: '#6C63FF',
  primaryLight: '#8B83FF',
  primaryDark: '#4A42E0',
  
  // Secondary accent
  secondary: '#00D9FF',
  secondaryLight: '#33E3FF',
  secondaryDark: '#00B8D9',
  
  // Status colors
  success: '#00E676',
  successDark: '#00C853',
  danger: '#FF5252',
  dangerDark: '#D32F2F',
  warning: '#FFD600',
  warningDark: '#F9A825',
  info: '#448AFF',
  
  // Background & Surface
  background: '#0A0E21',
  backgroundLight: '#0F1428',
  surface: '#1A1F36',
  surfaceLight: '#242942',
  surfaceHighlight: '#2D3352',
  
  // Glass effect
  glass: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassLight: 'rgba(255, 255, 255, 0.08)',
  
  // Text
  text: '#FFFFFF',
  textSecondary: '#A0A3BD',
  textMuted: '#6B7194',
  textDark: '#0A0E21',
  
  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.15)',
  
  // Gradient arrays
  gradientPrimary: ['#6C63FF', '#00D9FF'],
  gradientSuccess: ['#00E676', '#00C853'],
  gradientDanger: ['#FF5252', '#FF1744'],
  gradientDark: ['#0A0E21', '#1A1F36'],
  gradientCard: ['#1A1F36', '#242942'],
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
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 32,
  hero: 40,
};

export const BorderRadius = {
  sm: 6,
  base: 10,
  md: 12,
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
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
};
