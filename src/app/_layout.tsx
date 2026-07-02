import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { theme } from '../theme';
import { useAppStore } from '../store/useAppStore';
import { initDb } from '../core/db';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      try {
        await initDb();
        await useAppStore.getState().hydrateFromDb();
      } catch (e) {
        console.error('db init or hydrate failed', e);
        // hydrateFromDb 内部已设置 hydrateError 并保持 hydrated:false，
        // 这里不再强行标记为已 hydrate，让 UI 能显示重试提示
      }
    })();
  }, []);

  return (
    <ErrorBoundary>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: '600' as const },
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="meal/add" options={{ title: '记录餐食' }} />
        <Stack.Screen name="exercise/add" options={{ title: '记录运动' }} />
        <Stack.Screen name="exercise/screenshot" options={{ title: '运动截图识别' }} />
        <Stack.Screen name="trend" options={{ title: '7 日趋势' }} />
      </Stack>
    </ErrorBoundary>
  );
}
