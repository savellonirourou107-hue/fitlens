# FitLens — 减肥热量记录 App

拍照识别餐食热量 · 运动截图识别消耗 · 每日热量缺口追踪 · 7 日趋势 · 心情日记

## 技术栈

**前端**（Expo React Native + TypeScript）
- expo-router · expo-sqlite · expo-image-picker · zustand · zod · react-native-chart-kit · react-native-svg

**后端**（Node.js Express）
- 调用 MiniMax-M3 视觉模型识别餐食 / 运动截图
- multer 接收图片 · zod 校验所有 AI 返回
- API Key 只在后端，前端不接触

## 本地开发

```bash
# 前端
cd FitLens
npm install
npm start          # Expo 开发服务器

# 后端
cd FitLens/backend
npm install
cp .env.example .env   # 填入 MINIMAX_API_KEY
npm start              # http://localhost:4000
```

## 部署

### 后端 → Render

1. 推送到 GitHub
2. Render 新建 Web Service，连接该仓库，`rootDir: backend`，Build `npm install`，Start `node src/index.js`
3. 环境变量设 `MINIMAX_API_KEY`（其余见 `render.yaml`）
4. 得到 `https://fitlens-backend.onrender.com`

### 前端 APK → EAS

```bash
npm install -g eas-cli
eas login                    # expo.dev 账号
eas build:configure
eas build --platform android --profile preview
```

构建完成下载 `.apk` 即可分发安装。

## 目录

```
FitLens/
├─ src/
│  ├─ app/              # expo-router 页面
│  ├─ components/       # 卡片、环形进度、营养素甜甜圈
│  ├─ core/             # 纯计算函数 + SQLite + id
│  ├─ store/            # zustand 全局状态
│  ├─ schemas/          # zod 校验
│  ├─ theme/            # 主题
│  ├─ types/            # 类型定义
│  └─ api/              # 后端客户端
├─ backend/             # Express 后端
├─ eas.json             # EAS 构建
├─ render.yaml          # Render 部署
└─ app.json
```
