/**
 * 账号设置
 * - 退出登录（清 token，本地数据保留）
 * - 删除账号（调 DELETE /auth/me，级联删服务端数据，本地数据保留）
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { LogOut, Trash2 } from 'lucide-react-native';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/useAuthStore';
import { ApiError, NetworkError } from '../../api/client';

export default function AccountSettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const [busy, setBusy] = useState<'logout' | 'delete' | null>(null);

  const onLogout = () => {
    Alert.alert('退出登录', '本地数据会保留。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          setBusy('logout');
          await logout();
          setBusy(null);
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const onDelete = () => {
    Alert.alert(
      '删除账号',
      '将永久删除云端账号和好友关系。本地记录可单独在「清空本地数据」里删除。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认删除',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await deleteAccount();
              router.replace('/(auth)/login');
            } catch (e) {
              const msg =
                e instanceof NetworkError
                  ? '服务器启动中，请稍后再试'
                  : e instanceof ApiError
                  ? e.message
                  : '删除失败';
              Alert.alert('删除失败', msg);
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: '账号', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.label}>当前账号</Text>
          <Text style={styles.value}>{user?.nickname}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <Pressable
          style={[styles.action, busy === 'logout' && styles.actionDisabled]}
          disabled={!!busy}
          onPress={onLogout}
        >
          {busy === 'logout' ? (
            <ActivityIndicator color={theme.colors.text} />
          ) : (
            <>
              <LogOut size={20} color={theme.colors.text} />
              <Text style={styles.actionText}>退出登录</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.action, styles.dangerAction, busy === 'delete' && styles.actionDisabled]}
          disabled={!!busy}
          onPress={onDelete}
        >
          {busy === 'delete' ? (
            <ActivityIndicator color={theme.colors.danger} />
          ) : (
            <>
              <Trash2 size={20} color={theme.colors.danger} />
              <Text style={[styles.actionText, styles.dangerText]}>删除账号</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.footHint}>
          退出登录仅清空登录状态，云端数据保留；删除账号会清除云端数据并解除所有好友关系。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md, maxWidth: 600, width: '100%', alignSelf: 'center' },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  label: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.xs },
  value: { fontSize: theme.fontSizes.lg, fontWeight: '600', color: theme.colors.text },
  email: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    padding: theme.spacing.lg, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border,
  },
  actionDisabled: { opacity: 0.5 },
  actionText: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text },
  dangerAction: { borderColor: theme.colors.dangerSoft },
  dangerText: { color: theme.colors.danger },
  footHint: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.md, lineHeight: 18 },
});