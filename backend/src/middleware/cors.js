/**
 * CORS 收紧：
 * - /recognize/* 仍对所有来源开放（v0.4 公开 AI 识别）
 * - 其他路由（/auth, /friends, /sync）只允许白名单
 *   - 移动端请求 origin 为 null（RN/Expo）也放行
 *   - 移动 App + 本地 dev 白名单通过 CORS_ALLOWED_ORIGINS 配置
 */
import cors from 'cors';

const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function makeStrictCors() {
  return cors({
    origin: (origin, cb) => {
      // 移动端没有 Origin header，放行
      if (!origin) return cb(null, true);
      // 未配置白名单时全开（仅 dev）
      if (ALLOWED_ORIGINS.length === 0) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked: ' + origin));
    },
    credentials: true,
  });
}

export const strictCors = makeStrictCors();
export const openCors = cors({ origin: '*' });