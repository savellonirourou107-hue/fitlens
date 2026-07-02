/**
 * 好友请求行：显示头像 + 昵称 + 接受/拒绝按钮（incoming） / 状态文字（outgoing）
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { Avatar } from './Avatar';
import { useFriendsStore } from '../store/useFriendsStore';
import type { FriendRequest } from '../api/friends';

interface Props {
  request: FriendRequest;
  direction: 'incoming' | 'outgoing';
}

export function RequestRow({ request, direction }: Props) {
  const accept = useFriendsStore((s) => s.accept);
  const reject = useFriendsStore((s) => s.reject);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);

  const onAccept = async () => {
    if (busy) return;
    setBusy('accept');
    await accept(request.friendshipId);
    setBusy(null);
  };
  const onReject = async () => {
    if (busy) return;
    setBusy('reject');
    await reject(request.friendshipId);
    setBusy(null);
  };

  return (
    <View style={styles.row}>
      <Avatar seed={request.avatarSeed} nickname={request.nickname} size={44} />
      <View style={styles.textCol}>
        <Text style={styles.name}>{request.nickname}</Text>
        <Text style={styles.hint}>
          {direction === 'incoming' ? '请求加你为好友' : '已发送，等待对方接受'}
        </Text>
      </View>
      {direction === 'incoming' ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, busy === 'accept' && styles.btnDisabled]}
            disabled={!!busy}
            onPress={onAccept}
          >
            {busy === 'accept' ? (
              <ActivityIndicator size="small" color={theme.colors.textInverse} />
            ) : (
              <Text style={styles.btnText}>接受</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnGhost, busy === 'reject' && styles.btnDisabled]}
            disabled={!!busy}
            onPress={onReject}
          >
            <Text style={[styles.btnText, styles.btnTextGhost]}>拒绝</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.pendingTag}>待处理</Text>
      )}
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
  hint: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: theme.spacing.xs },
  btn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    minWidth: 64,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnGhost: { backgroundColor: theme.colors.surfaceMuted },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: theme.colors.textInverse, fontWeight: '600', fontSize: theme.fontSizes.sm },
  btnTextGhost: { color: theme.colors.text },
  pendingTag: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.sm,
  },
});