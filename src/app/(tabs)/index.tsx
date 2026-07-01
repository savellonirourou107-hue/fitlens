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
import { Camera, Activity, BookText } from 'lucide-react-native';
import { theme } from '../../theme';
import { Card, StatCard } from '../../components/Card';
import RingProgress from '../../components/RingProgress';
import MacroDonut from '../../components/MacroDonut';
import { useAppStore } from '../../store/useAppStore';
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

  // 用户视角 "还能吃" = 目标 - 已摄入 + 已消耗 = 目标 - 净摄入
  const remaining = summary.targetKcal - summary.intakeKcal + summary.burnedKcal;

  // 进度环：进度 = 已吃 / (目标 + 运动补偿) ，clamp 0~1
  const effectiveTarget =
    summary.targetKcal > 0 ? summary.targetKcal + summary.burnedKcal : 0;
  const remainingRatio =
    effectiveTarget > 0 ? Math.min(1, summary.intakeKcal / effectiveTarget) : 0;

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

  // 折叠/展开次要信息
  const [showDetails, setShowDetails] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 标题栏 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>FitLens</Text>
            <Text style={styles.dateText}>{format(parseISO(today), 'M月d日 EEEE')}</Text>
          </View>
        </View>

        {/* === 第 1 屏：优先级最高的 3 块 === */}

        {/* A. 顶部大卡片：今日还能吃 */}
        <View style={styles.remainingCard}>
          <View style={styles.remainingTopRow}>
            <View style={styles.remainingTextCol}>
              <Text style={styles.remainingTitle}>今日还能吃</Text>
              <View style={styles.remainingValueRow}>
                <Text style={styles.remainingValue}>{remaining}</Text>
                <Text style={styles.remainingUnit}>千卡</Text>
              </View>
              <Text style={styles.remainingHint}>目标缺口</Text>
              <Text style={styles.remainingSubText}>
                目标 {summary.targetKcal} kcal · 当前缺口 {summary.deficitKcal} kcal
              </Text>
            </View>
            <View style={styles.remainingRingCol}>
              <RingProgress
                progress={remainingRatio}
                valueLabel={`${Math.max(0, Math.round(remaining))}`}
                centerLabel={`/ ${summary.targetKcal}kcal`}
                size={110}
                strokeWidth={10}
              />
            </View>
          </View>
        </View>

        {/* B. 主按钮：拍照记餐 + 记录运动 */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => router.push('/meal/add')}
          >
            <Camera size={22} color={theme.colors.textInverse} style={styles.actionBtnIcon} />
            <Text style={styles.actionBtnText}>拍照记餐</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => router.push('/exercise/add')}
          >
            <Activity size={22} color={theme.colors.textInverse} style={styles.actionBtnIcon} />
            <Text style={[styles.actionBtnText, styles.actionBtnSecondaryText]}>记录运动</Text>
          </Pressable>
        </View>

        {/* C. 紧凑三列统计 */}
        <View style={styles.compactRow}>
          <StatCard
            label="摄入"
            value={`${summary.intakeKcal}`}
            unit="kcal"
            accent={theme.colors.secondary}
          />
          <StatCard
            label="消耗"
            value={`${summary.burnedKcal}`}
            unit="kcal"
            accent={theme.colors.accent}
          />
          <StatCard
            label="净摄入"
            value={`${summary.netKcal}`}
            unit="kcal"
            accent={theme.colors.primary}
          />
        </View>

        {/* 折叠开关：第 2 屏区域 */}
        <Pressable
          style={styles.expandBtn}
          onPress={() => setShowDetails((v) => !v)}
        >
          <Text style={styles.expandBtnText}>
            {showDetails ? '收起详情 ▴' : '查看今日详情 ▾'}
          </Text>
        </Pressable>

        {showDetails ? (
          <>
            {/* D. 今日餐食按餐次展开列表 */}
            <Card style={styles.summaryCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>今日餐食</Text>
                <Pressable onPress={() => router.push('/meal/add')}>
                  <Text style={styles.linkText}>+ 添加</Text>
                </Pressable>
              </View>
              {MEAL_ORDER.map((mt) => {
                const list = mealsByType[mt];
                return (
                  <View key={mt} style={styles.mealTypeBlock}>
                    <View style={styles.mealTypeHeader}>
                      <Text style={styles.mealTypeLabel}>{MEAL_TYPE_LABELS[mt]}</Text>
                      {list.length === 0 ? (
                        <Pressable onPress={() => router.push('/meal/add')}>
                          <Text style={styles.linkText}>+ 添加</Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.mealTypeKcal}>
                          {list.reduce(
                            (sum, m) =>
                              sum + m.items.reduce((s, i) => s + i.caloriesKcal, 0),
                            0,
                          )}{' '}
                          kcal
                        </Text>
                      )}
                    </View>
                    {list.length === 0 ? (
                      <Text style={styles.mealEmptyText}>还没添加？拍照记餐 →</Text>
                    ) : (
                      list.map((meal) => (
                        <View key={meal.id} style={styles.mealItemRow}>
                          <Text style={styles.mealItemNames} numberOfLines={1}>
                            {meal.items.map((i) => i.name).join(' · ')}
                          </Text>
                          <Text style={styles.mealItemKcal}>
                            {meal.items.reduce((s, i) => s + i.caloriesKcal, 0)} kcal
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                );
              })}
            </Card>

            {/* E. 今日运动列表 */}
            <Card style={styles.summaryCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>今日运动</Text>
                <Pressable onPress={() => router.push('/exercise/add')}>
                  <Text style={styles.linkText}>+ 添加</Text>
                </Pressable>
              </View>
              {todayExercises.length === 0 ? (
                <Text style={styles.emptyText}>还没运动？记录一项试试 →</Text>
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

            {/* F. 营养素占比甜甜圈 */}
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

            {/* G. 趋势入口 */}
            <Link href="/trend" asChild>
              <Pressable style={styles.trendLink}>
                <Text style={styles.trendLinkText}>查看 7 日趋势 →</Text>
              </Pressable>
            </Link>

            {/* H. 今日日记入口 */}
            <Link href="/(tabs)/diary" asChild>
              <Pressable style={styles.diaryLink}>
                <View style={styles.diaryLinkLeft}>
                  <BookText size={24} color={theme.colors.primaryDark} style={styles.diaryIcon} />
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
          </>
        ) : null}
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

  /* A. 顶部今日还能吃卡片 */
  remainingCard: {
    backgroundColor: theme.colors.primary + '15',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  remainingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  remainingTextCol: { flex: 1 },
  remainingTitle: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeights.semibold,
    marginBottom: theme.spacing.xs,
  },
  remainingValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  remainingValue: {
    fontSize: theme.fontSizes.display,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primaryDark,
    letterSpacing: -1,
  },
  remainingUnit: {
    fontSize: theme.fontSizes.lg,
    color: theme.colors.primaryDark,
    marginLeft: theme.spacing.xs,
    fontWeight: theme.fontWeights.semibold,
  },
  remainingHint: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  remainingSubText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginTop: 2,
    fontWeight: theme.fontWeights.medium,
  },
  remainingRingCol: {
    marginLeft: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* B. 主按钮 */
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  actionBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: theme.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    ...theme.shadow.card,
  },
  actionBtnPrimary: {
    backgroundColor: theme.colors.primary,
  },
  actionBtnSecondary: {
    backgroundColor: theme.colors.secondary,
  },
  actionBtnIcon: {
    marginRight: theme.spacing.sm,
  },
  actionBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.bold,
  },
  actionBtnSecondaryText: {
    // 颜色与 textInverse 一致，但保持可扩展
  },

  /* C. 紧凑三列 */
  compactRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },

  /* 折叠按钮 */
  expandBtn: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  expandBtnText: {
    color: theme.colors.primaryDark,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
  },

  /* 第 2 屏通用 */
  summaryCard: { marginBottom: theme.spacing.md },
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
  linkText: {
    color: theme.colors.primaryDark,
    fontSize: theme.fontSizes.sm,
    fontWeight: '600',
  },

  /* D. 餐食列表 */
  mealTypeBlock: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  mealTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  mealTypeLabel: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
  },
  mealTypeKcal: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.medium,
  },
  mealEmptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    fontStyle: 'italic',
    paddingVertical: theme.spacing.xs,
  },
  mealItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: theme.spacing.sm,
  },
  mealItemNames: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  mealItemKcal: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
  },

  /* E. 运动列表 */
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  exerciseType: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    textTransform: 'capitalize',
  },
  exerciseMeta: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.sm,
  },

  /* F. 营养素甜甜圈 */
  donutRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },

  /* G. 趋势入口 */
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

  /* H. 日记入口 */
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
  diaryIcon: { marginRight: theme.spacing.md },
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

  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
});
