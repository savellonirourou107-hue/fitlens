# FitLens v0.5 后端部署文档

> 本文档教你把 FitLens v0.5 后端部署到 **Render**（免费 plan）+ **Neon Postgres**（免费 plan），全程不花一分钱。

---

## 0. 部署前清单

- [ ] GitHub 仓库已有 v0.5 代码（已 commit + push）
- [ ] Neon 账号：https://neon.tech（GitHub 登录）
- [ ] Render 账号：https://render.com（GitHub 登录）
- [ ] MiniMax API key（如果还没有，去 https://api.minimaxi.com 申请）

---

## 1. 在 Neon 创建免费 Postgres 数据库

### 1.1 创建项目

1. 打开 https://console.neon.tech
2. 登录后点 **"Create a project"**
3. 配置：
   - **Name**: `fitlens`
   - **Region**: `Singapore (ap-southeast-1)`（离 Render 新加坡近）
   - **Postgres version**: 16（默认）
4. 点 **Create Project**

### 1.2 获取连接串

1. 项目创建后会自动跳转到 Dashboard
2. 在 **Connection Details** 面板，找到 **"Connection string"** 区域
3. 选择 **"Pooled connection"**（这个是 neon 推荐给 serverless 用的）
4. 形如：
   ```
   postgresql://neondb_owner:AbCdEf123456@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
5. **点 "Copy"**，整串保存到记事本（下一步要填到 Render）

> 💡 **不要 commit 这个串到 git**！这是数据库密码。

---

## 2. 在 Render 部署 Web Service

### 2.1 创建 Blueprint 部署

1. 打开 https://dashboard.render.com
2. 点 **"New +"** → **"Blueprint"**
3. 选你的 GitHub 仓库 `savellonirourou107-hue/fitlens`
4. Render 会读 `render.yaml` 自动识别
5. **Group name** 填 `fitlens`
6. 点 **"Apply"**

### 2.2 配置环境变量（关键）

部署前 Render 会让你确认环境变量。**这些值必须手动填**，render.yaml 里没有真实密钥：

| Key | Value | 说明 |
|---|---|---|
| `DATABASE_URL` | 粘贴你刚才从 Neon 复制的连接串 | 必须含 `?sslmode=require` |
| `JWT_SECRET` | 见下方生成 | 64 字符随机 |
| `MINIMAX_API_KEY` | 你的 MiniMax key | 中国区 key |
| `CORS_ALLOWED_ORIGINS` | 暂时留默认即可 | 部署完再改 |

**生成 JWT_SECRET**（在 PowerShell 里跑）：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

会输出 64 个随机字符，复制整个粘贴到 `JWT_SECRET`。

点 **"Apply"** 开始第一次部署。

### 2.3 等部署完成

- 看 Logs 面板
- 第一次会跑 `npm install && npm run migrate`
- migrate 成功会显示 `✅ All migrations applied successfully.`
- 然后 `node src/index.js` 启动
- 看到 `FitLens backend on http://localhost:10000` 说明启动成功（Render 端口是 10000）

### 2.4 拿到你的服务 URL

部署成功后会分配 URL：
```
https://fitlens-backend-xxxx.onrender.com
```

复制这个，下面测试用。

---

## 3. 本地测试后端

如果你想在本地先验证后端跑得通，再让 Render 部署：

### 3.1 创建 .env 文件

`backend/.env`：
```bash
DATABASE_URL=postgresql://neondb_owner:xxxxx@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=本地测试用随便填一个64字符
MINIMAX_API_KEY=eyJxxxxx
CORS_ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

### 3.2 跑迁移

```bash
cd backend
npm install
npm run migrate
```

看到 `✅ All migrations applied successfully.` 表示表建好了。

### 3.3 启动服务

```bash
npm run dev
```

应该看到：
```
FitLens backend on http://localhost:4000
```

---

## 4. 验收清单 + curl 测试命令

**所有命令替换 `<BASE>` 为你的服务 URL**：
- 本地：`http://localhost:4000`
- 部署：`https://fitlens-backend-xxxx.onrender.com`

### ✅ 4.1 健康检查

```bash
curl <BASE>/health
```

