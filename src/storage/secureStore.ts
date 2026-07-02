/**
 * Secure token 存储
 * - 用 expo-secure-store（iOS Keychain / Android Keystore）
 * - 不存 AsyncStorage（明文不安全）
 * - 错误降级：SecureStore 不可用时返回 null，不抛
 */
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'fitlens_auth_token';
const USER_KEY = 'fitlens_auth_user';

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (e) {
    console.warn('[SecureStore] setToken failed:', e);
  }
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch (e) {
    console.warn('[SecureStore] clearToken failed:', e);
  }
}

/** 缓存当前用户（id + email + nickname + avatarSeed），用于离线启动快速展示 */
export async function setCachedUser(user: {
  id: string;
  email: string;
  nickname: string;
  avatarSeed: string;
}): Promise<void> {
  try {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('[SecureStore] setCachedUser failed:', e);
  }
}

export async function getCachedUser(): Promise<{
  id: string;
  email: string;
  nickname: string;
  avatarSeed: string;
} | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}