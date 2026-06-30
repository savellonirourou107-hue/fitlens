import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { useAppStore } from '../../store/useAppStore';
import { genId } from '../../core/id';
import { format, parseISO } from 'date-fns';
import { MOOD_LABELS, MOOD_EMOJI } from '../../types';
import type { Mood, DiaryEntry } from '../../types';

const MOODS: Mood[] = ['great', 'good', 'ok', 'bad', 'terrible'];

export default function DiaryScreen() {
  const diary = useAppStore((s) => s.getDiaryByDate(format(new Date(), 'yyyy-MM-dd')));
  const upsertDiary = useAppStore((s) => s.upsertDiary);
  const removeDiary = useAppStore((s) => s.removeDiary);

  const today = format(new Date(), 'yyyy-MM-dd');

  const [content, setContent] = useState('');
  const [mood, setMood] = useState<Mood | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 进入页面时预填今日已有日记
  useEffect(() => {
    if (diary) {
      setContent(diary.content);
      setMood(diary.mood);
      setEditingId(diary.id);
    }
  }, [diary]);

  const handleSave = () => {
    const text = content.trim();
    if (!text) {
      Alert.alert('提示', '请写下今天的感想');
      return;
    }
    const now = new Date().toISOString();
    const entry: DiaryEntry = {
      id: editingId ?? genId('diary_'),
      date: today,
      content: text,
      mood,
      createdAt: diary?.createdAt ?? now,
      updatedAt: now,
    };
    upsertDiary(entry);
    setEditingId(entry.id);
    Keyboard.dismiss();
    Alert.alert('已保存', '今日日记已记录');
  };

  const handleDelete = () => {
    if (!editingId) return;
    Alert.alert('删除日记', '确定删除今日日记吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          removeDiary(editingId);
          setContent('');
          setMood(undefined);
          setEditingId(null);
        },
      },
    ]);
  };

  const wordCount = content.length;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: '日记' }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 标题 */}
        <View style={styles.header}>
          <Text style={styles.title}>今日日记</Text>
          <Text style={styles.dateText}>{format(parseISO(today), 'M月d日 EEEE')}</Text>
        </View>

        {/* 心情 */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>今日心情</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <Pressable
                key={m}
                style={[styles.moodBtn, mood === m && styles.moodBtnActive]}
                onPress={() => setMood(mood === m ? undefined : m)}
              >
                <Text style={styles.moodEmoji}>{MOOD_EMOJI[m]}</Text>
                <Text
                  style={[styles.moodLabel, mood === m && styles.moodLabelActive]}
                >
                  {MOOD_LABELS[m]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* 感想输入 */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>感想 / 感悟 / 收获</Text>
          <TextInput
            style={styles.textArea}
            placeholder="今天感觉怎么样？有什么收获或想记录的…"
            placeholderTextColor={theme.colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.bottomRow}>
            <Text style={styles.wordCount}>{wordCount} 字</Text>
          </View>
        </Card>

        {/* 操作 */}
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{editingId ? '更新日记' : '保存日记'}</Text>
        </Pressable>

        {editingId ? (
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>删除今日日记</Text>
          </Pressable>
        ) : null}

        <Text style={styles.tipText}>
          记录减脂路上的小感悟，坚持下去 ✨
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
  header: { marginBottom: theme.spacing.lg },
  title: {
    fontSize: theme.fontSizes.xxl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.primaryDark,
  },
  dateText: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, marginTop: 2 },
  section: { width: '100%', marginBottom: theme.spacing.md },
  sectionLabel: {
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flex: 1,
    marginHorizontal: 2,
  },
  moodBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceMuted,
  },
  moodEmoji: { fontSize: 26 },
  moodLabel: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  moodLabelActive: { color: theme.colors.primaryDark, fontWeight: '600' },
  textArea: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
    lineHeight: 24,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.xs,
  },
  wordCount: { color: theme.colors.textMuted, fontSize: theme.fontSizes.xs },
  saveBtn: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    width: '100%',
  },
  saveBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
  },
  deleteBtn: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  deleteBtnText: { color: theme.colors.danger, fontSize: theme.fontSizes.sm },
  tipText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.xs,
    marginTop: theme.spacing.lg,
  },
});
