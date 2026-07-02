# FitLens v0.5 — 前端架构

> 在现有 expo-router + zustand + expo-sqlite 的基础上叠加"账号 + 好友"两个独立域。
> 原则：v0.4 离线体验零回归；网络层是"加法"，不是"改写"。

---

## 1. 路由结构（expo-router）

### 1.1 当前结构

```
src/app/
  _layout.tsx                # Stack 根
  (tabs)/
    _layout.tsx              # Tabs 容器
    index.tsx                # 今日 (Dashboard)
    diary.tsx                # 日记
    profile.tsx              # 我的
  meal/add.tsx               # 记录餐食
  exercise/add.tsx
  exercise/screenshot.tsx
  trend.tsx                  # 7日趋势
```

### 1.2 v0.5 新增结构（增量）

```
src/app/
  (auth)/                    # 新增：未登录分组
    _layout.tsx              # Stack 容器（首次启动显示）
    login.tsx                # 登录
    register.tsx             # 注册
  (tabs)/
    ...（v0.4 不变）
    friends.tsx              # 新增 tab：好友列表
    friend/[id].tsx          # 新增：好友今日详情
  friend/
    search.tsx               # 搜索 + 添加
    requests.tsx             # 收到/发出的请求管理
    qrcode.tsx               # 我的二维码（个人主页进入）
  settings/
    account.tsx              # 新增：账号设置（登出、改昵称）
```

### 1.3 路由改动原则

- **(tabs)** 容器 `_layout.tsx**` 增加一个 `friends` Tab（用 `Users` 图标 lucide-react-native）。
- **根 `_layout.tsx`**：根据 `useAuthStore().token` 是否存在，**重定向**到 `(tabs)` 或 `(auth)`。
  - 注意：expo-router 的 `Redirect` 组件实现首次分流。
- **(auth) 分组**：登录成功后 `router.replace('/(tabs)')`；登出后 `router.replace('/(auth)/login')`。
- **个人主页（profile.tsx）**：增加"我的二维码"、"账号设置"入口按钮（点击进 `/friend/qrcode`、`/settings/account`）。

---

## 2. 状态管理（zustand）

### 2.1 当前

`useAppStore` 持有：profile / meals / exercises / diaries + 各种 action（v0.4 单一大 store）。

### 2.2 v0.5 拆分方案

**不动 useAppStore**；新增 3 个独立 store（slice 模式）：

```
src/store/
  useAppStore.ts            # 既有，本地数据
  useAuthStore.ts           # 新增：token / currentUser
  useFriendsStore.ts        # 新增：好友列表 / 请求 / 今日动态缓存
```

> 拆 slice 而非扩 useAppStore 的理由：账号/好友是云端域，本地数据域保持纯净；方便做"未登录时 useAuthStore 单独可用"。

### 2.3 useAuthStore

```ts
interface AuthState {
  token: string | null;
  currentUser: PublicUser | null;        // { id, email, nickname, avatarSeed }
  bootstrapped: boolean;                  // 启动时已尝试读取本地 token
  bootstrap: () => Promise<void>;         // 启动时从 secureStore 读 token + /auth/me
  login: (email, password) => Promise<void>;
  register: (email, password, nickname) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;          // 快过期时自动续
}

interface PublicUser {
  id: string;
  email: string;
  nickname: string;
  avatarSeed: string;
}
```

**关键**

- `bootstrap()` 在 App 根 `_layout.tsx` 的 useEffect 里启动调用（与 `hydrateFromDb` 并行）。
- `token` 持久化在 `expo-secure-store`，**不**放 zustand 的持久化中间件（密钥库独立）。

### 2.4 useFriendsStore

```ts
interface FriendsState {
  friends: FriendBrief[];                 // 我的好友快照
  incomingRequests: FriendRequest[];      // 收到待处理
  outgoingRequests: FriendRequest[];      // 发出待处理
  todayByFriend: Record<string, FriendTodaySummary>;  // 缓存，key=friendId
  searchResults: FriendBrief[];
  
  loadFriends: () => Promise<void>;
  loadRequests: () => Promise<void>;
  search: (q: string) => Promise<void>;
  sendRequest: (targetUserId: string) => Promise<void>;
  accept: (friendshipId: string) => Promise<void>;
  reject: (friendshipId: string) => Promise<void>;
  loadFriendToday: (friendId: string) => Promise<void>;
  
  // 离线：上次同步时间
  lastSyncedAt: Record<string, string>;
}
```

