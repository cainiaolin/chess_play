# 中国象棋游戏

基于 Vue 3 + Express + Socket.IO 的在线中国象棋游戏，支持人机对战和双人对弈。

## 项目结构

```
chess_play_web/
├── frontend/          # Vue 3 前端 (Vite)
│   ├── src/
│   │   ├── components/   # 棋盘、控制面板等组件
│   │   ├── pages/        # 游戏页面、观战页面、设置页面
│   │   ├── stores/       # Pinia 状态管理
│   │   └── utils/        # API 工具
│   └── package.json
│
└── server/            # Express 后端
    ├── src/
    │   ├── services/     # 游戏服务、AI 适配器、棋引擎
    │   ├── routes/       # API 路由
    │   ├── types/        # TypeScript 类型定义
    │   └── app.ts        # 应用入口
    └── package.json
```

## 快速启动

### 前置要求

- Node.js >= 18
- npm 或 pnpm

### 安装依赖

```bash
# 安装前端依赖
cd frontend
npm install

# 安装后端依赖
cd ../server
npm install
```

### 启动服务

需要同时启动前端和后端服务：

**方式一：分别启动（推荐用于开发）**

```bash
# 终端 1 - 启动前端 (http://localhost:5173)
cd frontend
npm run dev

# 终端 2 - 启动后端 (http://localhost:3001)
cd server
npm run dev
```

**方式二：Windows 批处理（同时启动）**

创建 `start.bat` 文件：

```batch
@echo off
start "Frontend" cmd /k "cd frontend && npm run dev"
start "Server" cmd /k "cd server && npm run dev"
```

**方式三：使用包管理工具**

```bash
# 使用 npm-workspace（需要配置）
npm run dev
```

### 访问应用

启动成功后，访问以下地址：

| 服务 | 地址 | 说明 |
|------|------|------|
| 游戏主页 | http://localhost:5173/ | 开始游戏 |
| 观战页面 | http://localhost:5173/spectate.html | 观看对局 |
| 设置页面 | http://localhost:5173/settings.html | 游戏设置 |
| 后端 API | http://localhost:3001/api/game | API 端点 |
| 健康检查 | http://localhost:3001/health | 服务状态 |

## 其他命令

```bash
# 前端构建生产版本
cd frontend
npm run build

# 后端构建 TypeScript
cd server
npm run build

# 后端生产环境启动
cd server
npm start

# 运行测试
cd server
npm test
```

## 功能特性

- 完整的中国象棋规则实现
- 双人对弈模式
- AI 对战（支持多种 AI 模型）
- 实时观战功能
- 游戏计时器
- 悔棋功能
- 走法提示

## 常见问题

**端口被占用：**
```bash
# Windows 查找占用端口的进程
netstat -ano | findstr ":5173"
netstat -ano | findstr ":3001"

# 终止进程
taskkill /F /PID <进程ID>
```

**依赖安装失败：**
尝试清除缓存后重装：
```bash
rm -rf node_modules package-lock.json
npm install
```
