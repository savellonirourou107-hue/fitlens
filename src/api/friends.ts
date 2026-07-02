/**
 * /friends/* API
 * 全部需要 token
 *
 * 注意：只读 daily_summaries 白名单字段
 *       搜索不返回 email
 */
import { apiFetch } from './client';

export interface FriendRef {
  userId: string;
  nickname: string;
  avatarSeed: string;
  /** only on /friends list */
  since?: string;
}

export interface FriendToday {
  userId: string;
  nickname: string;
  avatarSeed: string;
  date: string;
  intakeKcal: number;
  burnedKcal: number;
  targetKcal: number;
  updatedAt: string | null;
}

export interface FriendRequest {
  friendshipId: string;
  userId: string;
  nickname: string;
  avatarSeed: string;
  createdAt: string;
  status?: string;
}

export interface FriendRequestsResponse {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export function getFriends(): Promise<FriendRef[]> {
  return apiFetch<FriendRef[]>('/friends');
}

/** 精确邮箱搜索（不返 email） */
export function searchFriendByEmail(email: string): Promise<FriendRef> {
  return apiFetch<FriendRef>(
    `/friends/search?email=${encodeURIComponent(email.trim().toLowerCase())}`,
  );
}

export function sendFriendRequest(targetUserId: string): Promise<{
  friendshipId: string;
  status: string;
}> {
  return apiFetch('/friends/request', {
    method: 'POST',
    body: { targetUserId },
  });
}

export function acceptFriendRequest(friendshipId: string): Promise<{
  friendshipId: string;
  status: string;
}> {
  return apiFetch('/friends/accept', {
    method: 'POST',
    body: { friendshipId },
  });
}

export function rejectFriendRequest(friendshipId: string): Promise<{
  friendshipId: string;
  status: string;
}> {
  return apiFetch('/friends/reject', {
    method: 'POST',
    body: { friendshipId },
  });
}

export function getRequests(): Promise<FriendRequestsResponse> {
  return apiFetch<FriendRequestsResponse>('/friends/requests');
}

export function getFriendToday(userId: string): Promise<FriendToday> {
  return apiFetch<FriendToday>(`/friends/${userId}/today`);
}