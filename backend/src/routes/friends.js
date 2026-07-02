/**
 * /friends/* 路由
 * - 全部需要 requireAuth
 * - friendships 表用 user_low_id / user_high_id 唯一约束
 * - 搜索精确邮箱匹配，不返回 email
 * - 拒绝后再请求走 UPDATE
 * - /:id/today 只返回聚合数字（user_id, nickname, avatar_seed, date, intakeKcal, burnedKcal, targetKcal, updatedAt）
 */
import { Router } from 'express';
import { z } from 'zod';
import sql from '../db.js';
import { error, ok } from '../utils.js';

const router = Router();

// 关键隐私：白名单字段（任何 /friends/* 路由只准返回这些字段名）
const FRIEND_PUBLIC_FIELDS = ['userId', 'nickname', 'avatarSeed', 'since'];
const TODAY_PUBLIC_FIELDS = [
  'userId', 'nickname', 'avatarSeed', 'date',
  'intakeKcal', 'burnedKcal', 'targetKcal', 'updatedAt',
];

/** 检查 :id 是不是当前用户的好友（accepted 状态） */
async function isAcceptedFriend(myId, otherId) {
  const { low, high } = pairKey(myId, otherId);
  const rows = await sql`
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND user_low_id = ${low} AND user_high_id = ${high}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** 规范化一对用户 ID 为 (low, high) - 避免 SQL 里 LEAST/GREATEST 嵌套参数化的兼容问题 */
function pairKey(a, b) {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

/** GET /friends - 我的好友列表 */
router.get('/', async (req, res) => {
  const rows = await sql`
    SELECT
      CASE WHEN f.user_low_id = ${req.userId} THEN f.user_high_id ELSE f.user_low_id END AS user_id,
      u.nickname, u.avatar_seed, f.created_at AS since
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_low_id = ${req.userId} THEN f.user_high_id ELSE f.user_low_id END
    WHERE (f.user_low_id = ${req.userId} OR f.user_high_id = ${req.userId})
      AND f.status = 'accepted'
    ORDER BY f.created_at DESC
  `;
  // 字段白名单过滤
  const data = rows.map((r) => ({
    userId: r.user_id,
    nickname: r.nickname,
    avatarSeed: r.avatar_seed,
    since: r.since,
  }));
  return ok(res, data);
});

/** GET /friends/search?email=<完整邮箱> */
router.get('/search', async (req, res) => {
  const email = String(req.query.email || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    return error(res, 400, 'INVALID_BODY', '请输入完整邮箱');
  }
  const rows = await sql`
    SELECT id, nickname, avatar_seed FROM users
    WHERE email = ${email} AND id <> ${req.userId}
    LIMIT 1
  `;
  if (rows.length === 0) {
    return error(res, 404, 'NOT_FOUND', '未找到该邮箱对应的用户');
  }
  const u = rows[0];
  return ok(res, { userId: u.id, nickname: u.nickname, avatarSeed: u.avatar_seed });
});

/** POST /friends/request { targetUserId } */
router.post('/request', async (req, res) => {
  const schema = z.object({ targetUserId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'INVALID_BODY', '请求参数不合法');
  }
  const target = parsed.data.targetUserId;
  if (target === req.userId) {
    return error(res, 400, 'INVALID_BODY', '不能加自己为好友');
  }
  // 确认对方存在
  const exists = await sql`SELECT id FROM users WHERE id = ${target} LIMIT 1`;
  if (exists.length === 0) {
    return error(res, 404, 'NOT_FOUND', '用户不存在');
  }
  // 看现有关系
  const { low, high } = pairKey(req.userId, target);
  const existing = await sql`
    SELECT id, status, requester_id, addressee_id FROM friendships
    WHERE user_low_id = ${low} AND user_high_id = ${high}
    LIMIT 1
  `;
  if (existing.length > 0) {
    const row = existing[0];
    // 我是 addressee 且 status=blocked → 对方屏蔽我
    if (row.status === 'blocked' && row.addressee_id === req.userId) {
      return error(res, 403, 'NOT_AUTHORIZED', '无法发送好友请求');
    }
    if (row.status === 'pending') {
      return error(res, 409, 'ALREADY_FRIENDS', '已有待处理的好友请求');
    }
    if (row.status === 'accepted') {
      return error(res, 409, 'ALREADY_FRIENDS', '已经是好友了');
    }
    if (row.status === 'rejected') {
      // 关键：rejected → UPDATE，不 INSERT
      const updated = await sql`
        UPDATE friendships
        SET status = 'pending', requester_id = ${req.userId}, addressee_id = ${target}, updated_at = now()
        WHERE id = ${row.id}
        RETURNING id, status
      `;
      return ok(res, { friendshipId: updated[0].id, status: updated[0].status }, 201);
    }
  }
  // 无记录 → INSERT
  const inserted = await sql`
    INSERT INTO friendships (user_low_id, user_high_id, requester_id, addressee_id, status)
    VALUES (LEAST(${req.userId}, ${target}), GREATEST(${req.userId}, ${target}),
            ${req.userId}, ${target}, 'pending')
    RETURNING id, status
  `;
  return ok(res, { friendshipId: inserted[0].id, status: inserted[0].status }, 201);
});

/** POST /friends/accept { friendshipId } - 当前用户必须是 addressee */
router.post('/accept', async (req, res) => {
  const schema = z.object({ friendshipId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, 'INVALID_BODY', '请求参数不合法');
  const id = parsed.data.friendshipId;
  const rows = await sql`
    UPDATE friendships
    SET status = 'accepted', updated_at = now()
    WHERE id = ${id} AND addressee_id = ${req.userId} AND status = 'pending'
    RETURNING id, status
  `;
  if (rows.length === 0) {
    return error(res, 404, 'NOT_FOUND', '好友请求不存在或已处理');
  }
  return ok(res, { friendshipId: rows[0].id, status: rows[0].status });
});

/** POST /friends/reject { friendshipId } */
router.post('/reject', async (req, res) => {
  const schema = z.object({ friendshipId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, 'INVALID_BODY', '请求参数不合法');
  const id = parsed.data.friendshipId;
  const rows = await sql`
    UPDATE friendships
    SET status = 'rejected', updated_at = now()
    WHERE id = ${id} AND addressee_id = ${req.userId} AND status = 'pending'
    RETURNING id, status
  `;
  if (rows.length === 0) {
    return error(res, 404, 'NOT_FOUND', '好友请求不存在或已处理');
  }
  return ok(res, { friendshipId: rows[0].id, status: rows[0].status });
});

/** GET /friends/requests - 我的待处理请求（收到的 + 发出的） */
router.get('/requests', async (req, res) => {
  const incoming = await sql`
    SELECT f.id AS friendship_id, u.id AS user_id, u.nickname, u.avatar_seed, f.created_at
    FROM friendships f JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = ${req.userId} AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `;
  const outgoing = await sql`
    SELECT f.id AS friendship_id, u.id AS user_id, u.nickname, u.avatar_seed, f.created_at, f.status
    FROM friendships f JOIN users u ON u.id = f.addressee_id
    WHERE f.requester_id = ${req.userId} AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `;
  return ok(res, {
    incoming: incoming.map((r) => ({
      friendshipId: r.friendship_id,
      userId: r.user_id,
      nickname: r.nickname,
      avatarSeed: r.avatar_seed,
      createdAt: r.created_at,
    })),
    outgoing: outgoing.map((r) => ({
      friendshipId: r.friendship_id,
      userId: r.user_id,
      nickname: r.nickname,
      avatarSeed: r.avatar_seed,
      createdAt: r.created_at,
      status: r.status,
    })),
  });
});

/**
 * GET /friends/:id/today - 好友今日两个数字（隐私硬约束）
 * - SQL 只能查 daily_summaries 一张表
 * - 必须 accepted 关系
 * - 响应字段严格白名单
 */
router.get('/:id/today', async (req, res) => {
  const otherId = req.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(otherId)) {
    return error(res, 400, 'INVALID_BODY', '无效的用户 ID');
  }
  if (otherId === req.userId) {
    return error(res, 400, 'INVALID_BODY', '不能查询自己');
  }
  const friend = await isAcceptedFriend(req.userId, otherId);
  if (!friend) {
    return error(res, 403, 'NOT_AUTHORIZED', '只能查看好友的今日数据');
  }
  // 关键：SQL 只查 daily_summaries，绝不 join meals / exercises / diaries
  const userRows = await sql`
    SELECT id, nickname, avatar_seed FROM users WHERE id = ${otherId} LIMIT 1
  `;
  if (userRows.length === 0) {
    return error(res, 404, 'NOT_FOUND', '用户不存在');
  }
  const today = new Date().toISOString().slice(0, 10);
  const summaryRows = await sql`
    SELECT intake_kcal, burned_kcal, target_kcal, updated_at
    FROM daily_summaries
    WHERE user_id = ${otherId} AND date = ${today}
    LIMIT 1
  `;
  const u = userRows[0];
  // 字段白名单兜底：手动构造对象，避免传多余字段
  const data = summaryRows.length > 0
    ? {
        userId: u.id,
        nickname: u.nickname,
        avatarSeed: u.avatar_seed,
        date: today,
        intakeKcal: summaryRows[0].intake_kcal,
        burnedKcal: summaryRows[0].burned_kcal,
        targetKcal: summaryRows[0].target_kcal,
        updatedAt: summaryRows[0].updated_at,
      }
    : {
        userId: u.id,
        nickname: u.nickname,
        avatarSeed: u.avatar_seed,
        date: today,
        intakeKcal: 0,
        burnedKcal: 0,
        targetKcal: 0,
        updatedAt: null,
      };
  // 二次防御：运行时断言 key 是白名单子集
  for (const k of Object.keys(data)) {
    if (!TODAY_PUBLIC_FIELDS.includes(k)) {
      return error(res, 500, 'INTERNAL', '隐私字段泄漏');
    }
  }
  return ok(res, data);
});

export default router;