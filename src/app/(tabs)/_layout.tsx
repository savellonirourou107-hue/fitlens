import { Tabs } from 'expo-router';
import { theme } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '600' as const },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '今日', tabBarLabel: '今日' }} />
      <Tabs.Screen name="diary" options={{ title: '日记', tabBarLabel: '日记' }} />
      <Tabs.Screen name="profile" options={{ title: '我的', tabBarLabel: '我的' }} />
    </Tabs>
  );
}
