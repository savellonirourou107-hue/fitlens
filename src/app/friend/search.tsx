/**
 * 好友搜索页
 * - 输入完整邮箱精确搜索
 * - 搜索结果只显示昵称 + 头像 + "加好友"按钮
 * - 不显示对方邮箱
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { theme } from '../../theme';
import { SearchResultRow } from '../../components/SearchResultRow';
import { useFriendsStore } from '../../store/useFriendsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { ApiError, NetworkError, AuthError } from '../../api/client';

export default function FriendSearchScreen() {
  const searchByEmail = useFriendsStore((s) => s.searchByEmail);
  const loading = useFriendsStore((s) => s.loading);
  const error = useFriendsStore((s) => s.error);
  const me = useAuthStore((s) => s.user);
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ userId: string; nickname: string; avatarSeed: string } | null>(null);
  const [touched, setTouched] = useState(false);

  const onSearch = async () => {
    if (!email.includes('@')) {
      Alert.alert('提示', '请输入完整邮箱，例如 you@example.com');
      return;
    }
    setTouched(true);
    setResult(null);
    try {
      const r = await searchByEmail(email.trim().toLowerCase());
      if (r) setResult(r);
    } catch (e) {
      // store 里已经 set error；404 不需要额外处理
    }
  };

  const status = (() => {
    if (!result) return undefined;
    if (me && result.userId === me.id) return 'self' as const;
    // 简化：如果 store 里已有这个 userId 在 outgoing/incoming 列表里，可标记
    return 'none' as const;
  })();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: '搜索好友', headerShown: true }} />
      <View style={styles.searchBar}>
        <Search size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="输入完整邮箱"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        {email.length > 0 && (
          <Pressable onPress={() => setEmail('')} hitSlop={8}>
            <X size={18} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      <Pressable
        style={[styles.searchBtn, loading === 'search' && styles.searchBtnDisabled]}
        onPress={onSearch}
        disabled={loading === 'search'}
      >
        {loading === 'search' ? (
          <ActivityIndicator color={theme.colors.textInverse} />
        ) : (
          <Text style={styles.searchBtnText}>搜索</Text>
        )}
      </Pressable>

      {touched && error && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      )}

      {touched && !error && !result && loading !== 'search' && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>未找到该邮箱对应的用户</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultWrap}>
          <Text style={styles.sectionHint}>搜索结果</Text>
          <SearchResultRow
            userId={result.userId}
            nickname={result.nickname}
            avatarSeed={result.avatarSeed}
            status={status}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    margin: theme.spacing.lg, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  input: { flex: 1, fontSize: theme.fontSizes.md, color: theme.colors.text },
  searchBtn: {
    marginHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: theme.colors.textInverse, fontWeight: '600' },
  notice: { paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.md },
  noticeText: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm },
  resultWrap: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  sectionHint: { color: theme.colors.textMuted, fontSize: theme.fontSizes.xs, marginBottom: theme.spacing.xs },
});