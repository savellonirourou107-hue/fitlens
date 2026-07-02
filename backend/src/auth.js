/**
 * JWT 签发 + 校验
 *
 * Payload（不放 email，只放 sub 和 ver）：
 *   { sub: <userId>, ver: <tokenVersion>, iat, exp }
 *
 * ver 用于软吊销：users.token_version 自增后所有旧 token 失效
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 天

export function signToken(userId, tokenVersion) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  return jwt.sign(
    { sub: userId, ver: tokenVersion },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: TOKEN_TTL_SECONDS }
  );
}

export function verifyToken(token) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

/**
 * Express 中间件：要求请求带有效 JWT
 * - 解析 payload 后调用 getUserById 校验 token_version
 * - 不匹配视为失效，返回 401 AUTH_INVALID
 */
import sql from './db.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '未登录或登录已过期' },
    });
  }
  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch (e) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID', message: '登录已失效，请重新登录' },
    });
  }
  // 校验 token_version：用户改过密码或退出所有设备后会自增
  const rows = await sql`
    SELECT id, token_version FROM users WHERE id = ${payload.sub} LIMIT 1
  `;
  if (rows.length === 0) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID', message: '账号已注销' },
    });
  }
  if (rows[0].token_version !== payload.ver) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID', message: '登录已失效，请重新登录' },
    });
  }
  req.userId = payload.sub;
  next();
}