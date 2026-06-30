import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';

export interface MacroDonutProps {
  proteinG: number;
  carbsG: number;
  fatG: number;
  size?: number;       // 默认 160
  strokeWidth?: number; // 默认 18
}

interface Segment {
  color: string;
  label: string;
  kcal: number;
  percent: number;
  arc: number;
}

export default function MacroDonut({
  proteinG,
  carbsG,
  fatG,
  size = 160,
  strokeWidth = 18,
}: MacroDonutProps) {
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  const proteinKcal = proteinG * 4;
  const carbsKcal = carbsG * 4;
  const fatKcal = fatG * 9;
  const total = proteinKcal + carbsKcal + fatKcal;

  const center = size / 2;

  // 无数据：完整灰色环 + 中心"无数据"
  if (total <= 0) {
    return (
      <View style={[styles.wrapper, { width: size }]}>
        <View style={styles.donutWrap}>
          <Svg width={size} height={size}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={theme.colors.border}
              strokeWidth={strokeWidth}
              fill="none"
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>
          <View style={styles.centerLayer}>
            <Text style={styles.emptyText}>无数据</Text>
          </View>
        </View>
        <View style={styles.legend}>
          <LegendRow color={theme.colors.primary} label="蛋白质" text="0%" />
          <LegendRow color={theme.colors.secondary} label="碳水" text="0%" />
          <LegendRow color={theme.colors.accent} label="脂肪" text="0%" />
        </View>
      </View>
    );
  }

  const proteinPct = proteinKcal / total;
  const carbsPct = carbsKcal / total;
  const fatPct = fatKcal / total;

  const segments: Segment[] = [
    {
      color: theme.colors.primary,
      label: '蛋白质',
      kcal: Math.round(proteinKcal),
      percent: proteinPct,
      arc: circumference * proteinPct,
    },
    {
      color: theme.colors.secondary,
      label: '碳水',
      kcal: Math.round(carbsKcal),
      percent: carbsPct,
      arc: circumference * carbsPct,
    },
    {
      color: theme.colors.accent,
      label: '脂肪',
      kcal: Math.round(fatKcal),
      percent: fatPct,
      arc: circumference * fatPct,
    },
  ];

  // 每段起点 offset = -(前面段长之和)
  let cumulative = 0;
  const offsets = segments.map((seg) => {
    const offset = -cumulative;
    cumulative += seg.arc;
    return offset;
  });

  return (
    <View style={[styles.wrapper, { width: size }]}>
      <View style={styles.donutWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={theme.colors.surfaceMuted}
            strokeWidth={strokeWidth}
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
          {segments.map((seg, i) => (
            <Circle
              key={seg.label}
              cx={center}
              cy={center}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${seg.arc} ${circumference - seg.arc}`}
              strokeDashoffset={offsets[i]}
              strokeLinecap="butt"
              transform={`rotate(-90 ${center} ${center})`}
            />
          ))}
        </Svg>
        <View style={styles.centerLayer}>
          <Text style={styles.totalKcal}>{Math.round(total)}</Text>
          <Text style={styles.totalUnit}>kcal</Text>
        </View>
      </View>
      <View style={styles.legend}>
        {segments.map((seg) => (
          <LegendRow
            key={seg.label}
            color={seg.color}
            label={seg.label}
            text={`${seg.kcal}kcal · ${(seg.percent * 100).toFixed(0)}%`}
          />
        ))}
      </View>
    </View>
  );
}

interface LegendRowProps {
  color: string;
  label: string;
  text: string;
}

function LegendRow({ color, label, text }: LegendRowProps) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  donutWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalKcal: {
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text,
  },
  totalUnit: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  emptyText: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeights.medium,
  },
  legend: {
    marginTop: theme.spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: theme.spacing.sm,
  },
  legendLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeights.medium,
    marginRight: theme.spacing.sm,
    width: 44,
  },
  legendValue: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
  },
});
