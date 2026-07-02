/**
 * AI 教练聊天页
 * - 消息列表 + 输入框
 * - 限速提示：今日还剩 X / 20
 * - 24h 后自动清空（后端负责）
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Animated, Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Send, Trash2, Sparkles } from 'lucide-react-native';
import { theme } from '../../theme';
import { useCoachStore } from '../../store/useCoachStore';
import { ThinkingDots } from '../../components/ThinkingDots';

export default function CoachScreen() {
  const messages = useCoachStore((s) => s.messages);
  const remaining = useCoachStore((s) => s.remaining);
  const limit = useCoachStore((s) => s.limit);
  const loading = useCoachStore((s) => s.loading);
  const error = useCoachStore((s) => s.error);
  const loadHistory = useCoachStore((s) => s.loadHistory);
  const sendMessage = useCoachStore((s) => s.sendMessage);
  const clearAll = useCoachStore((s) => s.clearAll);
  const clearError = useCoachStore((s) => s.clearError);

  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const inputBarBottomPad = Math.max(insets.bottom, 8);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    // 滚到最底
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
  };

  const onClear = () => {
    Alert.alert('清空对话', '24h 内的消息会全部清空，确定吗？', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => clearAll() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: '减脂教练', headerShown: true }} />
      <View style={styles.headerBanner}>
        <Sparkles size={16} color={theme.colors.primaryDark} />
        <Text style={styles.headerText}>
          小 F · 基于今日数据给建议 · 今日剩余 {remaining}/{limit}
        </Text>
        {messages.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8}>
            <Trash2 size={16} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {error && (
        <Pressable style={styles.errorBanner} onPress={clearError}>
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAi]}>
              <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
                {item.isThinking ? (
                  <ThinkingDots text="小 F 正在思考" />
                ) : (
                  <Text style={[styles.bubbleText, item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAi]}>
                    {item.content}
                  </Text>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Sparkles size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>问小 F 一个减脂问题</Text>
              <Text style={styles.emptyHint}>
                例子：{'\n'}· 我今天还能吃多少？{'\n'}· 怎么提高基础代谢？{'\n'}· 运动完饿了能吃什么？
              </Text>
            </View>
          }
        />

        <View style={[styles.inputBar, { paddingBottom: theme.spacing.md + inputBarBottomPad }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={remaining > 0 ? '输入消息…' : '今日次数已用完'}
            editable={remaining > 0 && loading !== 'sending'}
            multiline
            maxLength={500}
            onSubmitEditing={onSend}
            blurOnSubmit={false}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || remaining <= 0 || loading === 'sending') && styles.sendBtnDisabled]}
            disabled={!input.trim() || remaining <= 0 || loading === 'sending'}
            onPress={onSend}
          >
            {loading === 'sending' ? (
              <ActivityIndicator size="small" color={theme.colors.textInverse} />
            ) : (
              <Send size={20} color={theme.colors.textInverse} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBanner: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primarySoft, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerText: { flex: 1, fontSize: theme.fontSizes.sm, color: theme.colors.primaryDark, fontWeight: '600' },
  errorBanner: { backgroundColor: theme.colors.dangerSoft, padding: theme.spacing.sm, margin: theme.spacing.lg, borderRadius: theme.radius.md },
  errorText: { color: theme.colors.danger, fontSize: theme.fontSizes.sm },
  listContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.md, flexGrow: 1 },
  bubbleRow: { marginBottom: theme.spacing.md, flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAi: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', padding: theme.spacing.md, borderRadius: theme.radius.lg },
  bubbleUser: { backgroundColor: theme.colors.primary, borderBottomRightRadius: theme.radius.sm },
  bubbleAi: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderBottomLeftRadius: theme.radius.sm },
  bubbleText: { fontSize: theme.fontSizes.md, lineHeight: 22 },
  bubbleTextUser: { color: theme.colors.textInverse },
  bubbleTextAi: { color: theme.colors.text },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.sm },
  emptyTitle: { fontSize: theme.fontSizes.lg, fontWeight: '600', color: theme.colors.text, marginTop: theme.spacing.md },
  emptyHint: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 22, marginTop: theme.spacing.sm },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background, color: theme.colors.text, fontSize: theme.fontSizes.md,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: theme.colors.surfaceMuted },
});