/**
 * Auth store
 * - token / 当前用户 / 启动时自动 hydrate（从 SecureStore 读 token + 调 /auth/me）
 * - 401 时自动清 token
 * - 服务端不可达时 token 保留，本地功能继续
 */
import { create } from 'zustand';
import * as authApi from '../api/auth';
import { getToken, setToken, clearToken, getCachedUser, setCachedUser } from '../storage/secureStore';
import { ApiError, NetworkError } from '../api/client';

export interface CurrentUser {
  id: string;
  email: string;
  nickname: string;
  avatarSeed: string;
}

interface AuthState {
  user: CurrentUser | null;
  /** true 表示已尝试 /auth/me 至少一次（不论成功失败） */
  hydrated: boolean;
  /** 'idle' 初始；'connecting' 启动中；'connected' 登录成功；'offline' 服务端不可达（保留 token 走本地） */
  status: 'idle' | 'connecting' | 'connected' | 'offline';
  lastError: string | null;

  /** 启动时调用：读 token + 拉 /auth/me */
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,
  status: 'idle',
  lastError: null,

  async hydrate() {
    set({ status: 'connecting', lastError: null });
    const token = await getToken();
    if (!token) {
      set({ user: null, hydrated: true, status: 'idle' });
      return;
    }
    // 先用缓存用户快速渲染（避免冷启动白屏）
    const cached = await getCachedUser();
    if (cached) set({ user: cached });
    try {
      const me = await authApi.me();
      const user: CurrentUser = {
        id: me.id,
        email: me.email,
        nickname: me.nickname,
        avatarSeed: me.avatarSeed,
      };
      await setCachedUser(user);
      set({ user, status: 'connected', hydrated: true, lastError: null });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // token 失效
        await clearToken();
        set({ user: null, status: 'idle', hydrated: true, lastError: '登录已过期，请重新登录' });
        return;
      }
      if (e instanceof NetworkError) {
        // 离线：保留 token，UI 进入 offline 模式，本地功能继续
        set({ status: 'offline', hydrated: true });
        return;
      }
      set({ status: 'offline', hydrated: true, lastError: e instanceof Error ? e.message : '未知错误' });
    }
  },

  async login(email, password) {
    set({ lastError: null });
    const res = await authApi.login({ email, password });
    await setToken(res.token);
    await setCachedUser(res.user);
    set({ user: res.user, status: 'connected', hydrated: true });
  },

  async register(email, password, nickname) {
    set({ lastError: null });
    const res = await authApi.register({ email, password, nickname });
    await setToken(res.token);
    await setCachedUser(res.user);
    set({ user: res.user, status: 'connected', hydrated: true });
  },

  async logout() {
    await clearToken();
    set({ user: null, status: 'idle', hydrated: true, lastError: null });
  },

  async deleteAccount() {
    await authApi.deleteMe();
    await clearToken();
    set({ user: null, status: 'idle', hydrated: true });
  },

  clearError() {
    set({ lastError: null });
  },
}));