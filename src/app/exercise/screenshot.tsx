import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { useAppStore } from '../../store/useAppStore';
import { genId } from '../../core/id';
import { exerciseCalories } from '../../core/calc';
import { recognizeExerciseImage } from '../../api/client';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import type { ExerciseEntry, Intensity, ExerciseType } from '../../types';
import { EXERCISE_TYPES } from '../../types';

const EXERCISE_TYPE_LABELS_MAP: Partial<Record<ExerciseType, string>> = {};
for (const e of EXERCISE_TYPES) {
  EXERCISE_TYPE_LABELS_MAP[e.value] = e.label;
}

export default function ExerciseScreenshotScreen() {
  const addExercise = useAppStore((s) => s.addExercise);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognized, setRecognized] = useState<{
    type: ExerciseType;
    durationMin: number;
    caloriesBurnedKcal: number;
    source?: string;
    rawText?: string;
  } | null>(null);

  const handlePickImage = async (useCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
    };
    const result =
      useCamera === true
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setRecognized(null);
    }
  };

  /** 调后端 AI 识别运动截图字段 */
  const handleRecognize = async () => {
    if (!imageUri) {
      Alert.alert('提示', '请先选择运动软件截图');
      return;
    }
    setRecognizing(true);
    try {
      const data = await recognizeExerciseImage(imageUri);
      setRecognized({
        type: data.type,
        durationMin: data.durationMin,
        caloriesBurnedKcal: data.caloriesBurnedKcal,
        source: data.source,
        rawText: data.rawText,
      });
    } catch (e) {
      Alert.alert('识别失败', e instanceof Error ? e.message : '未知错误');
    } finally {
      setRecognizing(false);
    }
  };

  const handleSave = () => {
    if (!recognized) {
      Alert.alert('提示', '请先识别截图');
      return;
    }
    if (recognized.caloriesBurnedKcal <= 0 && recognized.durationMin <= 0) {
      Alert.alert('提示', '识别结果无效，请手动修正');
      return;
    }
    // 若识别到时长但无消耗，按模型 MET 估算补全
    let burned = recognized.caloriesBurnedKcal;
    const weightKg = useAppStore.getState().profile?.weightKg ?? 65;
    if (burned <= 0 && recognized.durationMin > 0) {
      burned = exerciseCalories(recognized.type, recognized.durationMin, weightKg, 'moderate');
    }
    const entry: ExerciseEntry = {
      id: genId('ex_'),
      date: format(new Date(), 'yyyy-MM-dd'),
      type: recognized.type,
      durationMin: recognized.durationMin,
      intensity: 'moderate',
      caloriesBurnedKcal: burned,
      createdAt: new Date().toISOString(),
    };
    addExercise(entry);
    Alert.alert('已保存', `已记录运动，消耗 ${burned} kcal`, [
      { text: '好的', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: '运动截图识别' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 截图选择 */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>运动软件截图</Text>
          <Text style={styles.sectionHint}>支持 Keep、喜忌、华为运动健康等截图</Text>
          <View style={styles.imageRow}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={[styles.thumbnail, styles.placeholder]}>
                <Text style={styles.placeholderText}>选择截图</Text>
              </View>
            )}
            <View style={styles.imageBtns}>
              <Pressable style={styles.imageBtn} onPress={() => handlePickImage(true)}>
                <Text style={styles.imageBtnText}>拍照</Text>
              </Pressable>
              <Pressable style={styles.imageBtn} onPress={() => handlePickImage(false)}>
                <Text style={styles.imageBtnText}>相册</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            style={[styles.aiBtn, recognizing && styles.aiBtnDisabled]}
            disabled={recognizing}
            onPress={handleRecognize}
          >
            {recognizing ? (
              <View style={styles.aiBtnContent}>
                <ActivityIndicator color={theme.colors.textInverse} size="small" />
                <Text style={styles.aiBtnText}>AI 识别中…</Text>
              </View>
            ) : (
              <Text style={styles.aiBtnText}>✨ AI 识别截图字段</Text>
            )}
          </Pressable>
        </Card>

        {/* 识别结果 */}
        {recognized && (
          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>识别结果（可手动修正）</Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>运动类型</Text>
              <Text style={styles.resultValue}>
                {EXERCISE_TYPE_LABELS_MAP[recognized.type] ?? recognized.type}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>时长</Text>
              <Text style={styles.resultValue}>{recognized.durationMin} 分钟</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>消耗</Text>
              <Text style={[styles.resultValue, { color: theme.colors.accent }]}>
                {recognized.caloriesBurnedKcal} kcal
              </Text>
            </View>
            {recognized.source ? (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>来源</Text>
                <Text style={styles.resultValue}>{recognized.source}</Text>
              </View>
            ) : null}
            {recognized.rawText ? (
              <View style={styles.rawBox}>
                <Text style={styles.rawLabel}>截图识别原文：</Text>
                <Text style={styles.rawText}>{recognized.rawText}</Text>
              </View>
            ) : null}
            <Text style={styles.tipText}>结果可手动修正，保存即记录今日运动。</Text>
          </Card>
        )}

        {/* 保存 */}
        <Pressable
          style={[styles.saveBtn, !recognized && styles.saveBtnDisabled]}
          disabled={!recognized}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>保存运动记录</Text>
        </Pressable>

        <Pressable style={styles.manualLink} onPress={() => router.push('/exercise/add')}>
          <Text style={styles.manualLinkText}>改为手动记录运动 →</Text>
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
    marginBottom: theme.spacing.xs,
  },
  sectionHint: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  thumbnail: {
    width: 90,
    height: 120,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
  },
  placeholder: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
  imageBtns: { flexDirection: 'row', gap: theme.spacing.sm, flex: 1, flexWrap: 'wrap' },
  imageBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  imageBtnText: { color: theme.colors.text, fontSize: theme.fontSizes.sm },
  aiBtn: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    width: '100%',
  },
  aiBtnDisabled: { opacity: 0.6 },
  aiBtnContent: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  aiBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  resultLabel: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm },
  resultValue: { color: theme.colors.text, fontSize: theme.fontSizes.md, fontWeight: '600' },
  rawBox: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
  },
  rawLabel: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginBottom: 4 },
  rawText: { fontSize: theme.fontSizes.xs, color: theme.colors.text },
  tipText: { marginTop: theme.spacing.sm, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
  saveBtn: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    width: '100%',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
  },
  manualLink: { marginTop: theme.spacing.md, paddingVertical: theme.spacing.sm, alignItems: 'center' },
  manualLinkText: { color: theme.colors.primaryDark, fontSize: theme.fontSizes.sm },
});
