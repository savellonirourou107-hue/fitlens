/**
 * 错误响应工具
 */
export function error(res, http, code, message, details) {
  return res.status(http).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
}

export function ok(res, data, http = 200) {
  return res.status(http).json({ success: true, data });
}

/**
 * 随机字符串（avatar_seed / id 生成用）
 */
import { randomBytes } from 'crypto';
export function randomString(bytes = 4) {
  return randomBytes(bytes).toString('hex');
}