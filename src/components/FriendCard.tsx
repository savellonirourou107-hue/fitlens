/**
 * 好友列表项：头像 + 昵称 + "查看今日" 按钮
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../theme';
import { Avatar } from './Avatar';

interface Props {
  userId: string;
  nickname: string;
  avatarSeed: string;
}

export function FriendCard({ userId, nickname, avatarSeed }: Props) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/friend/${userId}` as any)}
    >
      <Avatar seed={avatarSeed} nickname={nickname} size={44} />
      <View style={styles.textCol}>
        <Text style={styles.name}>{nickname}</Text>
        <Text style={styles.hint}>点击查看今日数据</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textCol: { flex: 1 },
  name: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text },
  hint: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 24, color: theme.colors.textMuted },
});