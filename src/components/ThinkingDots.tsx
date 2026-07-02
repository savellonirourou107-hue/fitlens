/**
 * 等待/思考动画（仿 claude.ai）
 * - 三个点循环渐变：opacity 0.3 → 1 → 0.3
 * - 错开 0.15s
 * - 总周期 1.4s
 * - 纯 RN Animated，不引入依赖
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

interface Props {
  text?: string;  // 可选前缀文案，如"小 F 正在思考"
}

export function ThinkingDots({ text = '小 F 正在思考' }: Props) {
  // 三个点独立的 opacity 动画
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makeLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0.3,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    const a = makeLoop(dot1, 0);
    const b = makeLoop(dot2, 150);
    const c = makeLoop(dot3, 300);
    a.start(); b.start(); c.start();
    return () => { a.stop(); b.stop(); c.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.row}>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.dots}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  text: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: theme.colors.textMuted,
  },
});