# FitLens v0.5 — 后端 API 设计

> 现有后端（v0.4）已实现 `/health` 和 `/recognize/{meal,exercise}`，保持不变。
> v0.5 新增 `/auth/*`、`/friends/*`、`/sync/*` 三组路由，全部用 JWT 鉴权。
> 所有响应统一 JSON 格式：`{ success: true, data: ... }` 或 `{ success: false, error: { code, message } }`。

---

## 1. 全局约定

### 1.1 路由前缀

| 路径前缀 | 说明 | 鉴权 |
|---|---|---|
| `/health` | 健康检查 | 公开 |
| `/recognize/*` | AI 识别（v0.4） | 公开 |
| `/auth/*` | 注册 / 登录 / 我的 | 部分公开 |
| `/friends/*` | 好友相关 | 必须登录 |
| `/sync/*` | 增量同步 | 必须登录 |

### 1.2 鉴权

```
Authorization: Bearer <JWT>
```

JWT 验签在中间件 `requireAuth` 中统一处理；失败返回 401 + code `AUTH_REQUIRED` 或 `AUTH_INVALID`。

### 1.3 错误码

所有错误响应统一为：

```json
{
  "success": false,
  "error": {
    "code": "STRING_CODE",
    "message": "人类可读说明（中文）",
    "details": { /* 可选，字段级错误 */ }
  }
}
```

#### 通用错误码

| HTTP | code | 含义 |
|---|---|---|
| 400 | `INVALID_BODY` | 请求体校验失败（zod 报错，details 含字段错误） |
| 400 | `MISSING_FIELD` | 缺必填字段 |
| 401 | `AUTH_REQUIRED` | 没带 token 或 token 过期 |
| 401 | `AUTH_INVALID` | token 签名错误或被吊销 |
| 403 | `NOT_AUTHORIZED` | 已登录但无权访问（最常见：访问非好友的今日） |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `EMAIL_TAKEN` | 注册时邮箱已存在 |
| 409 | `ALREADY_FRIENDS` | 已是好友或请求 pending 中 |
| 422 | `AI_PARSE_FAILED` | AI 返回非合法 JSON（v0.4 已有） |
| 429 | `RATE_LIMIT` | 触发速率限制 |
| 500 | `INTERNAL` | 服务端未捕获异常 |
| 503 | `DB_UNAVAILABLE` | 数据库连接失败 |

#### 错误返回示例

```json
// 401
{ "success": false, "error": { "code": "AUTH_REQUIRED", "message": "未登录或登录已过期" } }

// 400 zod 校验失败
{
  "success": false,
  "error": {
    "code": "INVALID_BODY",
    "message": "请求参数不合法",
    "details": { "issues": [{ "path": "email", "message": "邮箱格式不正确" }] }
  }
}
```

---

## 2. CORS 收紧

### 2.1 现状

```js
// backend/src/index.js
app.use(cors());  // 任何来源都可访问
```

### 2.2 v0.5 改造

```js
// 仅识别路由对所有来源开放（前端 Web build 用）；
// 其他路由限制为 Render 前端 + 本地开发两个白名单
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // 没 origin 的请求（移动端 / curl）放行
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true); // 兜底：env 未配置时全开（仅 dev）
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
}));

// 更精细：给 /recognize 单独放行
app.use('/recognize', cors({ origin: '*' }), recognizeRouter);
app.use('/auth',     authRouter);     // 受 ALLOWED_ORIGINS 限制
app.use('/friends',  requireAuth, friendsRouter);
app.use('/sync',     requireAuth, syncRouter);
```

### 2.3 Render 环境变量

```yaml
envVars:
  - key: CORS_ALLOWED_ORIGINS
    value: "https://fitlens-xxxx.onrender.com,http://localhost:8081,http://localhost:19006"
```

> 注意：Expo dev server 默认 8081 / 19006，列上避免本地 dev 失败。

---

## 3. JWT 设计

### 3.1 签发

- 库：`jsonwebtoken`
- 算法：HS256
- 密钥：`process.env.JWT_SECRET`（Render 控制台填，**不**写进 render.yaml）
- Payload（**不放 email**，只放 sub 和版本号）：

```json
{
  "sub": "用户 UUID",
  "ver": 1,
  "iat": 1700000000,
  "exp": 1700265600
}
```

**为什么不放 email**：email 是 PII；token 一旦泄露 30 天内全暴露。只放 `sub` 即可识别用户，邮箱通过 `/auth/me` 按需拉。

**`ver` 字段 = 软吊销**：

- users 表加 `token_version INTEGER DEFAULT 0`
- JWT 签发时写入当前 `ver`
- 校验 token 时比对 `token.ver === users.token_version`，不等 → 401 `AUTH_INVALID`
- "退出所有设备"/"修改密码"时 `UPDATE users SET token_version = token_version + 1 WHERE id = $1`
- 所有现存 token 立即失效，无需服务端吊销列表

### 3.2 过期

