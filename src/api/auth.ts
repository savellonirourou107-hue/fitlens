/**
 * /auth/* API
 * - register / login 公开
 * - me / delete 需要 token（在 client.ts 自动加）
 * - 业务层不解析 token，只作为 Authorization Bearer 透传
 */
import { apiFetch } from './client';

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  avatarSeed: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export function register(payload: {
  email: string;
  password: string;
  nickname: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function login(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function me(): Promise<{
  id: string;
  email: string;
  nickname: string;
  avatarSeed: string;
  createdAt: string;
  updatedAt: string;
}> {
  return apiFetch('/auth/me');
}

export function deleteMe(): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>('/auth/me', { method: 'DELETE' });
}