**缓存策略**

- 好友列表、好友今日数字写入本地 SQLite（见 data-model.md §4 的 `cached_friends` / `cached_friend_summaries`）。
- `lastSyncedAt` 记录每个好友的最近拉取时间，离线时直接读缓存。

### 2.5 useAppStore 改动

- **不需要**改；保留。
- 但 `addMeal` / `addExercise` 后触发"上传今日聚合"的动作封装到一个独立模块 `src/core/sync.ts`：
  ```ts
  // 在 setProfile/addMeal/addExercise/removeMeal/... 之后由 sync.ts 监听
  syncDailySummary(date)
  ```

---

## 3. token 存储 — expo-secure-store

### 3.1 为什么用 secure-store

- iOS Keychain / Android Keystore 加密；
- 不在 AsyncStorage（明文）；
- token 30 天有效，丢了就要重登。

### 3.2 用法

```ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'fitlens.auth.token';
const USER_KEY  = 'fitlens.auth.user';

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE,
  });
}

export async function loadToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(TOKEN_KEY); }
  catch { return null; }
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
```

**注意**

- Web 端 expo-secure-store 退化为 localStorage（仍 OK，开发用）。
- 抛错时（Keychain 不可用）→ 退化为 AsyncStorage + 标记 degraded；UI 弹一次"设备存储不可用，请检查系统设置"。

---

## 4. 网络层改造

### 4.1 当前

`src/api/client.ts` 只封装了两个识别端点；用了裸 `fetch` + AbortController。

### 4.2 v0.5 方案：**不引入 axios**，在现有 client.ts 基础上扩展

理由：
- 项目零额外依赖；
- 现有 fetch + 30s 超时已稳定；
- 新增的 `/auth/*`、`/friends/*` 调用频率低，fetch 性能足够。

### 4.3 改造后的 client.ts 结构

```
src/api/
  client.ts                # 底层 fetchWithAuth（带 token 拦截）
  auth.ts                  # register / login / me / refresh
  friends.ts               # 全部好友相关
  sync.ts                  # daily-summary upsert
  recognition.ts           # 现有 recognize* 抽出来
```

### 4.4 fetchWithAuth 实现要点

```ts
async function fetchWithAuth<T>(
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean; timeoutMs?: number } = { auth: true, timeoutMs: 15000 }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init.headers as any),
  };

  if (opts.auth !== false) {
    const token = useAuthStore.getState().token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  // 401 自动 refresh 一次，重发原请求
  if (res.status === 401 && opts.auth !== false) {
    const ok = await useAuthStore.getState().refresh();
    if (ok) return fetchWithAuth(path, init, opts);
  }

  const json = await res.json();
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(json?.error?.code ?? `HTTP_${res.status}`, json?.error?.message);
  }
  return json.data as T;
}
```

**关键**

- **不静默吞错**：抛 `ApiError` 让上层 UI 区分处理。
- **401 自动续签**一次，避免 30 天到期前用户被频繁踢出。
- **超时 15s**（识别 30s）— 普通 CRUD 15s 足够。

### 4.5 各模块 API 客户端

#### auth.ts（示例）

```ts
export async function login(email: string, password: string) {
  const data = await fetchWithAuth<{ user: PublicUser; token: string }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    { auth: false }
  );
  await saveToken(data.token);
  await saveUser(data.user);
  useAuthStore.setState({ token: data.token, currentUser: data.user });
  return data.user;
}
```

#### friends.ts（关键方法签名）

```ts
listFriends(): Promise<FriendBrief[]>
search(q: string): Promise<FriendBrief[]>
sendRequest(targetUserId: string): Promise<{ friendshipId: string; status: string }>
accept(friendshipId: string): Promise<void>
reject(friendshipId: string): Promise<void>
listRequests(): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>
getToday(friendId: string): Promise<FriendTodaySummary>
```

#### sync.ts

