/**
 * 头像色块（用 avatar_seed 哈希出色块 + 文字首字）
 * 无图无外链，纯本地计算
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

const PALETTE = theme.colors.chart;

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface Props {
  seed: string;
  nickname: string;
  size?: number;
}

export function Avatar({ seed, nickname, size = 40 }: Props) {
  const bg = useMemo(() => PALETTE[hash(seed) % PALETTE.length], [seed]);
  const initial = (nickname || '?').slice(0, 1).toUpperCase();
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  text: { color: theme.colors.textInverse, fontWeight: '700' },
});