/**
 * FitLens 全局设计主题
 * 现代清爽，健康减脂风格。
 */
export const theme = {
  colors: {
    primary: '#16A34A',
    primaryDark: '#166534',
    primarySoft: '#DCFCE7',
    secondary: '#0284C7',
    secondarySoft: '#E0F2FE',
    accent: '#F97316',
    accentSoft: '#FFEDD5',
    danger: '#EF4444',
    dangerSoft: '#FEE2E2',
    warning: '#F59E0B',
    success: '#10B981',
    background: '#F6F7F4',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF2EA',
    surfaceWarm: '#FFF7ED',
    text: '#162015',
    textMuted: '#667266',
    textInverse: '#FFFFFF',
    border: '#DDE5DA',
    chart: [
      '#16A34A',
      '#0284C7',
      '#F97316',
      '#8B5CF6',
      '#EF4444',
      '#14B8A6',
      '#475569',
    ],
  },
  radius: { sm: 6, md: 8, lg: 8, xl: 8, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 44 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 30, display: 46 },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  shadow: {
    card: {
      shadowColor: '#162015',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
  },
};

export type Theme = typeof theme;
