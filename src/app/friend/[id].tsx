/**
 * 好友详情页（/friend/[id]）
 * - 拉取 /friends/:id/today
 * - 只渲染白名单字段（intake/burned/target/updatedAt）
 * - 不暴露任何 meal/exercise/diary 明细
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../../theme';
import { FriendSummaryCard } from '../../components/FriendSummaryCard';
import { useFriendsStore } from '../../store/useFriendsStore';
import type { FriendToday } from '../../api/friends';

export default function FriendDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const todayCache = useFriendsStore((s) => s.todayCache);
  const loadToday = useFriendsStore((s) => s.loadToday);
  const error = useFriendsStore((s) => s.error);
  const [data, setData] = useState<FriendToday | null>(id ? todayCache[id] ?? null : null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const r = await loadToday(id);
    if (r) setData(r);
    setLoading(false);
  }, [id, loadToday]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: '好友详情', headerShown: true }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.primary} />}
      >
        {data ? (
          <FriendSummaryCard data={data} />
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={refresh}>
              <Text style={styles.retryBtnText}>重试</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.empty}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}

        {/* 隐私说明 */}
        <View style={styles.privacy}>
          <Text style={styles.privacyText}>
            FitLens 好友系统只共享今日摄入/消耗/目标三个数字，不暴露吃了什么、体重、BMI 等敏感信息。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, maxWidth: 600, width: '100%', alignSelf: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing.xxl, gap: theme.spacing.md },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm },
  retryBtn: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill },
  retryBtnText: { color: theme.colors.textInverse, fontWeight: '600' },
  privacy: { marginTop: theme.spacing.lg, padding: theme.spacing.md, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md },
  privacyText: { color: theme.colors.textMuted, fontSize: theme.fontSizes.xs, lineHeight: 18 },
});