期望：
```json
{ "ok": true, "service": "fitlens-backend" }
```

### ✅ 4.2 注册用户 A

```bash
curl -X POST <BASE>/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"AlicePass123","nickname":"小爱"}'
```

期望 201：
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "alice@example.com", "nickname": "小爱", "avatarSeed": "..." },
    "token": "eyJ..."
  }
}
```

**保存返回的 token 和 user.id**（后面用）：
```bash
export TOKEN_A="eyJ..."
export USER_A_ID="<uuid>"
```

### ✅ 4.3 注册用户 B（用另一个邮箱）

```bash
curl -X POST <BASE>/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"BobPass456","nickname":"小波"}'
```

```bash
export TOKEN_B="eyJ..."
export USER_B_ID="<uuid>"
```

### ✅ 4.4 登录

```bash
curl -X POST <BASE>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"AlicePass123"}'
```

期望 200 + 新 token。

### ✅ 4.5 /auth/me（用 token）

```bash
curl <BASE>/auth/me -H "Authorization: Bearer $TOKEN_A"
```

期望 200 + 用户信息（id, email, nickname, avatarSeed, createdAt, updatedAt）。

### ✅ 4.6 上传今日聚合

```bash
TODAY=$(date +%Y-%m-%d)
curl -X PUT <BASE>/sync/daily-summary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"date\":\"$TODAY\",\"intakeKcal\":1450,\"burnedKcal\":320,\"targetKcal\":1800}"
```

期望 200：
```json
{ "success": true, "data": { "date": "2026-07-02", "updatedAt": "..." } }
```

### ✅ 4.7 /sync/daily-summary 读回

```bash
curl "<BASE>/sync/daily-summary?date=$TODAY" -H "Authorization: Bearer $TOKEN_A"
```

期望 200 + 4.6 上传的数字。

### ✅ 4.8 B 搜索 A（精确邮箱）

```bash
curl "<BASE>/friends/search?email=alice@example.com" \
  -H "Authorization: Bearer $TOKEN_B"
```

期望 200：
```json
{
  "success": true,
  "data": { "userId": "<USER_A_ID>", "nickname": "小爱", "avatarSeed": "..." }
}
```

**确认响应里没有 `email` 字段**（隐私硬约束）。

### ✅ 4.9 B 向 A 发好友请求

```bash
curl -X POST <BASE>/friends/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d "{\"targetUserId\":\"$USER_A_ID\"}"
```

期望 201 + friendshipId。

**保存 friendshipId**：
```bash
export FR_ID="<friendshipId>"
```

### ✅ 4.10 B 重复发请求（应被拒）

```bash
curl -X POST <BASE>/friends/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d "{\"targetUserId\":\"$USER_A_ID\"}"
```

期望 409 `ALREADY_FRIENDS`。

### ✅ 4.11 A 接受好友请求

```bash
curl -X POST <BASE>/friends/accept \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"friendshipId\":\"$FR_ID\"}"
```

期望 200 + status: accepted。

### ✅ 4.12 A 上传自己的今日数字

```bash
curl -X PUT <BASE>/sync/daily-summary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"date\":\"$TODAY\",\"intakeKcal\":1500,\"burnedKcal\":200,\"targetKcal\":1700}"
```

### ✅ 4.13 B 查 A 的今日数字

```bash
curl "<BASE>/friends/$USER_A_ID/today" -H "Authorization: Bearer $TOKEN_B"
```

期望 200 + **只有以下字段**：
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "nickname": "小爱",
    "avatarSeed": "...",
    "date": "2026-07-02",
    "intakeKcal": 1500,
    "burnedKcal": 200,
    "targetKcal": 1700,
    "updatedAt": "..."
  }
}
```

**关键：响应不应包含 `weightKg`、`bmi`、`meals`、`foodItems` 等任何明细字段**。

### ✅ 4.14 非好友查今日（应被拒）

用第三个用户 C 给 B 发请求但没接受，B 查 C ：

