/**
 * Friends store
 * - 好友列表 / 待处理请求 / 今日数字（只读白名单字段）
 * - 不缓存 meal/exercise/diary 明细
 * - 网络错误给 UI 友好提示（"好友动态暂时不可用"）
 */
import { create } from 'zustand';
import * as friendsApi from '../api/friends';
import { ApiError, NetworkError, AuthError } from '../api/client';
import type { FriendRef, FriendRequest, FriendToday, FriendRequestsResponse } from '../api/friends';

interface FriendsState {
  list: FriendRef[];
  requests: FriendRequestsResponse;
  /** 临时缓存：每个 userId 的今日数字（防止短时间内重复请求） */
  todayCache: Record<string, FriendToday>;
  loading: 'idle' | 'list' | 'requests' | 'search' | 'detail';
  error: string | null;

  loadList: () => Promise<void>;
  loadRequests: () => Promise<void>;
  searchByEmail: (email: string) => Promise<FriendRef | null>;
  sendRequest: (targetUserId: string) => Promise<boolean>;
  accept: (friendshipId: string) => Promise<boolean>;
  reject: (friendshipId: string) => Promise<boolean>;
  loadToday: (userId: string) => Promise<FriendToday | null>;
  clearError: () => void;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  list: [],
  requests: { incoming: [], outgoing: [] },
  todayCache: {},
  loading: 'idle',
  error: null,

  async loadList() {
    set({ loading: 'list', error: null });
    try {
      const list = await friendsApi.getFriends();
      set({ list, loading: 'idle' });
    } catch (e) {
      const msg = friendlyError(e);
      set({ error: msg, loading: 'idle' });
    }
  },

  async loadRequests() {
    set({ loading: 'requests', error: null });
    try {
      const requests = await friendsApi.getRequests();
      set({ requests, loading: 'idle' });
    } catch (e) {
      set({ error: friendlyError(e), loading: 'idle' });
    }
  },

  async searchByEmail(email) {
    set({ loading: 'search', error: null });
    try {
      const ref = await friendsApi.searchFriendByEmail(email);
      set({ loading: 'idle' });
      return ref;
    } catch (e) {
      const msg = friendlyError(e);
      set({ error: msg, loading: 'idle' });
      return null;
    }
  },

  async sendRequest(targetUserId) {
    set({ error: null });
    try {
      await friendsApi.sendFriendRequest(targetUserId);
      // 重新拉取请求列表（outgoing 更新）
      await get().loadRequests();
      return true;
    } catch (e) {
      set({ error: friendlyError(e) });
      return false;
    }
  },

  async accept(friendshipId) {
    set({ error: null });
    try {
      await friendsApi.acceptFriendRequest(friendshipId);
      await get().loadRequests();
      await get().loadList();
      return true;
    } catch (e) {
      set({ error: friendlyError(e) });
      return false;
    }
  },

  async reject(friendshipId) {
    set({ error: null });
    try {
      await friendsApi.rejectFriendRequest(friendshipId);
      await get().loadRequests();
      return true;
    } catch (e) {
      set({ error: friendlyError(e) });
      return false;
    }
  },

  async loadToday(userId) {
    // 1 分钟内不重复拉
    const cached = get().todayCache[userId];
    if (cached && Date.now() - new Date(cached.updatedAt || 0).getTime() < 60_000) {
      return cached;
    }
    set({ loading: 'detail', error: null });
    try {
      const today = await friendsApi.getFriendToday(userId);
      set((s) => ({ todayCache: { ...s.todayCache, [userId]: today }, loading: 'idle' }));
      return today;
    } catch (e) {
      set({ error: friendlyError(e), loading: 'idle' });
      return null;
    }
  },

  clearError() {
    set({ error: null });
  },
}));

function friendlyError(e: unknown): string {
  if (e instanceof NetworkError) return '好友动态暂时不可用';
  if (e instanceof AuthError) return '登录已过期，请重新登录';
  if (e instanceof ApiError) return e.message;
  return '操作失败，请稍后重试';
}