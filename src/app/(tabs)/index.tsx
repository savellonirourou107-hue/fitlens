import { router } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Activity,
  BookText,
  Camera,
  ChevronRight,
  Flame,
  TrendingUp,
  Utensils,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { theme } from '../../theme';
import RingProgress from '../../components/RingProgress';
import { useAppStore } from '../../store/useAppStore';
import { MEAL_TYPE_LABELS } from '../../types';
import type { MealType } from '../../types';
import {
  buildBudgetInsight,
  buildMacroPercentages,
  mealTypeCaption,
  type BudgetTone,
} from '../../core/insights';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const toneStyles: Record<BudgetTone, { bg: string; fg: string; text: string }> = {
  steady: { bg: theme.colors.primarySoft, fg: theme.colors.primaryDark, text: '稳定' },
  tight: { bg: theme.colors.accentSoft, fg: theme.colors.accent, text: '偏紧' },
  over: { bg: theme.colors.dangerSoft, fg: theme.colors.danger, text: '超出' },
  empty: { bg: theme.colors.secondarySoft, fg: theme.colors.secondary, text: '待完善' },
};

export default function DashboardScreen() {
  const meals = useAppStore((s) => s.meals);
  const exercises = useAppStore((s) => s.exercises);
  const diary = useAppStore((s) => s.getDiaryByDate(format(new Date(), 'yyyy-MM-dd')));
  const getDailySummary = useAppStore((s) => s.getDailySummary);

  const today = format(new Date(), 'yyyy-MM-dd');
  const summary = getDailySummary(today);
  const insight = buildBudgetInsight(summary);
  const macroPercentages = buildMacroPercentages(summary);
  const tone = toneStyles[insight.tone];

  const mealsByType = useMemo(() => {
    const map: Record<MealType, typeof meals> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const meal of meals) {
      if (meal.date === today) map[meal.mealType].push(meal);
    }
    return map;
  }, [meals, today]);

  const todayExercises = useMemo(
    () => exercises.filter((exercise) => exercise.date === today),
    [exercises, today],
  );

  const nextMealType = MEAL_ORDER.find((mealType) => mealsByType[mealType].length === 0);

  // 稳定的导航回调，避免每次渲染创建新的 onPress 引用导致子组件无谓重渲染
  const goToTrend = useCallback(() => router.push('/trend'), []);
  const goToAddMeal = useCallback(() => router.push('/meal/add'), []);
  const goToAddExercise = useCallback(() => router.push('/exercise/add'), []);
  const goToDiary = useCallback(() => router.push('/(tabs)/diary'), []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>FitLens</Text>
            <Text style={styles.dateText}>{format(parseISO(today), 'M月d日')} · 今日记录</Text>
          </View>
          <Pressable style={styles.headerAction} onPress={goToTrend}>
            <TrendingUp size={16} color={theme.colors.primaryDark} />
            <Text style={styles.headerActionText}>趋势</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <View style={[styles.toneBadge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.toneBadgeText, { color: tone.fg }]}>{tone.text}</Text>
            </View>
            <Text style={styles.heroLabel}>今日还能吃</Text>
            <View style={styles.heroValueRow}>
              <Text style={[styles.heroValue, insight.tone === 'over' && styles.heroValueDanger]}>
                {insight.tone === 'over' ? Math.abs(insight.remainingKcal) : insight.remainingKcal}
              </Text>
              <Text style={styles.heroUnit}>{insight.tone === 'over' ? 'kcal 超出' : 'kcal'}</Text>
            </View>
            <Text style={styles.heroTitle}>{insight.title}</Text>
            <Text style={styles.heroSubtitle}>{insight.subtitle}</Text>
          </View>
          <RingProgress
            progress={insight.progress}
            valueLabel={`${Math.round(summary.intakeKcal)}`}
            centerLabel={`/ ${summary.targetKcal || '--'}`}
            size={112}
            strokeWidth={10}
            gradientFrom={tone.fg}
            gradientTo={theme.colors.secondary}
          />
        </View>

        <View style={styles.actionGrid}>
          <QuickAction
            icon={<Camera size={22} color={theme.colors.textInverse} />}
            title={nextMealType ? `记录${MEAL_TYPE_LABELS[nextMealType]}` : '拍照记餐'}
            subtitle="拍照或相册识别"
            color={theme.colors.primary}
            onPress={goToAddMeal}
          />
          <QuickAction
            icon={<Activity size={22} color={theme.colors.textInverse} />}
            title="记录运动"
            subtitle="时长或截图导入"
            color={theme.colors.secondary}
            onPress={goToAddExercise}
          />
        </View>

        <View style={styles.metricStrip}>
          <Metric label="摄入" value={summary.intakeKcal} unit="kcal" color={theme.colors.secondary} />
          <Metric label="消耗" value={summary.burnedKcal} unit="kcal" color={theme.colors.accent} />
          <Metric label="净摄入" value={summary.netKcal} unit="kcal" color={theme.colors.primaryDark} />
        </View>

        <SectionHeader title="今日时间线" action="补记录" onPress={goToAddMeal} />
        <View style={styles.timelineSurface}>
          {MEAL_ORDER.map((mealType, index) => {
            const list = mealsByType[mealType];
            const kcal = list.reduce(
              (sum, meal) => sum + meal.items.reduce((inner, item) => inner + item.caloriesKcal, 0),
              0,
            );
            const names = list
              .flatMap((meal) => meal.items.map((item) => item.name))
              .slice(0, 3)
              .join(' · ');
            return (
              <TimelineRow
                key={mealType}
                icon={<Utensils size={18} color={theme.colors.primaryDark} />}
                label={MEAL_TYPE_LABELS[mealType]}
                caption={mealTypeCaption(mealType)}
                detail={list.length > 0 ? names : '还没有记录'}
                value={list.length > 0 ? `${Math.round(kcal)} kcal` : '添加'}
                color={list.length > 0 ? theme.colors.primaryDark : theme.colors.textMuted}
                showDivider={index < MEAL_ORDER.length - 1 || todayExercises.length > 0}
                onPress={goToAddMeal}
              />
            );
          })}
          {todayExercises.length > 0 ? (
            todayExercises.map((exercise, index) => (
              <TimelineRow
                key={exercise.id}
                icon={<Flame size={18} color={theme.colors.accent} />}
                label="运动"
                caption={`${exercise.durationMin} 分钟`}
                detail={`${exercise.type} · ${exercise.intensity}`}
                value={`-${exercise.caloriesBurnedKcal} kcal`}
                color={theme.colors.accent}
                showDivider={index < todayExercises.length - 1}
                onPress={goToAddExercise}
              />
            ))
          ) : (
            <TimelineRow
              icon={<Flame size={18} color={theme.colors.accent} />}
              label="运动"
              caption="消耗补偿"
              detail="还没有运动记录"
              value="添加"
              color={theme.colors.textMuted}
              showDivider={false}
              onPress={goToAddExercise}
            />
          )}
        </View>

        <SectionHeader title="营养比例" action="7 日趋势" onPress={goToTrend} />
        <View style={styles.macroSurface}>
          <MacroBar
            label="蛋白"
            grams={summary.proteinG}
            percent={macroPercentages.protein}
            color={theme.colors.primary}
          />
          <MacroBar
            label="碳水"
            grams={summary.carbsG}
            percent={macroPercentages.carbs}
            color={theme.colors.secondary}
          />
          <MacroBar
            label="脂肪"
            grams={summary.fatG}
            percent={macroPercentages.fat}
            color={theme.colors.accent}
          />
        </View>

        <Pressable style={styles.diaryCallout} onPress={goToDiary}>
          <View style={styles.diaryIconBox}>
            <BookText size={20} color={theme.colors.primaryDark} />
          </View>
          <View style={styles.diaryText}>
            <Text style={styles.diaryTitle}>今日日记</Text>
            <Text style={styles.diaryPreview} numberOfLines={1}>
              {diary ? diary.content : '记录饮食、训练和状态变化'}
            </Text>
          </View>
          <ChevronRight size={20} color={theme.colors.textMuted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  color,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.quickAction, { backgroundColor: color }]} onPress={onPress}>
      <View style={styles.quickIcon}>{icon}</View>
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function Metric({
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
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]} numberOfLines={1}>
        {Math.round(value)}
      </Text>
      <Text style={styles.metricUnit}>{unit}</Text>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable style={styles.sectionAction} onPress={onPress}>
        <Text style={styles.sectionActionText}>{action}</Text>
        <ChevronRight size={16} color={theme.colors.primaryDark} />
      </Pressable>
    </View>
  );
}