```bash
# 先注册 C
TOKEN_C=$(curl -X POST <BASE>/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"charlie@example.com","password":"CharliePass789","nickname":"小C"}' \
  | jq -r .data.token)
USER_C_ID=$(...)

# B 查 C 的今日（不是好友）
curl "<BASE>/friends/$USER_C_ID/today" -H "Authorization: Bearer $TOKEN_B"
```

期望 403 `NOT_AUTHORIZED`。

### ✅ 4.15 拒绝后再次发请求 → 应走 UPDATE

```bash
# 1. C 向 A 发请求
FR2=$(curl -X POST <BASE>/friends/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_C" \
  -d "{\"targetUserId\":\"$USER_A_ID\"}" | jq -r .data.friendshipId)

# 2. A 拒绝
curl -X POST <BASE>/friends/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"friendshipId\":\"$FR2\"}"

# 3. C 再发请求（应该成功 → UPDATE 而非 INSERT）
curl -X POST <BASE>/friends/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_C" \
  -d "{\"targetUserId\":\"$USER_A_ID\"}"
```

期望 201 + status: pending（friendshipId 应和第一次相同，因为是 UPDATE）。

### ✅ 4.16 注销账号

```bash
curl -X DELETE <BASE>/auth/me -H "Authorization: Bearer $TOKEN_C"
```

期望 200 + `{ "deleted": true }`。

**验证**：再用 TOKEN_C 调 `/auth/me` 应该 401。

---

## 5. 常见问题

### Q1: `npm run migrate` 报 "No database connection string"

检查 `DATABASE_URL` 环境变量是否设置。Windows PowerShell：
```powershell
$env:DATABASE_URL = "postgresql://..."
npm run migrate
```

### Q2: Render 部署后 `/health` 返回 503

去 Render Logs 看启动日志：
- 没看到 `FitLens backend on http://...` → `DATABASE_URL` 配错或 `JWT_SECRET` 没配
- 看到 "CORS blocked" → `CORS_ALLOWED_ORIGINS` 没包含你访问的 origin

### Q3: `ECONNREFUSED` 错误

Render 部署 15 分钟没流量会自动休眠。**第一次访问会慢 30-50 秒**（冷启动），这是正常现象。

### Q4: 注册返回 500 "INTERNAL"

去 Render Logs 看堆栈。常见原因：
- `bcryptjs` 没装好
- Neon 数据库满了（free 0.5GB）

### Q5: JWT 一直 401

- 检查 `JWT_SECRET` 在 Render 上是否设置
- 如果本地能跑、部署不能跑，**99% 是 Render 没设 `JWT_SECRET`**
- 在 Render Dashboard → Environment → "Sync" 一下手动设的环境变量

---

## 6. 安全检查清单

部署后**逐项确认**：

- [ ] `DATABASE_URL` 没有 commit 到 git（`git log` 搜一下）
- [ ] `JWT_SECRET` 没有 commit 到 git
- [ ] `MINIMAX_API_KEY` 没有 commit 到 git
- [ ] `render.yaml` 里没有真实密钥（只有 `sync: false` 的占位）
- [ ] Neon 数据库 Dashboard 打开了 **"IP Allow List"** 默认（Neon 默认开）
- [ ] Render Web Service 打开了 **"Auto-Deploy: Yes"** 但敏感环境变量用 Sync 而不是 commit

---

## 7. 部署后给同学用

部署成功后：
1. 把 `https://fitlens-backend-xxxx.onrender.com` 这个 URL 发给同学
2. 同学先用 `/auth/register` 注册
3. 互相加好友（一个发 `/friends/request`，一个 `/friends/accept`）
4. 上传自己的 `/sync/daily-summary`
5. 互相看 `/friends/:id/today`

**隐私边界再次强调**：好友只能看到今日摄入/消耗两个数字，**绝对看不到**吃了什么、体重、身高、BMI。

---

## 8. 监控 & 维护

### 看 Render 日志
https://dashboard.render.com → fitlens-backend → Logs

### 看 Neon 慢查询
https://console.neon.tech → 项目 → Monitoring

### 重启 Render 服务
Render Dashboard → fitlens-backend → Manual Deploy → "Clear build cache & deploy"

### 数据库备份
Neon 免费 plan 提供 **7 天 point-in-time recovery**。超出需付费 plan。
