import { Link, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { Card, StatCard } from '../../components/Card';
import RingProgress from '../../components/RingProgress';
import MacroDonut from '../../components/MacroDonut';
import { useAppStore } from '../../store/useAppStore';
import { macroTargets } from '../../core/calc';
import { MEAL_TYPE_LABELS } from '../../types';
import type { MealType } from '../../types';
import { format, parseISO } from 'date-fns';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function DashboardScreen() {
  const meals = useAppStore((s) => s.meals);
  const exercises = useAppStore((s) => s.exercises);
  const profile = useAppStore((s) => s.profile);
  const diary = useAppStore((s) => s.getDiaryByDate(format(new Date(), 'yyyy-MM-dd')));
  const getDailySummary = useAppStore((s) => s.getDailySummary);

  const today = format(new Date(), 'yyyy-MM-dd');
  const summary = getDailySummary(today);

  const weightKg = profile?.weightKg ?? 65;
  const targetMacros = macroTargets(summary.targetKcal || 2000, weightKg);

  // 摄入进度 = 净摄入 / 目标（用于环形图）。clamp 0~1.2 显示，超出则满。
  const intakeRatio =
    summary.targetKcal > 0
      ? Math.min(1, summary.intakeKcal / summary.targetKcal)
      : 0;

  // 按餐次分组的今日餐食
  const mealsByType = useMemo(() => {
    const map: Record<MealType, typeof meals> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const m of meals) {
      if (m.date === today && map[m.mealType]) {
        map[m.mealType].push(m);
      }
    }
    return map;
  }, [meals, today]);

  // 今日运动列表
  const todayExercises = exercises.filter((x) => x.date === today);

  // 缺口状态文案
  const deficitStatus = useMemo(() => {
    if (summary.deficitKcal === 0) return { text: '今日刚达标', color: theme.colors.textMuted };
    if (summary.deficitKcal < 0) return { text: '保持缺口中 ✓', color: theme.colors.success };
    return { text: '已超出目标', color: theme.colors.danger };
  }, [summary.deficitKcal]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 标题 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>FitLens</Text>
            <Text style={styles.dateText}>{format(parseISO(today), 'M月d日 EEEE')}</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{profile ? '已设置目标' : '未设置'}</Text>
          </View>
        </View>

        {/* 环形进度 + 缺口状态 */}
        <Card style={styles.summaryCard}>
          <View style={styles.ringRow}>
            <RingProgress
              progress={intakeRatio}
              valueLabel={`${summary.intakeKcal}`}
              centerLabel={`/ ${summary.targetKcal} kcal`}
              size={170}
              strokeWidth={16}
            />
            <View style={styles.ringSide}>
              <Text style={styles.ringSideTitle}>今日热量</Text>
              <View style={styles.sideStatRow}>
                <View style={[styles.sideDot, { backgroundColor: theme.colors.secondary }]} />
                <Text style={styles.sideStatLabel}>摄入</Text>
                <Text style={styles.sideStatValue}>{summary.intakeKcal}</Text>
              </View>
              <View style={styles.sideStatRow}>
                <View style={[styles.sideDot, { backgroundColor: theme.colors.accent }]} />
                <Text style={styles.sideStatLabel}>消耗</Text>
                <Text style={styles.sideStatValue}>{summary.burnedKcal}</Text>
              </View>
              <View style={styles.sideStatRow}>
                <View style={[styles.sideDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={styles.sideStatLabel}>净摄入</Text>
                <Text style={styles.sideStatValue}>{summary.netKcal}</Text>
              </View>
              <Text style={[styles.deficitText, { color: deficitStatus.color }]}>
                {deficitStatus.text}
              </Text>
            </View>
          </View>
        </Card>

        {/* 紧凑统计行 */}
        <View style={styles.compactRow}>
          <StatCard label="热量缺口" value={`${summary.deficitKcal}`} unit="kcal"
            accent={summary.deficitKcal < 0 ? theme.colors.success : theme.colors.danger} />
          <StatCard label="缺口目标" value={`${summary.targetKcal}`} unit="kcal"
            accent={theme.colors.textMuted} />
        </View>

        {/* 营养素甜甜圈 */}
        <Card style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>营养素占比</Text>
          <View style={styles.donutRow}>
            <MacroDonut
              proteinG={summary.proteinG}
              carbsG={summary.carbsG}
              fatG={summary.fatG}
              size={150}
              strokeWidth={16}
            />
          </View>
        </Card>

        {/* 今日餐食 */}
        <Card style={styles.summaryCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>今日餐食</Text>
            <Pressable onPress={() => router.push('/meal/add')}>
              <Text style={styles.linkText}>+ 添加</Text>
            </Pressable>
          </View>
          {MEAL_ORDER.map((mt) => {
            const list = mealsByType[mt];
            const kcal = list.reduce(
              (sum, m) => sum + m.items.reduce((s, i) => s + i.caloriesKcal, 0),
              0,
            );
            return (
              <View key={mt} style={styles.mealTypeRow}>
                <Text style={styles.mealTypeLabel}>{MEAL_TYPE_LABELS[mt]}</Text>
                <Text style={styles.mealTypeCount}>
                  {list.length} 项 · {kcal} kcal
                </Text>
              </View>
            );
          })}
        </Card>

        {/* 今日运动 */}
        <Card style={styles.summaryCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>今日运动</Text>
            <Pressable onPress={() => router.push('/exercise/add')}>
              <Text style={styles.linkText}>+ 添加</Text>
            </Pressable>
          </View>
          {todayExercises.length === 0 ? (
            <Text style={styles.emptyText}>暂无运动记录</Text>
          ) : (
            todayExercises.map((x) => (
              <View key={x.id} style={styles.exerciseRow}>
                <Text style={styles.exerciseType}>{x.type}</Text>
                <Text style={styles.exerciseMeta}>
                  {x.durationMin}min · -{x.caloriesBurnedKcal}kcal
                </Text>
              </View>
            ))
          )}
        </Card>

        {/* 操作按钮 */}
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/meal/add')}>
            <Text style={styles.actionBtnText}>＋ 记录餐食</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: theme.colors.secondary }]}
            onPress={() => router.push('/exercise/add')}>
            <Text style={styles.actionBtnText}>＋ 记录运动</Text>
          </Pressable>
        </View>

        {/* 今日日记入口 */}
        <Link href="/(tabs)/diary" asChild>
          <Pressable style={styles.diaryLink}>
            <View style={styles.diaryLinkLeft}>
              <Text style={styles.diaryEmoji}>📝</Text>
              <View>
                <Text style={styles.diaryTitle}>今日日记</Text>
                <Text style={styles.diaryPreview} numberOfLines={1}>
                  {diary ? diary.content : '记录今日感想 / 感悟 / 收获'}
                </Text>
              </View>
            </View>
            <Text style={styles.diaryArrow}>→</Text>
          </Pressable>
        </Link>

        {/* 趋势入口 */}
        <Link href="/trend" asChild>
          <Pressable style={styles.trendLink}>
            <Text style={styles.trendLinkText}>查看 7 日趋势 →</Text>
          </Pressable>
        </Link>

        <Text style={styles.hintText}>
          {meals.length} 条餐食 · {exercises.length} 条运动
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  appName: {
    fontSize: theme.fontSizes.xxl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primaryDark,
  },
  dateText: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, marginTop: 2 },
  headerBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  headerBadgeText: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
  summaryCard: { marginBottom: theme.spacing.md },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg },
  ringSide: { flex: 1 },
  ringSideTitle: {
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  sideStatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs },
  sideDot: { width: 8, height: 8, borderRadius: 4, marginRight: theme.spacing.sm },
  sideStatLabel: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, flex: 1 },
  sideStatValue: { color: theme.colors.text, fontSize: theme.fontSizes.md, fontWeight: '600' },
  deficitText: { marginTop: theme.spacing.sm, fontSize: theme.fontSizes.sm, fontWeight: '600' },
  compactRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  sectionTitle: {
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  linkText: { color: theme.colors.primaryDark, fontSize: theme.fontSizes.sm, fontWeight: '600' },
  donutRow: { alignItems: 'center', paddingVertical: theme.spacing.sm },
  mealTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  mealTypeLabel: { color: theme.colors.text, fontSize: theme.fontSizes.md },
  mealTypeCount: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, textAlign: 'center', paddingVertical: theme.spacing.md },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  exerciseType: { color: theme.colors.text, fontSize: theme.fontSizes.md, textTransform: 'capitalize' },
  exerciseMeta: { color: theme.colors.accent, fontSize: theme.fontSizes.sm },
  actionRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  actionBtn: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
  },
  actionBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
  },
  trendLink: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  trendLinkText: {
    color: theme.colors.primaryDark,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.medium,
  },
  diaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  diaryLinkLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  diaryEmoji: { fontSize: 24, marginRight: theme.spacing.md },
  diaryTitle: {
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text,
  },
  diaryPreview: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    maxWidth: 200,
  },
  diaryArrow: {
    color: theme.colors.primaryDark,
    fontSize: theme.fontSizes.lg,
    fontWeight: '600',
  },
  hintText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.xs,
  },
});
