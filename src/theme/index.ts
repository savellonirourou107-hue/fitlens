/**
 * FitLens 全局设计主题
 * 现代清爽，健康减脂风格。
 */
export const theme = {
  colors: {
    primary: '#34D399',      // 翡翠绿
    primaryDark: '#059669',
    secondary: '#0EA5E9',   // 天蓝
    accent: '#F59E0B',       // 暖橙（运动）
    danger: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    text: '#0F172A',
    textMuted: '#64748B',
    textInverse: '#FFFFFF',
    border: '#E2E8F0',
    chart: [
      '#34D399',
      '#0EA5E9',
      '#F59E0B',
      '#A78BFA',
      '#EF4444',
      '#10B981',
      '#6366F1',
    ],
  },
  radius: { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  fontSizes: { xs: 13, sm: 15, md: 17, lg: 21, xl: 25, xxl: 33, display: 52 },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  shadow: {
    card: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
  },
};

export type Theme = typeof theme;