- **Access token**：有效期 **30 天**（移动端用户体验优先；客户端退出登录会主动销毁本地 token）。
- **Refresh token**：v0.5 **不做**。改用"过期前 7 天内自动用旧 token 换新"——单接口 `POST /auth/refresh`，传旧 access token，服务端若仍在 30 天 ±7 天内就返回新 token；超期则 401 让用户重新登录。
- 理由：少一个存储维度，少一种丢失场景。

### 3.3 吊销（两层机制）

| 机制 | 实现 | 触发场景 |
|---|---|---|
| 客户端登出 | 清 SecureStore token | 用户主动登出 |
| 修改密码 / 退出所有设备 | `token_version++` | 密码泄露 / 设备丢失 |

- **不接受** token 泄露的"主动吊销列表"——用 `token_version` 自增解决。
- 旧 token 失效延迟：<=1 次 DB 查询，毫秒级。

---

## 4. 完整接口列表

### 4.1 /health

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/health` | 公开 | v0.4 已有，返回 `{ ok: true, service }` |

### 4.2 /recognize（v0.4 已有）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/recognize/meal` | 公开 | multipart，AI 食物识别 |
| POST | `/recognize/exercise` | 公开 | multipart，AI 运动识别 |

### 4.3 /auth

#### POST /auth/register

```http
POST /auth/register
Content-Type: application/json

{
  "email": "yang@example.com",
  "password": "P@ssw0rd123",
  "nickname": "阳"
}
```

**校验（zod）**

```ts
email: z.string().email().max(120).transform(s => s.toLowerCase().trim())
password: z.string().min(8).max(72)   // bcrypt 72 字节限制
nickname: z.string().min(2).max(16)
```

**响应 201**

```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "yang@...", "nickname": "阳", "avatarSeed": "abc12345" },
    "token": "eyJhbGci..."
  }
}
```

**错误**

- 409 `EMAIL_TAKEN` — 邮箱已注册
- 400 `INVALID_BODY` — 字段格式错

#### POST /auth/login

```http
POST /auth/login
{ "email": "yang@example.com", "password": "P@ssw0rd123" }
```

**响应 200**

```json
{ "success": true, "data": { "user": {...}, "token": "..." } }
```

**错误**

- 401 `AUTH_INVALID` — 邮箱或密码错（统一文案"邮箱或密码错误"，防枚举）
- 429 `RATE_LIMIT` — 5 次/分钟超限（按 IP + 邮箱双维度）

#### GET /auth/me

```http
GET /auth/me
Authorization: Bearer <JWT>
```

**响应 200**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "yang@...",
    "nickname": "阳",
    "avatarSeed": "abc12345",
    "createdAt": "2026-07-01T...",
    "updatedAt": "2026-07-02T..."
  }
}
```

#### POST /auth/refresh

```http
POST /auth/refresh
Authorization: Bearer <old JWT>
```

服务端校验签名 + 检查 `exp - iat` 时间窗；若原 token 未过期且 `iat > now - 37d`，签发新 30 天 token。

**响应 200**

```json
{ "success": true, "data": { "token": "new..." } }
```

**错误**

- 401 `AUTH_INVALID` — token 已过期或签发太早

#### POST /auth/logout（可选）

v0.5 仅客户端清 token；服务端可不实现，或实现为 no-op 200。

#### DELETE /auth/me — 注销账号

**鉴权**：必须登录。

**行为**

1. 删除当前用户（`users.id = $1`）。
2. 外键 `ON DELETE CASCADE` 顺带删除 `friendships` + `daily_summaries`。
3. `token_version++` 已无需，旧 token 因为用户已删直接 401。

**响应 200**

```json
{ "success": true, "data": { "deleted": true } }
```

**前端联动**：提示用户"本地数据是否保留"，让用户选。**云端一定全清**。

**为什么必须做**：减肥 App 涉及健康/饮食/社交关系数据，用户有"被遗忘权"要求（GDPR、中国《个人信息保护法》第 47 条）。v0.5 必须包含，哪怕简单。

### 4.4 /friends

所有路由必须 `requireAuth`。

#### GET /friends — 我的好友列表

**响应 200**

```json
{
  "success": true,
  "data": [
    { "userId": "uuid", "nickname": "小张", "avatarSeed": "xyz98765", "since": "2026-06-15T..." }
  ]
}
```

#### GET /friends/search?email=<完整邮箱>

**精确邮箱匹配**（`email = LOWER($1)`），最多 1 条；**不返回 email**（防止枚举）。

**为什么不模糊搜**：`email LIKE '%q%' OR nickname ILIKE '%q%'` 容易被人试探"哪些邮箱前缀注册过"。熟人加好友场景下，输入完整邮箱是合理的。

**响应 200**

```json
{
  "success": true,
  "data":
    { "userId": "uuid", "nickname": "阳", "avatarSeed": "abc12345" }
}
```

**找不到**

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "未找到该邮箱对应的用户" } }
```

**注意**

- 自己不返回。
- 已发送请求 / 已是好友 / 被对方屏蔽的记录**仍然显示**（前端根据 status 区分按钮文案）。

#### POST /friends/request — 发起好友请求

```http
{ "targetUserId": "uuid" }
```

**响应 201**

```json
{ "success": true, "data": { "friendshipId": "uuid", "status": "pending" } }
```