function TimelineRow({
  icon,
  label,
  caption,
  detail,
  value,
  color,
  showDivider,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  caption: string;
  detail: string;
  value: string;
  color: string;
  showDivider: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.timelineRow, showDivider && styles.timelineDivider]} onPress={onPress}>
      <View style={styles.timelineIcon}>{icon}</View>
      <View style={styles.timelineBody}>
        <View style={styles.timelineTitleRow}>
          <Text style={styles.timelineLabel}>{label}</Text>
          <Text style={styles.timelineCaption}>{caption}</Text>
        </View>
        <Text style={styles.timelineDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Text style={[styles.timelineValue, { color }]}>{value}</Text>
    </Pressable>
  );
}

function MacroBar({
  label,
  grams,
  percent,
  color,
}: {
  label: string;
  grams: number;
  percent: number;
  color: string;
}) {
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroLabelCol}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroGrams}>{Math.round(grams)}g</Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${Math.min(100, percent)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroPercent}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 96,
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
    color: theme.colors.text,
  },
  dateText: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, marginTop: 2 },
  headerAction: {
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  headerActionText: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeights.semibold,
    fontSize: theme.fontSizes.sm,
  },
  hero: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadow.card,
  },
  heroCopy: { flex: 1, paddingRight: theme.spacing.md },
  toneBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    marginBottom: theme.spacing.sm,
  },
  toneBadgeText: {
    fontSize: theme.fontSizes.xs,
    fontWeight: theme.fontWeights.bold,
  },
  heroLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.medium,
  },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  heroValue: {
    color: theme.colors.primaryDark,
    fontSize: theme.fontSizes.display,
    fontWeight: theme.fontWeights.bold,
    letterSpacing: 0,
  },
  heroValueDanger: { color: theme.colors.danger },
  heroUnit: {
    marginLeft: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.bold,
    marginTop: theme.spacing.xs,
  },
  heroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    marginTop: 2,
    lineHeight: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  quickAction: {
    flex: 1,
    minHeight: 76,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadow.card,
  },
  quickIcon: { marginRight: theme.spacing.sm },
  quickCopy: { flex: 1 },
  quickTitle: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.bold,
  },
  quickSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: theme.fontSizes.xs,
    marginTop: 2,
  },
  metricStrip: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  metric: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.colors.border,
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.xs,
    fontWeight: theme.fontWeights.medium,
  },
  metricValue: {
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.bold,
    marginTop: 2,
  },
  metricUnit: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.bold,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    paddingLeft: theme.spacing.sm,
  },
  sectionActionText: {
    color: theme.colors.primaryDark,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
  },
  timelineSurface: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  timelineRow: {
    minHeight: 68,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  timelineIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  timelineBody: { flex: 1, minWidth: 0 },
  timelineTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  timelineLabel: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.bold,
  },
  timelineCaption: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.xs,
  },
  timelineDetail: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    marginTop: 2,
  },
  timelineValue: {
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.bold,
    marginLeft: theme.spacing.sm,
  },
  macroSurface: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
  },
  macroLabelCol: { width: 58 },
  macroLabel: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.bold,
  },
  macroGrams: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.xs,
  },
  macroTrack: {
    flex: 1,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
  },
  macroPercent: {
    width: 42,
    textAlign: 'right',
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.medium,
  },
  diaryCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceWarm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.accentSoft,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  diaryIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  diaryText: { flex: 1, minWidth: 0 },
  diaryTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.bold,
  },
  diaryPreview: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    marginTop: 2,
  },
});
