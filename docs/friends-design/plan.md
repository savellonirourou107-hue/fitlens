# FitLens v0.5 — 实施计划

> 5 个阶段，每阶段独立可发版。
> 顺序：基础设施 → 鉴权 → 好友关系 → 好友动态 → 同步与离线收尾。
> 预估总时长：**约 16-20 个工作日**（单人，业余时间）。

---

## 阶段总览

| 阶段 | 名称 | 估时 | 风险 |
|---|---|---|---|
| **P1** | 后端基础设施（DB + 鉴权） | 4 天 | 中 |
| **P2** | 前端账号 + 登录注册 UI | 2 天 | 低 |
| **P3** | 好友关系（搜索 / 请求 / 接受） | 3 天 | 中 |
| **P4** | 好友今日动态（核心隐私端点） | 3 天 | **高** |
| **P5** | 增量同步 + 离线收尾 | 4 天 | **高** |

**最长阶段**：P5（同步与离线），预估 4 天，是整个 v0.5 的难点收尾。

---

## P1 — 后端基础设施（DB + 鉴权） · 4 天

### 目标
部署 Render Postgres + Express 增加 `/auth/*` 三个端点 + JWT 中间件 + CORS 收紧；本地无任何前端改动。

### 改动文件

**新增**

```
backend/
  migrations/
    001_create_users.sql
    002_create_friendships.sql
    003_create_daily_summaries.sql
  src/
    db.js                          # pg pool 单例
    middleware/
      requireAuth.js
      rateLimit.js
      errorHandler.js
    routes/
      auth.js                      # register / login / me / refresh
    services/
      jwt.js
      password.js                  # bcrypt 封装
    schemas/
      auth.js                      # zod 校验
```

**修改**

- `backend/src/index.js`：CORS 白名单化；挂载 `/auth`、errorHandler
- `render.yaml`：加 Postgres 服务 + `DATABASE_URL` env；加 `JWT_SECRET` 占位

### 验收标准

- [ ] Render Postgres 创建成功，`npm run migrate` 跑通
- [ ] `POST /auth/register` 201；重复邮箱 → 409 EMAIL_TAKEN
- [ ] `POST /auth/login` 200 返回 JWT；密码错 → 401 AUTH_INVALID（统一文案）
- [ ] `GET /auth/me` 带 token → 200；不带 → 401 AUTH_REQUIRED
- [ ] 篡改 token → 401 AUTH_INVALID
- [ ] `/recognize/*` 仍对所有 origin 开放（不被 CORS 拦截）
- [ ] 速率限制：login 5/min/IP 触发 429

### 风险

- Render 免费 Postgres 冷启动延迟 → 加连接池 + `idle_timeout` 兜底。
- bcrypt 在 Render free plan 性能一般 → cost 12 可接受，不调高。

---

## P2 — 前端账号 + 登录注册 UI · 2 天

### 目标
加入 `(auth)` 分组 + `useAuthStore` + `expo-secure-store` 存储 token + 根 layout 启动分流。

### 改动文件

**新增**

```
src/store/useAuthStore.ts
src/api/auth.ts
src/api/client.ts                 # 重构为 fetchWithAuth + 自动 401 续签
src/app/(auth)/_layout.tsx
src/app/(auth)/login.tsx
src/app/(auth)/register.tsx
src/app/settings/account.tsx      # 登出按钮
src/components/Avatar.tsx         # 色块头像
src/api/storage/secureStore.ts    # SecureStore 封装 + 降级
```

**修改**

- `src/app/_layout.tsx`：先 `initDb` → `hydrateFromDb` → `bootstrap auth`；根据 token 渲染 `(tabs)` 或 `(auth)`
- `package.json`：加 `expo-secure-store`

### 验收标准

- [ ] 未登录启动 → 看到 login 页
- [ ] 注册成功后自动跳 `(tabs)`，token 已写入 secure store
- [ ] 杀掉 App 重启 → 仍然在 `(tabs)`，不用再登录
- [ ] 主动"退出登录" → 回到 login 页，本地 token 清空
- [ ] `/auth/me` 失败时 `fetchWithAuth` 走 refresh 一次仍失败则跳 login

