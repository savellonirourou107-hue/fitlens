import { Stack } from 'expo-router';
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarOff } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { theme } from '../theme';
import { useAppStore } from '../store/useAppStore';

export default function TrendScreen() {
  const meals = useAppStore((s) => s.meals);
  const exercises = useAppStore((s) => s.exercises);
  const get7DayTrend = useAppStore((s) => s.get7DayTrend);

  const today = format(new Date(), 'yyyy-MM-dd');
  const trend = useMemo(() => get7DayTrend(today), [today, get7DayTrend, meals, exercises]);
  const maxNet = useMemo(() => Math.max(1, ...trend.map((s) => Math.abs(s.netKcal))), [trend]);
  const maxVolume = useMemo(
    () =>
      Math.max(
        1,
        ...trend.flatMap((s) => [Math.abs(s.intakeKcal), Math.abs(s.burnedKcal)]),
      ),
    [trend],
  );
  const averageNet = useMemo(
    () => Math.round(trend.reduce((sum, s) => sum + s.netKcal, 0) / trend.length),
    [trend],
  );
  const deficitDays = useMemo(() => trend.filter((s) => s.deficitKcal < 0).length, [trend]);
  const hasData = useMemo(
    () => trend.some((s) => s.netKcal !== 0 || s.intakeKcal !== 0 || s.burnedKcal !== 0),
    [trend],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: '7 日趋势' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.headerEyebrow}>最近 7 天</Text>
          <Text style={styles.headerTitle}>热量节奏</Text>
          <View style={styles.summaryRow}>
            <TrendMetric label="平均净摄入" value={averageNet} unit="kcal" color={theme.colors.primaryDark} />
            <TrendMetric label="缺口天数" value={deficitDays} unit="天" color={theme.colors.secondary} />
          </View>
        </View>

        {!hasData ? (
          <View style={styles.emptyState}>
            <CalendarOff size={48} color={theme.colors.textMuted} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>暂无数据</Text>
            <Text style={styles.emptyHint}>记录第一餐后就能看到趋势啦</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>净摄入趋势</Text>
              <Text style={styles.cardHint}>越靠左代表净摄入越低，越适合减脂目标。</Text>
              <View style={styles.netList}>
                {trend.map((day) => {
                  const isDeficit = day.deficitKcal < 0;
                  return (
                    <View key={day.date} style={styles.netRow}>
                      <Text style={styles.dayLabel}>{format(parseISO(day.date), 'MM-dd')}</Text>
                      <View style={styles.netTrack}>
                        <View
                          style={[
                            styles.netFill,
                            {
                              width: `${Math.min(100, (Math.abs(day.netKcal) / maxNet) * 100)}%`,
                              backgroundColor: isDeficit ? theme.colors.primary : theme.colors.danger,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.netValue, { color: isDeficit ? theme.colors.primaryDark : theme.colors.danger }]}>
                        {Math.round(day.netKcal)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>摄入 vs 消耗</Text>
              <View style={styles.barChart}>
                {trend.map((day) => (
                  <View key={day.date} style={styles.barColumn}>
                    <View style={styles.barPair}>
                      <View
                        style={[
                          styles.volumeBar,
                          {
                            height: `${Math.max(4, (day.intakeKcal / maxVolume) * 100)}%`,
                            backgroundColor: theme.colors.secondary,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.volumeBar,
                          {
                            height: `${Math.max(4, (day.burnedKcal / maxVolume) * 100)}%`,
                            backgroundColor: theme.colors.accent,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{format(parseISO(day.date), 'MM-dd')}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.legendRow}>
                <LegendDot color={theme.colors.secondary} label="摄入" />
                <LegendDot color={theme.colors.accent} label="消耗" />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>每日明细</Text>
              {trend.map((day, index) => (
                <View key={day.date} style={[styles.detailRow, index < trend.length - 1 && styles.detailDivider]}>
                  <Text style={styles.detailDate}>{format(parseISO(day.date), 'MM-dd')}</Text>
                  <Text style={styles.detailCell}>摄入 {Math.round(day.intakeKcal)}</Text>
                  <Text style={styles.detailCell}>消耗 {Math.round(day.burnedKcal)}</Text>
                  <Text
                    style={[
                      styles.detailCell,
                      { color: day.deficitKcal < 0 ? theme.colors.primaryDark : theme.colors.danger },
                    ]}
                  >
                    {day.deficitKcal < 0 ? '缺口' : '超出'} {Math.abs(Math.round(day.deficitKcal))}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TrendMetric({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <View style={styles.trendMetric}>
      <Text style={styles.trendMetricLabel}>{label}</Text>
      <View style={styles.trendMetricValueRow}>
        <Text style={[styles.trendMetricValue, { color }]}>{value}</Text>
        <Text style={styles.trendMetricUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 96,
  },
  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  headerEyebrow: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.medium,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.xxl,
    fontWeight: theme.fontWeights.bold,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  summaryRow: { flexDirection: 'row', gap: theme.spacing.sm },
  trendMetric: {
    flex: 1,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  trendMetricLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.xs,
    fontWeight: theme.fontWeights.medium,
  },
  trendMetricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: theme.spacing.xs,
  },
  trendMetricValue: {
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.bold,
  },
  trendMetricUnit: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.xs,
    marginLeft: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  cardTitle: {
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text,
  },
  cardHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  netList: { gap: theme.spacing.sm },
  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
  },
  dayLabel: {
    width: 48,
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.medium,
  },
  netTrack: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  netFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
  },
  netValue: {
    width: 58,
    textAlign: 'right',
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
  },
  barChart: {
    height: 180,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.lg,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barPair: {
    height: 134,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  volumeBar: {
    width: 9,
    borderRadius: theme.radius.sm,
  },
  barLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.xs,
    marginTop: theme.spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  legendText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
  },
  detailDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  detailDate: {
    width: 50,
    color: theme.colors.text,
    fontWeight: theme.fontWeights.bold,
  },
  detailCell: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    textAlign: 'right',
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  emptyIcon: {
    marginBottom: theme.spacing.md,
    opacity: 0.6,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
    marginBottom: theme.spacing.xs,
  },
  emptyHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
