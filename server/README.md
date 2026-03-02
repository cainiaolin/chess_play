# 中国象棋游戏服务器

基于 Express + Socket.IO + TypeScript 的中国象棋游戏后端服务器。

## 功能特性

- ✅ 完整的中国象棋规则引擎
- ✅ AI 对弈支持 (OpenAI, DeepSeek, 百度文心一言)
- ✅ WebSocket 实时通信
- ✅ 游戏会话管理
- ✅ RESTful API
- ✅ 悔棋功能
- ✅ AI 提示功能

## 技术栈

- **Node.js** - 运行环境
- **Express** - Web 框架
- **Socket.IO** - WebSocket 通信
- **TypeScript** - 类型安全
- **UUID** - 唯一标识符生成

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并配置:

```bash
cp .env.example .env
```

编辑 `.env` 文件,设置你的 API 密钥:

```env
PORT=3000
OPENAI_API_KEY=your_openai_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
QIANFAN_ACCESS_TOKEN=your_qianfan_access_token_here
```

### 3. 启动服务器

开发模式 (支持热重载):

```bash
npm run dev
```

生产模式:

```bash
npm run build
npm start
```

服务器启动后,访问 http://localhost:3000/health 检查状态。

## API 端点

### 健康检查

```
GET /health
```

响应示例:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

### 创建游戏

```
POST /api/game/create
```

请求体:

```json
{
  "redPlayer": {
    "type": "user"
  },
  "blackPlayer": {
    "type": "ai",
    "model": "deepseek"
  }
}
```

响应示例:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "board": [[...]],
    "turn": "red",
    "status": "playing",
    "moves": [],
    "players": {
      "red": { "type": "user" },
      "black": { "type": "ai", "model": "deepseek" }
    },
    "createdAt": 1234567890000,
    "updatedAt": 1234567890000
  }
}
```

### 执行走法

```
POST /api/game/:gameId/move
```

请求体:

```json
{
  "from": { "x": 1, "y": 6 },
  "to": { "x": 1, "y": 5 },
  "player": "red"
}
```

响应示例:

```json
{
  "success": true,
  "data": {
    "move": {
      "from": { "x": 1, "y": 6 },
      "to": { "x": 1, "y": 5 },
      "piece": "p",
      "captured": null,
      "timestamp": 1234567890000
    },
    "aiMove": {
      "from": { "x": 1, "y": 3 },
      "to": { "x": 1, "y": 4 },
      "thinking": "AI思考过程"
    },
    "gameState": { ... }
  }
}
```

### 获取游戏状态

```
GET /api/game/:gameId
```

响应示例:

```json
{
  "success": true,
  "data": {
    "id": "game-id",
    "board": [[...]],
    "turn": "black",
    "status": "playing",
    "moves": [...],
    "players": { ... },
    "createdAt": 1234567890000,
    "updatedAt": 1234567890000
  }
}
```

### 悔棋

```
POST /api/game/:gameId/undo
```

### 获取提示

```
GET /api/game/:gameId/hint
```

### 获取所有游戏

```
GET /api/game
```

### 删除游戏

```
DELETE /api/game/:gameId
```

## WebSocket 事件

### 客户端发送事件

#### 加入游戏

```javascript
socket.emit('game:join', { gameId: 'game-id' });
```

#### 离开游戏

```javascript
socket.emit('game:leave', { gameId: 'game-id' });
```

#### 订阅游戏更新

```javascript
socket.emit('game:subscribe', { gameId: 'game-id' });
```

#### 取消订阅

```javascript
socket.emit('game:unsubscribe', { gameId: 'game-id' });
```

#### 获取游戏状态

```javascript
socket.emit('game:get-state', { gameId: 'game-id' }, (response) => {
  console.log(response);
});
```

### 服务器推送事件

#### 游戏状态更新

```javascript
socket.on('game:state-update', (data) => {
  console.log('Game state updated:', data);
});
```

#### 游戏结束

```javascript
socket.on('game:ended', (data) => {
  console.log('Game ended:', data);
});
```

#### 玩家加入

```javascript
socket.on('game:player-joined', (data) => {
  console.log('Player joined:', data);
});
```

#### 玩家离开

```javascript
socket.on('game:player-left', (data) => {
  console.log('Player left:', data);
});
```

## AI 模型配置

服务器支持以下 AI 提供商:

### OpenAI (GPT-4)

```env
OPENAI_API_KEY=sk-...
```

### DeepSeek

```env
DEEPSEEK_API_KEY=sk-...
```

### 百度文心一言

```env
QIANFAN_ACCESS_TOKEN=your_access_token
```

### 自定义端点

```env
CUSTOM_AI_ENDPOINT=https://your-endpoint.com
CUSTOM_API_KEY=your_key
```

## 项目结构

```
server/
├── src/
│   ├── types/
│   │   └── chess.ts              # 类型定义
│   ├── services/
│   │   ├── chess-engine.ts       # 象棋规则引擎
│   │   ├── ai-adapter.ts         # AI适配器
│   │   └── game-service.ts       # 游戏服务
│   ├── routes/
│   │   └── game.ts               # API路由
│   ├── socket/
│   │   └── game-handler.ts       # WebSocket处理器
│   ├── app.ts                    # Express应用配置
│   └── index.ts                  # 入口文件
├── tests/
│   └── ...                       # 测试文件
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 测试

运行所有测试:

```bash
npm test
```

运行测试并监听变化:

```bash
npm run test:watch
```

生成测试覆盖率报告:

```bash
npm run test:coverage
```

测试 API 端点 (需要先启动服务器):

```bash
node test-server.js
```

## 错误处理

所有 API 错误响应遵循统一格式:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

常见错误代码:

- `MISSING_PLAYER_CONFIG` - 缺少玩家配置
- `MISSING_AI_MODEL` - AI玩家需要指定模型
- `GAME_NOT_FOUND` - 游戏不存在
- `INVALID_GAME_ID` - 无效的游戏ID
- `MOVE_FAILED` - 走法执行失败
- `UNDO_FAILED` - 悔棋失败

## 开发

### 代码风格

项目使用 TypeScript 进行类型检查,确保代码质量。

### 构建生产版本

```bash
npm run build
```

编译后的文件将输出到 `dist/` 目录。

## 许可证

ISC

## 贡献

欢迎提交 Issue 和 Pull Request!
