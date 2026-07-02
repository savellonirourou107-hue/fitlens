/**
 * 好友今日数据卡：只渲染 4 个白名单数字（intake/burned/target/updatedAt）
 * + 头像 + 昵称
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { Avatar } from './Avatar';
import type { FriendToday } from '../api/friends';

interface Props {
  data: FriendToday;
}

export function FriendSummaryCard({ data }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar seed={data.avatarSeed} nickname={data.nickname} size={48} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{data.nickname}</Text>
          <Text style={styles.date}>今日 · {data.date}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <Stat label="今日摄入" value={Math.round(data.intakeKcal)} unit="kcal" color={theme.colors.primary} />
        <Stat label="今日消耗" value={Math.round(data.burnedKcal)} unit="kcal" color={theme.colors.accent} />
        <Stat label="目标" value={Math.round(data.targetKcal)} unit="kcal" color={theme.colors.secondary} />
      </View>

      <Text style={styles.footer}>
        {data.updatedAt
          ? `更新于 ${formatTime(data.updatedAt)}`
          : '今日还未上传数据'}
      </Text>
    </View>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  headerText: { flex: 1 },
  name: { fontSize: theme.fontSizes.lg, fontWeight: '700', color: theme.colors.text },
  date: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.xs },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  statValue: { fontSize: theme.fontSizes.xl, fontWeight: '700' },
  statUnit: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginLeft: 2 },
  footer: { marginTop: theme.spacing.md, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, textAlign: 'center' },
});