**错误**

- 409 `ALREADY_FRIENDS` — 已是好友或已有 pending 请求
- 404 `NOT_FOUND` — 用户不存在
- 403 `NOT_AUTHORIZED` — 被对方屏蔽

#### POST /friends/accept — 接受好友请求

```http
{ "friendshipId": "uuid" }
```

校验：当前用户必须是该 friendship 的 `addressee`，且状态是 pending。

**响应 200**

```json
{ "success": true, "data": { "friendshipId": "uuid", "status": "accepted" } }
```

#### POST /friends/reject — 拒绝

```http
{ "friendshipId": "uuid" }
```

状态置为 `rejected`，记录保留（防重复请求）。

#### POST /friends/block — 屏蔽（v0.5 简单实现）

```http
{ "userId": "uuid" }
```

将对方发起的 pending 置为 blocked；若对方已是 accepted 状态，删关系 + 新增 blocked 记录。

#### GET /friends/requests — 我的待处理请求

**响应 200**

```json
{
  "success": true,
  "data": {
    "incoming": [
      { "friendshipId": "uuid", "userId": "uuid", "nickname": "小李", "avatarSeed": "...", "createdAt": "..." }
    ],
    "outgoing": [
      { "friendshipId": "uuid", "userId": "uuid", "nickname": "小王", "avatarSeed": "...", "createdAt": "...", "status": "pending" }
    ]
  }
}
```

#### GET /friends/:id/today — 好友今日数字（关键隐私端点）

> 路径中 `:id` 是**好友 userId**（不是 friendshipId）。

**鉴权**

1. 当前用户必须登录。
2. 必须存在一条 `accepted` 关系（含双向两种情况）。

**响应 200**

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "nickname": "小张",
    "avatarSeed": "xyz98765",
    "date": "2026-07-02",
    "intakeKcal": 1450,
    "burnedKcal": 320,
    "targetKcal": 1800,            // 可选，缓存计算用
    "updatedAt": "2026-07-02T13:42:11Z"
  }
}
```

**隐私硬性约束**

- 服务端 SQL 只查 `daily_summaries` 一张表。
- 任何查询 `meals / exercises / diaries` 的代码路径在 `/friends/*` 路由里**禁用**。
- 单元测试要覆盖："就算我手动 join 了 meals，也返回 403"。

**错误**

- 403 `NOT_AUTHORIZED` — 不是好友
- 404 `NOT_FOUND` — 该用户今日还没上传过 summary

### 4.5 /sync

#### PUT /sync/daily-summary — 上传/更新今日聚合

```http
PUT /sync/daily-summary
Authorization: Bearer <JWT>

{
  "date": "2026-07-02",
  "intakeKcal": 1450,
  "burnedKcal": 320,
  "targetKcal": 1800
}
```

**行为**

- 同一 `(user_id, date)` upsert。
- 服务端**不校验**数字合理性（用户自己说了算）；只校验非负 + 数值合法。
- 写入后**不需要**通知好友——好友下次打开好友页面拉一次最新即可（v0.5 无推送）。

**响应 200**

```json
{ "success": true, "data": { "date": "2026-07-02", "updatedAt": "..." } }
```

#### GET /sync/pull — 增量拉取（预留，v0.5 不强制实现）

v0.5 仅用 `GET /friends` + `GET /friends/:id/today` 已经够；此端点为未来同步明细用。

---

## 5. 数据流总览

```
[客户端 SQLite]                  [服务端 Postgres]
meals / exercises / diaries  ──(增量)──>  daily_summaries
                                          users
                                          friendships
                                          ↑↓
                              friends list & today summary
```

**隐私关键路径**

- `meals / exercises` 永远不离开设备。
- 服务端只看到聚合数字；前端任何调用 `getFriendDetail` 都不允许传 id 以外参数。

---

## 6. 速率限制

| 端点 | 限制 |
|---|---|
| `/auth/login` | 5 次 / 分钟 / IP |
| `/auth/register` | 3 次 / 小时 / IP |
| `/friends/*` | 60 次 / 分钟 / 用户 |
| `/sync/*` | 120 次 / 分钟 / 用户 |

实现：`express-rate-limit` + Render Postgres 存储（重启不丢计数）。

---

## 7. 测试清单（验收用）

| 用例 | 期望 |
|---|---|
| 注册已存在邮箱 | 409 `EMAIL_TAKEN` |
| 登录密码错 | 401 `AUTH_INVALID`，通用文案 |
| `/auth/me` 不带 token | 401 `AUTH_REQUIRED` |
| `/friends/:id/today` 对方不是好友 | 403 `NOT_AUTHORIZED` |
| `/friends/:id/today` 响应只包含白名单字段 | jest 断言 `Object.keys(data)` ⊆ {userId, nickname, avatarSeed, date, intakeKcal, burnedKcal, targetKcal, updatedAt} |
| `/friends/search` 返回字段不含 email | 断言 |
| `/sync/daily-summary` 收到负数 | 400 `INVALID_BODY` |
| JWT 篡改 | 401 `AUTH_INVALID` |