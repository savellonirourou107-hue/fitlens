import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { initDb } from '../core/db';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  // 1) 启动时初始化 DB + hydrate 本地数据
  useEffect(() => {
    (async () => {
      try {
        await initDb();
        await useAppStore.getState().hydrateFromDb();
      } catch (e) {
        console.error('db init or hydrate failed', e);
      }
    })();
  }, []);

  // 2) 启动时 hydrate auth (从 SecureStore 读 token，调 /auth/me)
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // 3) 路由守卫：未登录跳 (auth)/login，已登录在 (auth) 分组则跳 (tabs)
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s.hydrated);
  useEffect(() => {
    if (!authHydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!authUser && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (authUser && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [authHydrated, authUser, segments, router]);

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTintColor: theme.colors.text,
            headerTitleStyle: { fontWeight: '600' as const },
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="meal/add" options={{ title: '记录餐食' }} />
          <Stack.Screen name="exercise/add" options={{ title: '记录运动' }} />
          <Stack.Screen name="exercise/screenshot" options={{ title: '运动截图识别' }} />
          <Stack.Screen name="trend" options={{ title: '7 日趋势' }} />
          <Stack.Screen name="friend/search" options={{ headerShown: false }} />
          <Stack.Screen name="friend/requests" options={{ headerShown: false }} />
          <Stack.Screen name="friend/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="settings/account" options={{ headerShown: false }} />
        </Stack>

        {/* 冷启动 banner：服务器启动中 */}
        {authHydrated && authStatus === 'offline' && (
          <View style={styles.offlineBanner} pointerEvents="none">
            <Text style={styles.offlineText}>服务器启动中，已保留本地数据</Text>
          </View>
        )}
        {!authHydrated && (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>正在加载…</Text>
          </View>
        )}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: theme.colors.warning + 'CC',
    paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  offlineText: { color: theme.colors.text, fontSize: theme.fontSizes.xs, fontWeight: '600' },
  loading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: theme.colors.background,
    alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm,
  },
  loadingText: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm },
});