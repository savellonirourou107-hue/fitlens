/**
 * /coach/* API
 */
import { apiFetch } from './client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export function sendChat(message: string): Promise<{ reply: string; remaining: number }> {
  return apiFetch('/coach/chat', { method: 'POST', body: { message } });
}

export function getHistory(): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>('/coach/history');
}

export function clearHistory(): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>('/coach/history', { method: 'DELETE' });
}

export function getUsage(): Promise<{ used: number; limit: number; remaining: number }> {
  return apiFetch<{ used: number; limit: number; remaining: number }>('/coach/usage');
}