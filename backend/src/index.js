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

// CORS：允许所有来源（识别服务公开可用，无需白名单）
app.use(cors());

app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) =>
  res.json({ ok: true, service: 'fitlens-backend' }),
);

app.use('/recognize', recognizeRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`FitLens backend on http://localhost:${PORT}`),
);
