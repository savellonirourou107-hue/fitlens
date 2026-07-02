import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Mars, Venus, type LucideIcon, ChevronRight, Settings as SettingsIcon, Sparkles } from 'lucide-react-native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Avatar } from '../../components/Avatar';
import type { UserProfile, Sex, ActivityLevel, Goal } from '../../types';
import { ACTIVITY_LEVELS, GOALS } from '../../types';
import { bmrHarrisBenedict, tdee, dailyTargetKcal, macroTargets } from '../../core/calc';
import { format } from 'date-fns';

const SEX_OPTIONS: { value: Sex; label: string; icon: LucideIcon }[] = [
  { value: 'male', label: '男', icon: Mars },
  { value: 'female', label: '女', icon: Venus },
];

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: '几乎不运动',
  light: '轻度运动',
  moderate: '中度运动',
  active: '重度运动',
  very_active: '专业训练',
};

export default function ProfileScreen() {
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const authUser = useAuthStore((s) => s.user);

  // 表单状态
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'male');
  const [birthYear, setBirthYear] = useState(String(profile?.birthYear ?? 2005));
  const [height, setHeight] = useState(String(profile?.heightCm ?? 175));
  const [weight, setWeight] = useState(String(profile?.weightKg ?? 70));
  const [targetWeight, setTargetWeight] = useState(
    String(profile ? Math.round(profile.weightKg - 5) : 65),
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activityLevel ?? 'moderate',
  );
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'loss');

  const heightNum = Number(height) || 0;
  const weightNum = Number(weight) || 0;
  const targetWeightNum = Number(targetWeight) || 0;
  const age = useMemo(() => {
    const y = Number(birthYear) || 2000;
    return new Date().getFullYear() - y;
  }, [birthYear]);

  // BMI
  const heightM = heightNum / 100;
  const bmi = heightM > 0 ? weightNum / (heightM * heightM) : 0;
  const bmiLabel = useMemo(() => {
    if (bmi < 18.5) return { text: '偏瘦', color: theme.colors.secondary };
    if (bmi < 24) return { text: '正常', color: theme.colors.success };
    if (bmi < 28) return { text: '偏胖', color: theme.colors.warning };
    return { text: '肥胖', color: theme.colors.danger };
  }, [bmi]);

  // 热量计算预览
  const tempProfile: UserProfile = {
    id: 0,
    sex,
    birthYear: Number(birthYear) || 2000,
    heightCm: heightNum || 170,
    weightKg: weightNum || 65,
    activityLevel,
    goal,
    createdAt: '',
    updatedAt: '',
  };
  const bmr = bmrHarrisBenedict({ sex: tempProfile.sex, weightKg: tempProfile.weightKg, heightCm: tempProfile.heightCm, birthYear: tempProfile.birthYear });
  const tdeeVal = tdee(tempProfile);
  const targetKcal = dailyTargetKcal(tempProfile);
  const macros = macroTargets(targetKcal, tempProfile.weightKg);

  const handleSave = () => {
    if (!heightNum || !weightNum) {
      Alert.alert('提示', '请填写身高和体重');
      return;
    }
    const now = new Date().toISOString();
    const newProfile: UserProfile = {
      id: profile?.id,
      sex,
      birthYear: Number(birthYear) || 2000,
      heightCm: heightNum,
      weightKg: weightNum,
      activityLevel,
      goal,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    };
    setProfile(newProfile);
    Keyboard.dismiss();
    Alert.alert('保存成功', '个人资料已更新');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 账号区 */}
          {authUser && (
            <Card style={styles.accountCard}>
              <View style={styles.accountRow}>
                <Avatar seed={authUser.avatarSeed} nickname={authUser.nickname} size={48} />
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{authUser.nickname}</Text>
                  <Text style={styles.accountEmail}>{authUser.email}</Text>
                </View>
              </View>
              <Link href="/settings/account" asChild>
                <Pressable style={styles.accountLink} accessibilityLabel="账号设置">
                  <SettingsIcon size={16} color={theme.colors.textMuted} />
                  <Text style={styles.accountLinkText}>账号设置</Text>
                  <ChevronRight size={16} color={theme.colors.textMuted} />
                </Pressable>
              </Link>
              <Link href="/coach" asChild>
                <Pressable style={styles.accountLink} accessibilityLabel="AI 教练">
                  <Sparkles size={16} color={theme.colors.primary} />
                  <Text style={[styles.accountLinkText, { color: theme.colors.primary }]}>AI 减脂教练</Text>
                  <ChevronRight size={16} color={theme.colors.textMuted} />
                </Pressable>
              </Link>
            </Card>
          )}

        {/* 顶部标题 */}
        <View style={styles.header}>
          <Text style={styles.title}>个人资料</Text>
          <Text style={styles.subtitle}>用于计算每日热量消耗</Text>
        </View>

        {/* 性别 + 年龄 */}
        <Card style={styles.card}>
          <Text style={styles.label}>性别</Text>
          <View style={styles.sexRow}>
            {SEX_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.sexBtn, sex === opt.value && styles.sexBtnActive]}
                onPress={() => setSex(opt.value)}
              >
                <opt.icon
                  size={28}
                  color={sex === opt.value ? theme.colors.primary : theme.colors.textMuted}
                  style={styles.sexIcon}
                />
                <Text style={[styles.sexLabel, sex === opt.value && styles.sexLabelActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>出生年份</Text>
              <TextInput
                style={styles.input}
                value={birthYear}
                onChangeText={setBirthYear}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>年龄</Text>
              <View style={[styles.input, styles.readOnly]}>
                <Text style={styles.readOnlyText}>{age} 岁</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* 身高体重 */}
        <Card style={styles.card}>
          <Text style={styles.label}>身体数据</Text>

          {/* 身高 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>身高</Text>
            <View style={styles.numberInputRow}>
              <TextInput
                style={styles.numberInput}
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.unit}>cm</Text>
            </View>
          </View>

          {/* 当前体重 */}
          <View style={styles.inputGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>当前体重</Text>
              {heightM > 0 && (
                <Text style={[styles.bmiTag, { color: bmiLabel.color }]}>
                  BMI {bmi.toFixed(1)} · {bmiLabel.text}
                </Text>
              )}
            </View>
            <View style={styles.weightVisual}>
              <View style={styles.weightBarBg}>
                <View
                  style={[
                    styles.weightBarFill,
                    {
                      width: `${Math.min(100, ((weightNum - 40) / 80) * 100)}%`,
                      backgroundColor: bmi < 24 ? theme.colors.primary : theme.colors.accent,
                    },
                  ]}
                />
              </View>
              <View style={styles.numberInputRow}>
                <TextInput
                  style={styles.numberInput}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                />
                <Text style={styles.unit}>kg</Text>
              </View>
            </View>
          </View>

          {/* 目标体重 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>目标体重</Text>
            <View style={styles.numberInputRow}>
              <TextInput
                style={styles.numberInput}
                value={targetWeight}
                onChangeText={setTargetWeight}
                keyboardType="numeric"
              />
              <Text style={styles.unit}>kg</Text>
            </View>
            {weightNum > 0 && targetWeightNum > 0 && (
              <Text style={styles.tip}>
                距离目标还差 {(weightNum - targetWeightNum).toFixed(1)} kg
                {goal !== 'maintain' &&
                  `，建议每周减 ${goal === 'loss' ? '0.5' : goal === 'mild_loss' ? '0.25' : '1.0'} kg`}
              </Text>
            )}
          </View>
        </Card>

        {/* 活动水平 */}
        <Card style={styles.card}>
          <Text style={styles.label}>日常活动</Text>
          <View style={styles.activityGrid}>
            {ACTIVITY_LEVELS.map((a) => (
              <Pressable
                key={a.value}
                style={[
                  styles.activityBtn,
                  activityLevel === a.value && styles.activityBtnActive,
                ]}
                onPress={() => setActivityLevel(a.value)}
              >
                <Text
                  style={[
                    styles.activityLabel,
                    activityLevel === a.value && styles.activityLabelActive,
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* 减脂目标 */}
        <Card style={styles.card}>
          <Text style={styles.label}>减脂目标</Text>
          <View style={styles.goalGrid}>
            {GOALS.map((g) => (
              <Pressable
                key={g.value}
                style={[styles.goalBtn, goal === g.value && styles.goalBtnActive]}
                onPress={() => setGoal(g.value)}
              >
                <Text
                  style={[styles.goalLabel, goal === g.value && styles.goalLabelActive]}
                >
                  {g.label}
                </Text>
                {g.weeklyKg > 0 && (
                  <Text
                    style={[styles.goalSub, goal === g.value && styles.goalSubActive]}
                  >
                    {g.weeklyKg}kg/周
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </Card>

        {/* 计算结果 */}
        <Card style={[styles.card, styles.resultCard]}>
          <Text style={styles.label}>计算结果</Text>
          <View style={styles.resultGrid}>
            <View style={styles.resultItem}>
              <Text style={styles.resultValue}>{Math.round(bmr)}</Text>
              <Text style={styles.resultUnit}>BMR kcal</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={[styles.resultValue, { color: theme.colors.primary }]}>
                {Math.round(tdeeVal)}
              </Text>
              <Text style={styles.resultUnit}>TDEE kcal</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={[styles.resultValue, { color: theme.colors.secondary }]}>
                {Math.round(targetKcal)}
              </Text>
              <Text style={styles.resultUnit}>目标 kcal</Text>
            </View>
          </View>
          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <View style={[styles.macroDot, { backgroundColor: theme.colors.primary }]} />
              <Text style={styles.macroLabel}>蛋白质 {Math.round(macros.protein)}g</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroDot, { backgroundColor: theme.colors.secondary }]} />
              <Text style={styles.macroLabel}>碳水 {Math.round(macros.carbs)}g</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroDot, { backgroundColor: theme.colors.accent }]} />
              <Text style={styles.macroLabel}>脂肪 {Math.round(macros.fat)}g</Text>
            </View>
          </View>
        </Card>

        {/* 保存 */}
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>保存</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  header: { marginBottom: theme.spacing.lg },
  title: {
    fontSize: theme.fontSizes.xxl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text,
  },
  subtitle: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, marginTop: 4 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  label: {
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  sexRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  sexBtn: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  sexBtnActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
  sexIcon: { marginBottom: 4 },
  sexIconActive: { opacity: 1 },
  sexLabel: { fontSize: theme.fontSizes.md, color: theme.colors.textMuted, fontWeight: '500' },
  sexLabelActive: { color: theme.colors.primary, fontWeight: theme.fontWeights.bold },
  row: { flexDirection: 'row', gap: theme.spacing.md },
  inputGroup: { marginBottom: theme.spacing.md },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.fontSizes.lg,
    textAlign: 'center',
  },
  readOnly: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readOnlyText: { fontSize: theme.fontSizes.lg, color: theme.colors.textMuted, fontWeight: '500' },
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
    position: 'relative',
  },
  numberInput: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    paddingRight: 64,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.fontSizes.xxl,
    fontWeight: theme.fontWeights.bold,
    textAlign: 'center',
  },
  unit: {
    position: 'absolute',
    right: theme.spacing.lg,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  bmiTag: {
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semibold,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  weightVisual: { marginTop: theme.spacing.xs },
  weightBarBg: {
    height: 6,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  weightBarFill: { height: '100%', borderRadius: theme.radius.pill },
  tip: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  activityBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activityBtnActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
  activityLabel: { fontSize: theme.fontSizes.sm, color: theme.colors.text },
  activityLabelActive: { color: theme.colors.primary, fontWeight: theme.fontWeights.semibold },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  goalBtn: {
    flex: 1,
    minWidth: '42%',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  goalBtnActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
  goalLabel: { fontSize: theme.fontSizes.md, color: theme.colors.text, fontWeight: '500' },
  goalLabelActive: { color: theme.colors.primary, fontWeight: theme.fontWeights.bold },
  goalSub: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  goalSubActive: { color: theme.colors.primaryDark },
  resultCard: { backgroundColor: theme.colors.surfaceMuted },
  resultGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  resultItem: { alignItems: 'center', flex: 1 },
  resultValue: {
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text,
  },
  resultUnit: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  macroItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { fontSize: theme.fontSizes.sm, color: theme.colors.text },
  saveBtn: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    width: '100%',
  },
  accountCard: { marginBottom: theme.spacing.md },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  accountInfo: { flex: 1 },
  accountName: { fontSize: theme.fontSizes.lg, fontWeight: '700', color: theme.colors.text },
  accountEmail: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, marginTop: 2 },
  accountLink: {
    marginTop: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  accountLinkText: { flex: 1, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
  saveBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.bold,
  },
});
