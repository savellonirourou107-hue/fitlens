/**
 * (auth) 分组布局
 * 登录/注册页，headerShown false
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}