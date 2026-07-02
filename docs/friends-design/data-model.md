# FitLens v0.5 — 数据模型

> 范围：新增 3 张表（users / friendships / daily_summaries），保留本地 SQLite 作为设备主存储。
> 选择：服务端 **Neon 免费 Postgres**（永久不丢）+ 本地 SQLite（设备）双层；数据通过增量同步桥接。

---

## 1. 数据库选型

### 1.1 推荐：服务端 Neon Postgres + 本地 SQLite（双层）

| 层 | 数据库 | 理由 |
|---|---|---|
| **服务端** | Neon Postgres 免费 plan (0.5 GB) | 永久免费、不会过期删数据；支持 WebSocket 直连，比 Render Postgres 灵活；外键约束保证 friendship 一致性；UUID PK + JSON 字段支持头像/昵称扩展 |
| **客户端** | SQLite (expo-sqlite) | 现有 v0.4 已经用，零迁移成本；离线优先；本地查询即时；用户数据主权在自己设备 |

### 1.2 为什么不选 Render Postgres 免费 plan

- Render 免费 Postgres **90 天后过期删除**，需要手动迁移到 Neon/Supabase 等
- Neon 免费 0.5GB 对 10-50 人小范围**绰绰有余**
- Neon 支持 serverless driver（@neondatabase/serverless），冷启动比传统 pg 更快

### 1.3 选型对前端的影响

- 现有 `expo-sqlite` 完全保留，不动。
- 新增 `src/api/sync.ts` 模块负责 SQLite ↔ Postgres 的增量同步。
- 后端 PG client 用 `@neondatabase/serverless`（HTTP/WebSocket 直连，不用 pg pool）。

---

## 2. 服务端表结构

> 所有表 snake_case；时间戳 ISO8601 字符串（与前端 date string 保持一致，避免时区问题）。
> ID 全部用服务端生成的 UUIDv7（按时间排序，便于分页）。

### 2.1 users

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,           -- bcrypt cost 12
  nickname        TEXT NOT NULL,           -- 2-16 字，默认从邮箱前缀生成
  avatar_seed     TEXT NOT NULL,           -- 随机字符串，前端用它生成头像色块
  token_version   INTEGER NOT NULL DEFAULT 0,  -- JWT 软吊销：自增即让所有旧 token 失效
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email_lower ON users (LOWER(email));
```

**字段约束**

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID PK | 默认值 | 内部 ID，对外暴露 |
| email | TEXT | UNIQUE, NOT NULL, ltrim+lower | 用于登录 & 精确邮箱搜索加好友 |
| password_hash | TEXT | NOT NULL | bcrypt 哈希，禁止明文落库 |
| nickname | TEXT | NOT NULL, length 2-16 | 客户端可改 |
| avatar_seed | TEXT | NOT NULL, length 8 | 注册时随机生成，前端用此渲染头像 |
| token_version | INTEGER | NOT NULL DEFAULT 0 | JWT 软吊销用，改密码 / 退出所有设备时 +1 |

**索引**

- `UNIQUE(email)` 覆盖索引 → 登录、注册去重、精确邮箱搜索加好友都用。
- `LOWER(email)` 索引 → 用户输入大小写不敏感。

**安全备注**

- email 字段**不返回给其他用户**，加好友搜索只返回 `{id, nickname, avatar_seed}`。
- password_hash **绝不**通过 API 返回。
- JWT 不携带 email，需要时调 `/auth/me`。

### 2.2 friendships（双向好友关系）

```sql
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'rejected', 'blocked');

CREATE TABLE friendships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 规范化字段：user_low_id < user_high_id，永远保证这一对用户只有一行
  user_low_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          friendship_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_low_lt_high CHECK (user_low_id < user_high_id),
  CONSTRAINT uniq_pair UNIQUE (user_low_id, user_high_id)
);

CREATE INDEX idx_friendships_addressee_pending
  ON friendships (addressee_id) WHERE status = 'pending';
CREATE INDEX idx_friendships_user_low
  ON friendships (user_low_id);
CREATE INDEX idx_friendships_user_high
  ON friendships (user_high_id);
CREATE INDEX idx_friendships_pair_status
  ON friendships (user_low_id, user_high_id, status);
```

**设计选择：双向好友 + 规范化字段**

1. **好友关系 = 双向**：A 发请求 → B 接受 → 双方都能看到对方今日数字。v0.5 不做单向关注、不做"我关注你但你看不了我"。
2. **规范化字段防双向重复**：用 `user_low_id = LEAST(a, b)` 和 `user_high_id = GREATEST(a, b)`。无论 A 发给 B 还是 B 发给 A，都只能有一行 `UNIQUE(user_low_id, user_high_id)`。
3. **`requester_id` / `addressee_id` 保留**：用于判断"我是请求方还是接收方"，影响前端按钮文案（"接受请求"vs"等待对方接受"）。

**枚举状态**

| 状态 | 含义 |
|---|---|
| pending | requester 已发请求，addressee 未处理 |
| accepted | 双向互为好友 |
| rejected | addressee 已拒绝；保留记录防再次骚扰 |
| blocked | addressee 屏蔽了 requester |

**拒绝后再请求的处理（关键）**

`/friends/request` 收到请求时，**先查有没有 rejected 记录**：

```sql
SELECT id, status FROM friendships
WHERE user_low_id = LEAST($1, $2)
  AND user_high_id = GREATEST($1, $2);
