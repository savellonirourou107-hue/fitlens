import { Stack } from 'expo-router';
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { theme } from '../theme';
import { useAppStore } from '../store/useAppStore';
import { format, parseISO } from 'date-fns';

const screenWidth = Dimensions.get('window').width;

export default function TrendScreen() {
  // 订阅 meals / exercises 触发重渲染
  const meals = useAppStore((s) => s.meals);
  const exercises = useAppStore((s) => s.exercises);
  const get7DayTrend = useAppStore((s) => s.get7DayTrend);

  const today = format(new Date(), 'yyyy-MM-dd');
  // 注意: get7DayTrend 内部用 lastNDays(7, parseISO(today))
  const trend = get7DayTrend(today);

  const labels = trend.map((s) => format(parseISO(s.date), 'MM-dd'));

  const baseChartConfig = (colorRgba: string) => ({
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    color: (opacity = 1) => colorRgba.replace('OPACITY', String(opacity)),
    labelColor: (opacity = 1) =>
      `rgba(100,116,139,${opacity})`,
    propsForBackgroundDots: {
      stroke: theme.colors.border,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: theme.colors.primaryDark,
    },
  } as any);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: '7 日趋势' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 净摄入折线 */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>净摄入趋势 (kcal)</Text>
          <LineChart
            data={{
              labels,
              datasets: [{ data: trend.map((s) => s.netKcal) }],
            }}
            width={screenWidth - 48}
            height={220}
            chartConfig={baseChartConfig('rgba(52,211,153,OPACITY)')}
            bezier
            style={styles.chart}
          />
        </View>

        {/* 摄入 vs 消耗 */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>摄入 vs 消耗 (kcal)</Text>
          <BarChart
            data={{
              labels,
              datasets: [
                { data: trend.map((s) => s.intakeKcal) },
                { data: trend.map((s) => s.burnedKcal) },
              ],
            }}
            yAxisLabel=""
            yAxisSuffix=""
            width={screenWidth - 48}
            height={220}
            chartConfig={baseChartConfig('rgba(14,165,233,OPACITY)')}
            style={styles.chart}
          />
        </View>

        {/* 每日明细列表 */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>每日明细</Text>
          {trend.map((s) => (
            <View key={s.date} style={styles.dayRow}>
              <Text style={styles.dayDate}>{format(parseISO(s.date), 'MM-dd')}</Text>
              <Text style={styles.dayCell}>摄入 {s.intakeKcal}</Text>
              <Text style={styles.dayCell}>消耗 {s.burnedKcal}</Text>
              <Text
                style={[
                  styles.dayCell,
                  { color: s.deficitKcal < 0 ? theme.colors.success : theme.colors.danger },
                ]}
              >
                缺口 {s.deficitKcal}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  chartTitle: {
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  chart: { borderRadius: theme.radius.md },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dayDate: { fontWeight: theme.fontWeights.medium, color: theme.colors.text },
  dayCell: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm },
});
