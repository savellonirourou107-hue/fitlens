/**
 * FitLens 后端主入口
 * - /health          健康检查
 * - /recognize/*     识别路由（食物 / 运动）
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import recognizeRouter from './routes/recognize.js';

const app = express();

// CORS 白名单：CORS_ORIGIN 逗号分隔；未配置则允许全部来源
const origins = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));

app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) =>
  res.json({ ok: true, service: 'fitlens-backend' }),
);

app.use('/recognize', recognizeRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`FitLens backend on http://localhost:${PORT}`),
);
