/**
 * 全局错误边界：捕获 React 渲染期错误，显示友好的中文错误界面并提供重启按钮。
 * 使用 React 标准 class 组件实现。
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { theme } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[FitLens] ErrorBoundary caught:', error, info?.componentStack);
  }

  /** 重置错误状态并让组件树重新渲染。 */
  private handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const err = this.state.error;

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          bounces={false}
        >
          <Text style={styles.emoji}>😵</Text>
          <Text style={styles.title}>应用出了点问题</Text>
          <Text style={styles.subtitle}>
            很抱歉，遇到了一个意外错误。你可以尝试重启应用继续使用。
          </Text>

          {err && (
            <View style={styles.detailBox}>
              <Text style={styles.detailText} numberOfLines={8}>
                {err.message || String(err)}
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={this.handleRestart}
            accessibilityRole="button"
            accessibilityLabel="重启应用"
          >
            <Text style={styles.buttonText}>重启应用</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emoji: {
    fontSize: theme.fontSizes.display,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.bold as unknown as '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  detailBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  detailText: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.danger,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.pill,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold as unknown as '600',
  },
});

export default ErrorBoundary;
