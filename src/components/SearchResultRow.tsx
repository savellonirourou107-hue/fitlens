/**
 * 搜索结果行：只显示昵称 + 头像（不显示对方邮箱）
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { Avatar } from './Avatar';
import { useFriendsStore } from '../store/useFriendsStore';

interface Props {
  userId: string;
  nickname: string;
  avatarSeed: string;
  /** 状态决定按钮文案 */
  status?: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self';
}

export function SearchResultRow(props: Props) {
  const sendRequest = useFriendsStore((s) => s.sendRequest);
  const [busy, setBusy] = useState(false);

  const cta = (() => {
    switch (props.status) {
      case 'pending_sent':
        return { label: '已发送', disabled: true };
      case 'pending_received':
        return { label: '待你接受', disabled: true };
      case 'accepted':
        return { label: '已是好友', disabled: true };
      case 'self':
        return { label: '自己', disabled: true };
      default:
        return { label: '加好友', disabled: false };
    }
  })();

  const onPress = async () => {
    if (cta.disabled || busy) return;
    setBusy(true);
    await sendRequest(props.userId);
    setBusy(false);
  };

  return (
    <View style={styles.row}>
      <Avatar seed={props.avatarSeed} nickname={props.nickname} size={44} />
      <View style={styles.textCol}>
        <Text style={styles.name}>{props.nickname}</Text>
      </View>
      <Pressable
        style={[styles.btn, cta.disabled && styles.btnDisabled]}
        disabled={cta.disabled || busy}
        onPress={onPress}
      >
        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.textInverse} />
        ) : (
          <Text style={[styles.btnText, cta.disabled && styles.btnTextDisabled]}>
            {cta.label}
          </Text>
        )}
      </Pressable>
    </View>
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
  btn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    minWidth: 80,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: theme.colors.surfaceMuted },
  btnText: { color: theme.colors.textInverse, fontWeight: '600', fontSize: theme.fontSizes.sm },
  btnTextDisabled: { color: theme.colors.textMuted },
});