/**
 * FitLens 后端主入口
 * - /health           健康检查
 * - /recognize/*      AI 识别（公开）
 * - /auth/*           账号（白名单 CORS）
 * - /friends/*        好友（白名单 CORS + requireAuth）
 * - /sync/*           同步（白名单 CORS + requireAuth）
 */
import 'dotenv/config';
import express from 'express';
import { strictCors, openCors } from './middleware/cors.js';
import { requireAuth } from './auth.js';
import recognizeRouter from './routes/recognize.js';
import authRouter from './routes/auth.js';
import friendsRouter from './routes/friends.js';
import syncRouter from './routes/sync.js';

const app = express();

// CORS 收紧：识别路由仍公开，其他路由走白名单
app.use('/recognize', openCors, recognizeRouter);
app.use(strictCors);

app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) =>
  res.json({ ok: true, service: 'fitlens-backend' }),
);

// /auth/register 和 /auth/login 公开，其他 /auth/* 需要登录
app.post('/auth/register', authRouter);
app.post('/auth/login', authRouter);
app.post('/auth/refresh', authRouter);
app.use('/auth', requireAuth, authRouter); // GET /me, DELETE /me

// 好友 + 同步全部需要登录
app.use('/friends', requireAuth, friendsRouter);
app.use('/sync', requireAuth, syncRouter);

// 全局错误兜底
app.use((err, req, res, next) => {
  if (err && err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({
      success: false,
      error: { code: 'CORS_BLOCKED', message: '来源不被允许' },
    });
  }
  console.error('[unhandled]', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: '服务端异常' },
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`FitLens backend on http://localhost:${PORT}`),
);