import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'lucide-react-native';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { useAppStore } from '../../store/useAppStore';
import { genId } from '../../core/id';
import { exerciseCalories } from '../../core/calc';
import { EXERCISE_TYPES } from '../../types';
import type { ExerciseEntry, Intensity } from '../../types';
import { format } from 'date-fns';

export default function ExerciseAddScreen() {
  const addExercise = useAppStore((s) => s.addExercise);
  const weightKg = useAppStore((s) => s.profile?.weightKg ?? 65);

  const [type, setType] = useState<string>(EXERCISE_TYPES[0]?.value ?? 'walking');
  const [durationMin, setDurationMin] = useState('');
  const [intensity, setIntensity] = useState<Intensity>('moderate');

  const duration = Number(durationMin) || 0;
  const calories = exerciseCalories(type, duration, weightKg, intensity);

  const handleSave = () => {
    if (duration <= 0) {
      Alert.alert('提示', '请输入运动时长');
      return;
    }
    const entry: ExerciseEntry = {
      id: genId('ex_'),
      date: format(new Date(), 'yyyy-MM-dd'),
      type: type as ExerciseEntry['type'],
      durationMin: duration,
      intensity,
      caloriesBurnedKcal: calories,
      createdAt: new Date().toISOString(),
    };
    addExercise(entry);
    router.back();
  };

  const intensityMap: Record<Intensity, string> = {
    low: '低',
    moderate: '中',
    high: '高',
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: '记录运动' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 运动类型 */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>运动类型</Text>
          <View style={styles.typeGrid}>
            {EXERCISE_TYPES.map((et) => (
              <Pressable
                key={et.value}
                style={[
                  styles.typeBtn,
                  type === et.value && { backgroundColor: theme.colors.secondary },
                ]}
                onPress={() => setType(et.value)}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    type === et.value && { color: theme.colors.textInverse },
                  ]}
                >
                  {et.label}
                </Text>
                <Text
                  style={[
                    styles.metText,
                    type === et.value && { color: theme.colors.textInverse },
                  ]}
                >
                  MET {et.met}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* 时长 */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>时长（分钟）</Text>
          <TextInput
            style={styles.input}
            placeholder="例如 30"
            value={durationMin}
            onChangeText={setDurationMin}
            keyboardType="numeric"
          />
        </Card>

        {/* 强度 */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>强度</Text>
          <View style={styles.intensityRow}>
            {(Object.keys(intensityMap) as Intensity[]).map((lv) => (
              <Pressable
                key={lv}
                style={[
                  styles.intensityBtn,
                  intensity === lv && { backgroundColor: theme.colors.accent },
                ]}
                onPress={() => setIntensity(lv)}
              >
                <Text
                  style={[
                    styles.intensityBtnText,
                    intensity === lv && { color: theme.colors.textInverse },
                  ]}
                >
                  {intensityMap[lv]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* 预估消耗 */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>预估消耗</Text>
          <View style={styles.burnedRow}>
            <Text style={styles.burnedNum}>{Math.round(calories)}</Text>
            <Text style={styles.burnedUnit}>kcal</Text>
          </View>
          <Text style={styles.burnedHint}>
            基于体重 {weightKg}kg × 运动时长 {duration}分钟 × 强度『{intensityMap[intensity]}』
          </Text>
        </Card>

        {/* 保存 */}
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>保存</Text>
        </Pressable>

        <Pressable style={styles.screenshotLink} onPress={() => router.push('/exercise/screenshot')}>
          <View style={styles.screenshotLinkInner}>
            <Camera size={16} color={theme.colors.primaryDark} style={styles.screenshotLinkIcon} />
            <Text style={styles.screenshotLinkText}>用运动截图识别 →</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    alignItems: 'center',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  section: { width: '100%', marginBottom: theme.spacing.md },
  sectionLabel: {
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  typeBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 70,
    alignItems: 'center',
  },
  typeBtnText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.medium,
  },
  metText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.xs,
    marginTop: 2,
  },
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
  intensityRow: { flexDirection: 'row', gap: theme.spacing.sm },
  intensityBtn: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  intensityBtnText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.medium,
  },
  burnedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginVertical: theme.spacing.sm,
  },
  burnedNum: {
    fontSize: theme.fontSizes.display,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.accent,
  },
  burnedUnit: {
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.xs,
  },
  burnedHint: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    marginTop: theme.spacing.xs,
  },
  saveBtn: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    width: '100%',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
  },
  screenshotLink: { marginTop: theme.spacing.md, paddingVertical: theme.spacing.sm, alignItems: 'center' },
  screenshotLinkInner: { flexDirection: 'row', alignItems: 'center' },
  screenshotLinkIcon: { marginRight: theme.spacing.xs },
  screenshotLinkText: { color: theme.colors.primaryDark, fontSize: theme.fontSizes.sm },
});
