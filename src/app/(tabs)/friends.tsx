/**
 * 好友 Tab
 * - 好友列表
 * - 顶部入口：搜索 / 收到请求
 * - 空状态：去搜索
 */
import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, Link } from 'expo-router';
import { Search, UserPlus, Inbox } from 'lucide-react-native';
import { theme } from '../../theme';
import { FriendCard } from '../../components/FriendCard';
import { useFriendsStore } from '../../store/useFriendsStore';

export default function FriendsTab() {
  const list = useFriendsStore((s) => s.list);
  const requests = useFriendsStore((s) => s.requests);
  const loading = useFriendsStore((s) => s.loading);
  const error = useFriendsStore((s) => s.error);
  const loadList = useFriendsStore((s) => s.loadList);
  const loadRequests = useFriendsStore((s) => s.loadRequests);

  const refresh = useCallback(async () => {
    await Promise.all([loadList(), loadRequests()]);
  }, [loadList, loadRequests]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const incomingCount = requests.incoming.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: '好友', headerShown: true }} />
      <View style={styles.headerRow}>
        <Text style={styles.title}>好友</Text>
        <View style={styles.headerActions}>
          <Link href="/friend/requests" asChild>
            <Pressable style={styles.iconBtn} accessibilityLabel="好友请求">
              <Inbox size={18} color={theme.colors.text} />
              {incomingCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{incomingCount > 9 ? '9+' : incomingCount}</Text>
                </View>
              )}
            </Pressable>
          </Link>
          <Link href="/friend/search" asChild>
            <Pressable style={styles.iconBtn} accessibilityLabel="搜索好友">
              <Search size={18} color={theme.colors.text} />
            </Pressable>
          </Link>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={list}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        renderItem={({ item }) => (
          <FriendCard userId={item.userId} nickname={item.nickname} avatarSeed={item.avatarSeed} />
        )}
        refreshControl={<RefreshControl refreshing={loading === 'list'} onRefresh={refresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          loading === 'list' ? (
            <View style={styles.empty}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <UserPlus size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>还没有好友</Text>
              <Text style={styles.emptyHint}>通过邮箱搜索添加第一个好友</Text>
              <Link href="/friend/search" asChild>
                <Pressable style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnText}>去搜索</Text>
                </Pressable>
              </Link>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
  },
  title: { fontSize: theme.fontSizes.xxl, fontWeight: '700', color: theme.colors.text },
  headerActions: { flexDirection: 'row', gap: theme.spacing.sm },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: theme.colors.danger, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: theme.colors.textInverse, fontSize: 10, fontWeight: '700' },
  errorBanner: {
    backgroundColor: theme.colors.dangerSoft, paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  errorText: { color: theme.colors.danger, fontSize: theme.fontSizes.sm },
  listContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingTop: theme.spacing.xxl },
  emptyTitle: { fontSize: theme.fontSizes.lg, fontWeight: '600', color: theme.colors.text, marginTop: theme.spacing.md },
  emptyHint: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
  emptyBtn: { marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.sm, backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill },
  emptyBtnText: { color: theme.colors.textInverse, fontWeight: '600' },
});