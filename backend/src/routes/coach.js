/**
 * /coach/* 路由
 * - POST /coach/chat  发消息
 * - GET  /coach/usage  不限次数状态
 * - GET  /coach/history  拉历史
 * - DELETE /coach/history 清空
 *
 * 隐私：
 * - 不读 meal/exercise/diary 明细（只读 daily_summaries 聚合）
 * - 不读 user_profile.weightKg / height
 * - 24h 自动清（用 created_at 过滤）
 */
import { Router } from 'express';
import { z } from 'zod';
import sql from '../db.js';
import { requireAuth } from '../auth.js';
import { chatCoach } from '../services/minimax.js';
import { error, ok } from '../utils.js';

const router = Router();

const chatSchema = z.object({
  message: z.string().trim().min(1),
});

const unlimitedUsage = {
  used: null,
  limit: null,
  remaining: null,
  unlimited: true,
};

/** 计算今日聚合数字（不读明细） */
async function getTodayContext(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = await sql`
    SELECT intake_kcal, burned_kcal, target_kcal
    FROM daily_summaries
    WHERE user_id = ${userId} AND date = ${today}
    LIMIT 1
  `;
  const today_data = todayRows[0] || { intake_kcal: 0, burned_kcal: 0, target_kcal: 0 };

  const weekRows = await sql`
    SELECT date, intake_kcal, burned_kcal
    FROM daily_summaries
    WHERE user_id = ${userId}
      AND date >= (CURRENT_DATE - INTERVAL '6 days')
      AND date <= CURRENT_DATE
    ORDER BY date ASC
  `;
  const weekTrend = weekRows.map((r) => ({
    date: r.date,
    intakeKcal: r.intake_kcal,
    burnedKcal: r.burned_kcal,
  }));

  return {
    intakeKcal: today_data.intake_kcal,
    burnedKcal: today_data.burned_kcal,
    targetKcal: today_data.target_kcal,
    weekTrend,
  };
}

/** POST /coach/chat */
router.post('/chat', requireAuth, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'INVALID_BODY', '消息不能为空');
  }
  const { message } = parsed.data;

  // 拉 24h 内的历史
  const historyRows = await sql`
    SELECT role, content FROM chat_messages
    WHERE user_id = ${req.userId}
      AND created_at > now() - INTERVAL '24 hours'
    ORDER BY created_at ASC
  `;
  const history = historyRows.map((r) => ({ role: r.role, content: r.content }));

  const ctx = await getTodayContext(req.userId);

  // 存用户消息
  await sql`
    INSERT INTO chat_messages (user_id, role, content) VALUES (${req.userId}, 'user', ${message})
  `;

  // 调 LLM
  let reply;
  try {
    reply = await chatCoach(message, history, ctx);
  } catch (e) {
    return error(res, 502, 'LLM_FAILED', e instanceof Error ? e.message : '教练暂时不可用，请稍后再试');
  }

  // 存教练回复
  await sql`
    INSERT INTO chat_messages (user_id, role, content) VALUES (${req.userId}, 'assistant', ${reply})
  `;

  return ok(res, { reply, ...unlimitedUsage });
});

/** GET /coach/usage - AI 教练不限次数，保留接口给前端显示状态 */
router.get('/usage', requireAuth, async (req, res) => {
  return ok(res, unlimitedUsage);
});

/** GET /coach/history - 24h 内的对话历史 */
router.get('/history', requireAuth, async (req, res) => {
  const rows = await sql`
    SELECT id, role, content, created_at FROM chat_messages
    WHERE user_id = ${req.userId}
      AND created_at > now() - INTERVAL '24 hours'
    ORDER BY created_at ASC
  `;
  return ok(res, rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
  })));
});

/** DELETE /coach/history - 清空（不影响 24h 自动清理） */
router.delete('/history', requireAuth, async (req, res) => {
  await sql`DELETE FROM chat_messages WHERE user_id = ${req.userId}`;
  return ok(res, { deleted: true });
});

export default router;
