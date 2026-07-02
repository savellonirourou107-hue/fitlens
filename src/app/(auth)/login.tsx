/**
 * 登录页
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/useAuthStore';
import { ApiError, NetworkError } from '../../api/client';

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('提示', '请填写邮箱和密码');
      return;
    }
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (e) {
      const msg =
        e instanceof NetworkError
          ? '服务器启动中，请稍后再试'
          : e instanceof ApiError
          ? e.message
          : '登录失败';
      Alert.alert('登录失败', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>FitLens</Text>
            <Text style={styles.subtitle}>登录后开始记录</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>邮箱</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              editable={!busy}
            />

            <Text style={styles.label}>密码</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="至少 8 位"
              editable={!busy}
            />

            <Pressable
              style={[styles.submit, busy && styles.submitDisabled]}
              disabled={busy}
              onPress={onSubmit}
            >
              {busy ? <ActivityIndicator color={theme.colors.textInverse} /> : <Text style={styles.submitText}>登录</Text>}
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>还没有账号？</Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text style={styles.link}>立即注册</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  header: { marginBottom: theme.spacing.xl, marginTop: theme.spacing.xl },
  title: { fontSize: theme.fontSizes.display, fontWeight: '700', color: theme.colors.primaryDark },
  subtitle: { fontSize: theme.fontSizes.md, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
  form: { gap: theme.spacing.sm },
  label: { fontSize: theme.fontSizes.sm, fontWeight: '600', color: theme.colors.text, marginTop: theme.spacing.md },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: theme.spacing.md, backgroundColor: theme.colors.surface, color: theme.colors.text,
    fontSize: theme.fontSizes.md,
  },
  submit: {
    marginTop: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary, alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: theme.colors.textInverse, fontWeight: '700', fontSize: theme.fontSizes.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.lg },
  footerText: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm },
  link: { color: theme.colors.primaryDark, fontSize: theme.fontSizes.sm, fontWeight: '600' },
});