```

- 无记录 → INSERT 新行（status=pending）
- 有 rejected 记录 → **UPDATE** status=pending, requester_id=$1, addressee_id=$2, updated_at=now()
- 有 pending/accepted 记录 → 返回 409 `ALREADY_FRIENDS`
- 有 blocked 记录（我是被屏蔽方）→ 返回 403 `NOT_AUTHORIZED`

**实际查询示例**

```sql
-- 列出我的所有好友（双向）
SELECT u.id, u.nickname, u.avatar_seed, f.created_at AS since
FROM friendships f
JOIN users u ON u.id = CASE WHEN f.user_low_id = $1 THEN f.user_high_id ELSE f.user_low_id END
WHERE (f.user_low_id = $1 OR f.user_high_id = $1)
  AND f.status = 'accepted';

-- 查"我收到的待处理请求"
SELECT f.id AS friendship_id, u.id AS user_id, u.nickname, u.avatar_seed, f.created_at
FROM friendships f JOIN users u ON u.id = f.requester_id
WHERE f.addressee_id = $1 AND f.status = 'pending'
ORDER BY f.created_at DESC;
```

### 2.3 daily_summaries

```sql
CREATE TABLE daily_summaries (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,                        -- 本地日期字符串 YYYY-MM-DD
  intake_kcal     REAL NOT NULL DEFAULT 0,
  burned_kcal     REAL NOT NULL DEFAULT 0,
  target_kcal     REAL NOT NULL DEFAULT 0,              -- 缓存：避免每次重新计算 BMR/TDEE
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX idx_daily_summaries_user_date
  ON daily_summaries (user_id, date DESC);
```

**为什么需要 daily_summaries**

- 好友查询 `/friends/:id/today` 99% 只需要"两个数字"，**绝不能扫 meals + exercises 表**。
- 把聚合结果物化到一张小表，按 `(user_id, date)` PK 索引，毫秒级返回。
- 写：客户端每次新增/修改 meal 或 exercise 后**异步**PUT `/sync/daily-summary?date=YYYY-MM-DD`；服务端 upsert。

**聚合逻辑（前端 SQLite → 上传 daily_summaries）**

```ts
// 前端伪代码：每日结束后或 meal/exercise 写后触发
const intake = meals.filter(m=>m.date===date).reduce((s,m)=>s+m.items.reduce(...),0);
const burned = exercises.filter(e=>e.date===date).reduce((s,e)=>s+e.caloriesBurnedKcal,0);
const target = profile ? dailyTargetKcal(profile) : 0;
await api.put('/sync/daily-summary', { date, intake_kcal: intake, burned_kcal: burned, target_kcal: target });
```

服务端**只信任前端上报的数字**，不做反向聚合（避免多端冲突）。

### 2.4 不存的食物/运动明细（关键隐私决策）

- 服务端**不存储** meals / exercises / diaries 的明细。
- 用户上传的 meal → 只用于本地识别 & 本地存储；服务端 daily_summaries 只存聚合。
- 即使将来要支持"跨设备同步明细"，也用单独的端点 + 加密 + 用户显式开关。
- **理由**：v0.5 范围小、隐私边界清晰；即使后端被入侵，攻击者拿不到任何食物/体重。

---

## 3. 迁移策略

### 3.1 后端：首次部署自动 migrate

- 在 Render 上 `buildCommand: npm run migrate` 跑一次；后续用 `node-pg-migrate` 版本化迁移文件。
- 目录约定：
  ```
  backend/
    migrations/
      001_create_users.sql
      002_create_friendships.sql
      003_create_daily_summaries.sql
    src/
      ...
  ```

### 3.2 前端：本地 SQLite 不动

- v0.4 的 `user_profile / meals / meal_items / exercises / diaries` 表 **保留不动**。
- 不回填（因为本地数据没传过云端，没有"云端旧数据"要回填）。
- v0.5 登录成功后只做**增量上传 daily_summaries**；不改动本地任何表。

### 3.3 既有 Render 部署的影响

- 已有 Render web 服务 → 在 render.yaml 加一个 Postgres + 引用 `DATABASE_URL` 环境变量。
- 不影响 v0.4 的 `/recognize/*` 和 `/health`。
- CORS 收紧 + 新增 `/auth` `/friends` `/sync` 三组路由。
- 既有 MINIMAX_API_KEY 保留。

---

## 4. 客户端本地表（v0.5 新增，可选）

为了支持离线好友列表缓存，新增 3 张本地表（**纯缓存**，可重建）：

```sql
-- 好友列表快照
CREATE TABLE IF NOT EXISTS cached_friends (
  user_id TEXT PRIMARY KEY,           -- 服务端 UUID 字符串
  nickname TEXT NOT NULL,
  avatar_seed TEXT NOT NULL,
  friendship_id TEXT NOT NULL,
  last_synced_at TEXT NOT NULL
);

-- 好友今日数字快照
CREATE TABLE IF NOT EXISTS cached_friend_summaries (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  intake_kcal REAL NOT NULL,
  burned_kcal REAL NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);

-- 我发出的/收到的好友请求
CREATE TABLE IF NOT EXISTS cached_friend_requests (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL,            -- 'incoming' | 'outgoing'
  user_id TEXT NOT NULL,              -- 对方 ID
  nickname TEXT NOT NULL,
  avatar_seed TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

**为什么不缓存 meal/exercise 明细**：隐私 + 减少表膨胀 + 好友今日动态永远只读云端最新值即可。

---

## 5. ER 概览

```
users ──< friendships >── users        (requester/addressee 都指向 users.id)
users ──< daily_summaries >── users    (PK = (user_id, date))
```

无第三张表，无 trigger，全部靠应用层 SQL。