### 风险

- SecureStore 在 Web 不可用 → 加退化路径（AsyncStorage + 提示横幅），dev 不阻塞
- expo-router 的 `(auth)` 分组 vs `(tabs)` 重定向顺序 → 用 `Redirect` 组件条件渲染

---

## P3 — 好友关系（搜索 / 请求 / 接受 / 拒绝） · 3 天

### 目标
后端 `/friends/*` 全部端点 + 前端搜索/请求/接受/拒绝 UI + 好友列表 tab。

### 改动文件

**新增（后端）**

```
backend/src/routes/friends.js
backend/src/services/friendship.js   # 状态机封装
```

**新增（前端）**

```
src/store/useFriendsStore.ts
src/api/friends.ts
src/app/(tabs)/friends.tsx          # 新 tab
src/app/friend/search.tsx
src/app/friend/requests.tsx
src/components/FriendCard.tsx
src/components/RequestRow.tsx
src/components/SearchResultRow.tsx
```

**修改**

- `src/app/(tabs)/_layout.tsx`：新增 `friends` Tab + `Users` 图标
- `src/app/(tabs)/profile.tsx`：加"我的好友 (N)"入口 + 头像

### 验收标准

- [ ] 搜索邮箱命中已注册用户 → 显示结果
- [ ] 发送请求 → 对方 pending 列表显示
- [ ] 接受后双方好友列表同步出现
- [ ] 重复发请求 → 409 ALREADY_FRIENDS
- [ ] 搜索结果不返回 email 字段（接口断言）
- [ ] 拒绝后对方再发请求可以成功（不像 blocked 那样死锁）
- [ ] blocked 路径走通：A 屏蔽 B 后，B 搜不到 A、给 A 发请求 → 403

### 风险

- 双向关系 vs 单向请求的语义模糊 → 在 friendship service 层统一"已接受 = 互看"，单元测试覆盖
- 搜索结果隐私 → 字段白名单写在 service 层，避免 router 忘记 filter

---

## P4 — 好友今日动态（核心隐私端点） · 3 天

### 目标
后端 `/friends/:id/today` + 前端好友详情页 + 加油按钮；**严格确保任何非聚合字段绝不被返回**。

### 改动文件

**新增（后端）**

```
backend/src/routes/friendToday.js      # 实际挂在 /friends 下
backend/src/services/friendSummary.js  # 只查 daily_summaries
```

**新增（前端）**

```
src/app/friend/[id].tsx
src/components/FriendSummaryCard.tsx
src/components/PinButton.tsx
```

**修改**

- `src/api/friends.ts`：加 `getToday(friendId)` + `pin(friendId)`
- `src/store/useFriendsStore.ts`：加 `loadFriendToday` + 缓存
- `src/core/db.ts` + `src/core/repository.ts`：加 `cached_friends` / `cached_friend_summaries` / `cached_friend_requests` 三张本地表

### 验收标准

- [ ] `/friends/:id/today` 字段白名单测试通过（jest 断言 Object.keys ⊆ 白名单集合）
- [ ] 非好友访问 → 403 NOT_AUTHORIZED
- [ ] 好友今日还没上传 → 404 NOT_FOUND（前端显示"对方还未记录"）
- [ ] 加油按钮乐观更新 + 失败回滚
- [ ] 详情页**没有任何** UI 入口能看到对方吃了什么
- [ ] 单元测试 / e2e 模拟"假装服务端返回了明细"，前端必须拒绝显示

### 风险 ⭐ 最关键

- **隐私泄露**：服务端如果不小心 join 了 meals/exercises，会把食物名带回来。
  - 缓解：在 `friendSummary` service 里**只允许单表查询**（`daily_summaries`），代码 review 强约束。
  - 缓解：写一个 lint 规则禁止 `/friends/*` 文件里出现 `meals` / `exercises` 关键字（用 ESLint `no-restricted-imports` 或自定义 grep）。

---

