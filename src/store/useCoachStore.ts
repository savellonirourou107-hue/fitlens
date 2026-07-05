/**
 * Coach chat store
 * - 24h 内消息历史（启动时拉一次）
 * - sendMessage: POST + 追加到 messages
 * - AI 教练为不限次数模式，兼容旧版 usage 字段但不按次数拦截
 */
import { create } from 'zustand';
import * as coachApi from '../api/coach';
import { ApiError, NetworkError } from '../api/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** 占位气泡：LLM 还没回复时显示思考动画 */
  isThinking?: boolean;
}

interface CoachState {
  messages: ChatMessage[];
  remaining: number | null;
  limit: number | null;
  unlimited: boolean;
  loading: 'idle' | 'sending' | 'history';
  error: string | null;

  loadHistory: () => Promise<void>;
  sendMessage: (text: string) => Promise<string | null>;
  clearAll: () => Promise<void>;
  clearError: () => void;
}

export const useCoachStore = create<CoachState>((set, get) => ({
  messages: [],
  remaining: null,
  limit: null,
  unlimited: true,
  loading: 'idle',
  error: null,

  async loadHistory() {
    set({ loading: 'history', error: null });
    try {
      const msgs = await coachApi.getHistory();
      let usage: coachApi.CoachUsage = {
        used: null,
        limit: null,
        remaining: null,
        unlimited: true,
      };
      try {
        usage = await coachApi.getUsage();
      } catch {
        // 兼容旧后端没有 /coach/usage 的情况：历史能加载即可，不再因为额度接口阻断聊天。
      }
      set({
        messages: msgs,
        remaining: usage.remaining ?? null,
        limit: usage.limit ?? null,
        unlimited: usage.unlimited ?? true,
        loading: 'idle',
      });
    } catch (e) {
      const msg = e instanceof NetworkError
        ? '教练暂时不可用'
        : e instanceof ApiError
        ? e.message
        : '加载失败';
      set({ error: msg, loading: 'idle' });
    }
  },

  async sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (get().loading === 'sending') return null;
    set({ error: null, loading: 'sending' });
    // 1) 立即追加用户消息
    const tempUserMsg: ChatMessage = {
      id: 'tmp-u-' + Date.now(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    // 2) 立即追加"小 F 正在思考"占位
    const thinkingMsg: ChatMessage = {
      id: 'tmp-t-' + Date.now(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isThinking: true,
    };
    set((s) => ({ messages: [...s.messages, tempUserMsg, thinkingMsg] }));
    try {
      const response = await coachApi.sendChat(trimmed);
      const { reply } = response;
      // 3) 替换占位为真实回复
      const assistantMsg: ChatMessage = {
        id: 'tmp-a-' + Date.now(),
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({
        messages: s.messages.map((m) => (m.id === thinkingMsg.id ? assistantMsg : m)),
        remaining: response.remaining ?? s.remaining,
        limit: response.limit ?? s.limit,
        unlimited: response.unlimited ?? s.unlimited,
        loading: 'idle',
      }));
      return reply;
    } catch (e) {
      // 失败时移除用户消息 + 占位
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== tempUserMsg.id && m.id !== thinkingMsg.id),
        loading: 'idle',
        error: e instanceof NetworkError
          ? '教练暂时不可用'
          : e instanceof ApiError
          ? e.message
          : '发送失败',
      }));
      return null;
    }
  },

  async clearAll() {
    try {
      await coachApi.clearHistory();
      set({ messages: [], error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '清空失败' });
    }
  },

  clearError() {
    set({ error: null });
  },
}));