```ts
export async function uploadDailySummary(date: string) {
  const { meals, exercises, profile } = useAppStore.getState();
  const intake = meals.filter(m=>m.date===date).reduce(...)
  const burned = exercises.filter(x=>x.date===date).reduce(...)
  const target = profile ? dailyTargetKcal(profile) : 0;
  await fetchWithAuth('/sync/daily-summary', {
    method: 'PUT',
    body: JSON.stringify({ date, intakeKcal: intake, burnedKcal: burned, targetKcal: target }),
  });
}
```

---

## 5. 关键问题：本地 SQLite → 云端怎么迁？

### 5.1 决策：登录后**增量同步**，不覆盖

**明确否定两种方案**

| 方案 | 否决理由 |
|---|---|
| **每次写都双写** | 离线场景无网络；网络抖动时本地写会失败，影响 v0.4 体验 |
| **登录时一次性全量上传 meal/exercise 明细** | 隐私第一原则不允许明细离开设备 |

### 5.2 选定的方案：登录后只同步 daily_summaries

```
[登录成功]
   ↓
[useAppStore.getState() 拿到本地所有数据]
   ↓
[遍历最近 90 天的 date，调用 uploadDailySummary(date)]
   ↓
[服务端 upsert 到 daily_summaries]
   ↓
[完成]
```

**频率**

- 登录成功后跑一次"过去 90 天回填"。
- 此后每次 `addMeal` / `removeMeal` / `addExercise` / `removeExercise` / `setProfile` 后 30 秒内自动上传**今日**那一条（去抖）。
- App 进入前台时上传一次今日（catch-up）。

**失败处理**

- 网络失败 → 写入 `pendingSync` 队列（本地 SQLite 一张小表），下次联网重试。
- 永不上传 meal/exercise 明细。

### 5.3 离线优先还是在线优先？

**离线优先**（明确）。

| 场景 | 行为 |
|---|---|
| 未登录 | 本地 SQLite 完全独立工作（v0.4 行为） |
| 已登录离线 | 本地 SQLite 写、读、洞察计算、趋势全正常；好友页面显示"上次同步 5 分钟前"的缓存值 |
| 已登录在线 | 本地写入 + 后台异步上传今日聚合；好友数据按需拉取 |
| 已登录但服务端挂 | 降级为离线模式；banner 显示"好友动态暂时不可用" |

### 5.4 冲突解决

- 同一日期在两台设备都记了不同数据 → 服务端**保留后写入者**（按 updated_at）。
- 用户从 A 设备切到 B 设备：B 设备启动后**只读**云端聚合显示在好友那边，自己看的是 B 本地的明细。
- 不做服务端反向覆盖本地（避免本地数据被远端意外清空）。

---

## 6. UI 组件复用

| 已有 | v0.5 复用 |
|---|---|
| `Card` | 好友卡、请求卡、设置卡 |
| `theme` (colors/spacing/radius/fontSizes) | 全部新页面 |
| `useSafeAreaInsets` | 所有新页面 |
| `lucide-react-native` 图标 | Users / UserPlus / QrCode / LogOut |
| 现有 form 风格（TextInput + Card 包裹） | 登录 / 注册表单 |
| `getDailySummary` / `buildBudgetInsight` | 不复用（好友的 summary 不一样） |

**新增小组件**

- `Avatar` — 根据 `avatarSeed` 渲染色块 + 昵称首字母
- `FriendCard` — 好友列表项
- `RequestRow` — 接受/拒绝行
- `PinButton` — 给好友加油按钮（带动画）

---

## 7. 启动顺序（v0.5）

```ts
// src/app/_layout.tsx
useEffect(() => {
  (async () => {
    await initDb();                       // 本地 DB
    await useAppStore.getState().hydrateFromDb();
    await useAuthStore.getState().bootstrap();   // 读 secureStore token + /auth/me
    setBootDone(true);
  })();
}, []);

if (!bootDone) return <SplashScreen />;
return (
  useAuthStore.getState().token
    ? <Redirect href="/(tabs)" />
    : <Redirect href="/(auth)/login" />
);
```

---

## 8. 依赖新增

```json
{
  "expo-secure-store": "56.0.x",
  "expo-qr-code"  // 或 react-native-qrcode-svg 0.x
}
```

不引入 axios、react-query（zustand 自己管状态）、zustand-persist（用 SecureStore 替代）。