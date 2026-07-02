/**
 * /coach/* 路由
 * - POST /coach/chat  发消息
 * - GET  /coach/history  拉历史
 * - DELETE /coach/history 清空
 *
 * 隐私：
 * - 不读 meal/exercise/diary 明细（只读 daily_summaries 聚合）
 * - 不读 user_profile.weightKg / height
 * - 24h 自动清（用 created_at 过滤）
 * - 每日限速 20 次
 */
import { Router } from 'express';
import { z } from 'zod';
import sql from '../db.js';
import { requireAuth } from '../auth.js';
import { chatCoach } from '../services/minimax.js';
import { error, ok } from '../utils.js';

const router = Router();

const DAILY_LIMIT = 20;
const MAX_MESSAGE_LEN = 500;

const chatSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LEN),
});

/** 计算今日聚合数字（不读明细） */
async function getTodayContext(userId) {
  const today = new Date().toISOString().slice(0, 10);
  // 今日
  const todayRows = await sql`
    SELECT intake_kcal, burned_kcal, target_kcal
    FROM daily_summaries
    WHERE user_id = ${userId} AND date = ${today}
    LIMIT 1
  `;
  const today_data = todayRows[0] || { intake_kcal: 0, burned_kcal: 0, target_kcal: 0 };

  // 近 7 天
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

/** 检查/累加今日使用次数 */
async function checkAndIncrementUsage(userId) {
  const today = new Date().toISOString().slice(0, 10);
  await sql`
    INSERT INTO chat_usage (user_id, date, count) VALUES (${userId}, ${today}, 1)
    ON CONFLICT (user_id, date) DO UPDATE SET count = chat_usage.count + 1
  `;
  const rows = await sql`
    SELECT count FROM chat_usage WHERE user_id = ${userId} AND date = ${today}
  `;
  return rows[0]?.count ?? 0;
}

/** POST /coach/chat */
router.post('/chat', requireAuth, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'INVALID_BODY', `消息长度 1-${MAX_MESSAGE_LEN} 字符`);
  }
  const { message } = parsed.data;

  // 限速
  const count = await checkAndIncrementUsage(req.userId);
  if (count > DAILY_LIMIT) {
    return error(res, 429, 'RATE_LIMIT', `今日对话次数已用完（${DAILY_LIMIT} 次/天）`);
  }

  // 拉 24h 内的历史
  const historyRows = await sql`
    SELECT role, content FROM chat_messages
    WHERE user_id = ${req.userId}
      AND created_at > now() - INTERVAL '24 hours'
    ORDER BY created_at ASC
    LIMIT 20
  `;
  const history = historyRows.map((r) => ({ role: r.role, content: r.content }));

  // 收集用户语境（只读 daily_summaries）
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

  return ok(res, {
    reply,
    remaining: Math.max(0, DAILY_LIMIT - count),
  });
});

/** GET /coach/history - 24h 内的对话历史 */
router.get('/history', requireAuth, async (req, res) => {
  const rows = await sql`
    SELECT id, role, content, created_at FROM chat_messages
    WHERE user_id = ${req.userId}
      AND created_at > now() - INTERVAL '24 hours'
    ORDER BY created_at ASC
    LIMIT 100
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

/** GET /coach/usage - 今日剩余次数 */
router.get('/usage', requireAuth, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await sql`
    SELECT count FROM chat_usage WHERE user_id = ${req.userId} AND date = ${today}
  `;
  const used = rows[0]?.count ?? 0;
  return ok(res, { used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used) });
});

export default router;