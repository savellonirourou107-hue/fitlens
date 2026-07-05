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

export interface CoachUsage {
  used: number | null;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
}

export interface CoachChatResponse extends Partial<CoachUsage> {
  reply: string;
}

export function sendChat(message: string): Promise<CoachChatResponse> {
  return apiFetch('/coach/chat', { method: 'POST', body: { message } });
}

export function getHistory(): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>('/coach/history');
}

export function clearHistory(): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>('/coach/history', { method: 'DELETE' });
}

export function getUsage(): Promise<CoachUsage> {
  return apiFetch<CoachUsage>('/coach/usage');
}
