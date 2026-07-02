import { Tabs } from 'expo-router';
import { BookOpen, CalendarDays, CircleUser, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';

export default function TabsLayout() {
  // 拿系统底部安全区高度（Android 手势条/虚拟导航键 / iOS Home Indicator）
  const { bottom } = useSafeAreaInsets();
  // bottom 在没安全区的设备上是 0；保底留 8，避免紧贴边缘
  const tabPaddingBottom = bottom > 0 ? bottom : 8;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          // height 不再写死，让内容 + paddingBottom 撑开，避免和系统导航栏重叠
          paddingTop: 6,
          paddingBottom: tabPaddingBottom,
          height: 56 + tabPaddingBottom,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerShown: false,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '600' as const },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '今日',
          tabBarLabel: '今日',
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: '好友',
          tabBarLabel: '好友',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: '日记',
          tabBarLabel: '日记',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarLabel: '我的',
          tabBarIcon: ({ color, size }) => <CircleUser color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