## P5 — 增量同步 + 离线收尾 · 4 天

### 目标
登录后回填过去 90 天 daily_summaries + 写后异步上传今日 + 离线缓存 + 端到端联调。

### 改动文件

**新增**

```
src/core/sync.ts                    # uploadDailySummary + 去抖队列
src/core/pendingSyncQueue.ts        # 本地 SQLite 持久化重试队列
src/core/repository.ts              # 加 queue CRUD
src/app/_layout.tsx                 # AppState 'change' 监听
```

**修改**

- `src/store/useAppStore.ts`：`addMeal` / `removeMeal` / `addExercise` / `removeExercise` / `setProfile` 末尾触发 `scheduleSync(date)`（不破坏既有逻辑，仅追加副作用）
- `src/store/useAuthStore.ts`：登录成功后触发 `runInitialBackfill()`
- `src/core/db.ts`：加 `pending_sync` 表
- `render.yaml`：上线新版本 + 改 build command（`npm run migrate && npm install`）

### 验收标准

- [ ] 新注册用户登录后，过去 90 天 daily_summaries 自动写入服务端（DB 直查确认）
- [ ] 添加一餐 30 秒内服务端 daily_summaries 更新
- [ ] 飞行模式添加一餐 → 联网后 5 秒内同步成功
- [ ] 服务端宕机期间写入排队，重启后自动重试
- [ ] 切到新设备登录：本地为空 + 服务端有数据 → 显示"上次同步 ..."的缓存
- [ ] 7 日趋势 / 洞察 / 日记全部仍纯本地计算（v0.4 零回归）

### 风险 ⭐

- **同步死锁**：本地写完 → 30s 上传失败 → 队列重试 → 服务端拒 → 死循环。
  - 缓解：失败 3 次后暂停 5 分钟；显示 banner 让用户手动重试。
- **本地与服务端数字不一致**：用户改目标体重后 target_kcal 不一致。
  - 缓解：profile 改动时强制上传当日 target_kcal；不试图合并。
- **后台保活**：iOS 后台 30 秒限制 → 上传走 foreground 触发 + AppState change，不依赖后台任务。
- **多人同设备切换登出/登入**：上一个用户的数据不被下一个用户看到 → 登出时清空 `cached_friends` 表（不动本地 meals/exercises/profile，那是设备级数据）。

---

## 全局风险清单（最可能出问题的 3 点）

| 排名 | 风险 | 影响 | 缓解 |
|---|---|---|---|
| 1 | **隐私泄露**：好友请求 `/friends/:id/today` 误返回明细 | 致命：产品信任崩塌 | service 层只允许查 daily_summaries；ESLint 禁词；字段白名单单测；e2e 抓包回归 |
| 2 | **离线同步死锁 / 数据漂移**：本地写 + 云端拒 → 用户看到陈旧数据 | 高：好友那边看不到最新 | 30s 去抖 + 3 次重试 + banner 提示；写后强制 catch-up；不静默失败 |
| 3 | **CORS 收紧误伤本地 dev / EAS build**：移动端 origin 为 null 时被拒 | 中：本地开发全挂 | `/recognize/*` 单独放行 `*`；`/auth/*`、`/friends/*` 白名单含 `localhost:8081` + Expo Go |

---

## 部署节奏

| 阶段 | 上线动作 |
|---|---|
| P1 完成后 | Render 部署新版后端，前端零改动；自测 `/auth/*` |
| P2 完成后 | EAS build preview 版（仅自己） |
| P3 完成后 | EAS preview 给室友 1-2 人内测 |
| P4 完成后 | 内测继续；隐私 e2e 全跑一遍 |
| P5 完成后 | 全量内测 1 周 → 提交 App Store / Google Play |

---

## 文档交付物清单

| 阶段交付 | 内容 |
|---|---|
| P1 | API.md §1-3 实现 |
| P2 | UI 流程 login/register 截图 |
| P3 | 好友模块 demo 录屏 |
| P4 | **隐私 e2e 测试报告**（最重要交付物） |
| P5 | 同步矩阵 + 离线场景录屏 |