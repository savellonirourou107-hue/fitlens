/**
 * /sync/* 路由
 * - 客户端把每日聚合数字上传到服务端
 * - 服务端只信任数字，不反向聚合
 */
import { Router } from 'express';
import { z } from 'zod';
import sql from '../db.js';
import { error, ok } from '../utils.js';

const router = Router();

const dailySummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date 必须是 YYYY-MM-DD'),
  intakeKcal: z.number().nonnegative().max(50000),
  burnedKcal: z.number().nonnegative().max(20000),
  targetKcal: z.number().nonnegative().max(10000),
});

/** PUT /sync/daily-summary */
router.put('/daily-summary', async (req, res) => {
  const parsed = dailySummarySchema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'INVALID_BODY', '请求参数不合法', {
      issues: parsed.error.issues,
    });
  }
  const { date, intakeKcal, burnedKcal, targetKcal } = parsed.data;
  const rows = await sql`
    INSERT INTO daily_summaries (user_id, date, intake_kcal, burned_kcal, target_kcal, updated_at)
    VALUES (${req.userId}, ${date}, ${intakeKcal}, ${burnedKcal}, ${targetKcal}, now())
    ON CONFLICT (user_id, date) DO UPDATE
    SET intake_kcal = EXCLUDED.intake_kcal,
        burned_kcal = EXCLUDED.burned_kcal,
        target_kcal = EXCLUDED.target_kcal,
        updated_at = now()
    RETURNING updated_at
  `;
  return ok(res, { date, updatedAt: rows[0].updated_at });
});

/** GET /sync/daily-summary?date=YYYY-MM-DD - 取自己某天的聚合 */
router.get('/daily-summary', async (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return error(res, 400, 'INVALID_BODY', 'date 必须是 YYYY-MM-DD');
  }
  const rows = await sql`
    SELECT intake_kcal, burned_kcal, target_kcal, updated_at
    FROM daily_summaries
    WHERE user_id = ${req.userId} AND date = ${date}
    LIMIT 1
  `;
  if (rows.length === 0) {
    return ok(res, { date, intakeKcal: 0, burnedKcal: 0, targetKcal: 0, updatedAt: null });
  }
  return ok(res, {
    date,
    intakeKcal: rows[0].intake_kcal,
    burnedKcal: rows[0].burned_kcal,
    targetKcal: rows[0].target_kcal,
    updatedAt: rows[0].updated_at,
  });
});

export default router;