/**
 * 好友请求页
 * - 收到的请求（incoming）：接受/拒绝
 * - 发出的请求（outgoing）：只读状态
 */
import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { theme } from '../../theme';
import { RequestRow } from '../../components/RequestRow';
import { useFriendsStore } from '../../store/useFriendsStore';

export default function FriendRequestsScreen() {
  const requests = useFriendsStore((s) => s.requests);
  const loading = useFriendsStore((s) => s.loading);
  const error = useFriendsStore((s) => s.error);
  const loadRequests = useFriendsStore((s) => s.loadRequests);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: '好友请求', headerShown: true }} />
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading === 'requests'} onRefresh={loadRequests} tintColor={theme.colors.primary} />
        }
      >
        <Text style={styles.sectionTitle}>收到的请求</Text>
        {loading === 'requests' && requests.incoming.length === 0 ? (
          <View style={styles.empty}><ActivityIndicator color={theme.colors.primary} /></View>
        ) : requests.incoming.length === 0 ? (
          <Text style={styles.emptyText}>暂无收到的请求</Text>
        ) : (
          <View style={styles.list}>
            {requests.incoming.map((r) => (
              <RequestRow key={r.friendshipId} request={r} direction="incoming" />
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: theme.spacing.xl }]}>发出的请求</Text>
        {requests.outgoing.length === 0 ? (
          <Text style={styles.emptyText}>暂无发出的请求</Text>
        ) : (
          <View style={styles.list}>
            {requests.outgoing.map((r) => (
              <RequestRow key={r.friendshipId} request={r} direction="outgoing" />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, maxWidth: 600, width: '100%', alignSelf: 'center' },
  errorBanner: { backgroundColor: theme.colors.dangerSoft, padding: theme.spacing.sm, margin: theme.spacing.lg, borderRadius: theme.radius.md },
  errorText: { color: theme.colors.danger, fontSize: theme.fontSizes.sm },
  sectionTitle: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.md },
  list: { gap: theme.spacing.sm },
  empty: { paddingVertical: theme.spacing.xl, alignItems: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, paddingVertical: theme.spacing.md },
});