/**
 * Coach chat store
 * - 24h 内消息历史（启动时拉一次）
 * - sendMessage: POST + 追加到 messages
 * - 限速 20/天，每次 send 后更新 remaining
 */
import { create } from 'zustand';
import * as coachApi from '../api/coach';
import { ApiError, NetworkError } from '../api/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface CoachState {
  messages: ChatMessage[];
  remaining: number;
  limit: number;
  loading: 'idle' | 'sending' | 'history';
  error: string | null;

  loadHistory: () => Promise<void>;
  sendMessage: (text: string) => Promise<string | null>;
  clearAll: () => Promise<void>;
  clearError: () => void;
}

export const useCoachStore = create<CoachState>((set, get) => ({
  messages: [],
  remaining: 20,
  limit: 20,
  loading: 'idle',
  error: null,

  async loadHistory() {
    set({ loading: 'history', error: null });
    try {
      const [msgs, usage] = await Promise.all([coachApi.getHistory(), coachApi.getUsage()]);
      set({ messages: msgs, remaining: usage.remaining, limit: usage.limit, loading: 'idle' });
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
    if (get().remaining <= 0) {
      set({ error: '今日对话次数已用完，明天再来' });
      return null;
    }
    set({ error: null, loading: 'sending' });
    // 立即追加用户消息（乐观 UI）
    const tempUserMsg: ChatMessage = {
      id: 'tmp-' + Date.now(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, tempUserMsg] }));
    try {
      const { reply, remaining } = await coachApi.sendChat(trimmed);
      const assistantMsg: ChatMessage = {
        id: 'tmp-' + (Date.now() + 1),
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, assistantMsg], remaining, loading: 'idle' }));
      return reply;
    } catch (e) {
      // 失败时把临时用户消息移除
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== tempUserMsg.id),
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