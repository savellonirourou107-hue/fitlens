import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { theme } from '../theme';

export interface RingProgressProps {
  /** 进度 0~1，超出会 clamp */
  progress: number;
  /** 中心大字数值 */
  valueLabel: string;
  /** 中心小字标签 */
  centerLabel?: string;
  /** 进度环颜色（单色），若不传用渐变 */
  color?: string;
  /** 渐变起止色，当 color 未传时使用 */
  gradientFrom?: string;
  gradientTo?: string;
  /** 背景环色 */
  trackColor?: string;
  size?: number; // 直径，默认 180
  strokeWidth?: number; // 默认 14
}

export default function RingProgress({
  progress,
  valueLabel,
  centerLabel,
  color,
  gradientFrom = theme.colors.primary,
  gradientTo = theme.colors.primaryDark,
  trackColor = theme.colors.surfaceMuted,
  size = 180,
  strokeWidth = 14,
}: RingProgressProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const r = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped);
  const center = size / 2;
  const useGradient = !color;
  const gradientId = 'ringProgressGradient';
  const valueFontSize = Math.max(theme.fontSizes.lg, Math.round(size * 0.24));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {useGradient ? (
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradientFrom} />
              <Stop offset="100%" stopColor={gradientTo} />
            </LinearGradient>
          </Defs>
        ) : null}
        {/* 背景环 */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* 前景进度环 */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={useGradient ? `url(#${gradientId})` : color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.centerContent} pointerEvents="none">
        <Text style={[styles.valueLabel, { fontSize: valueFontSize }]}>{valueLabel}</Text>
        {centerLabel ? (
          <Text style={styles.centerLabel}>{centerLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueLabel: {
    fontSize: theme.fontSizes.xxl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text,
  },
  centerLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
});
