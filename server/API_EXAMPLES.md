# API 使用示例

本文档提供了中国象棋游戏服务器的详细使用示例。

## 目录

- [REST API 示例](#rest-api-示例)
- [WebSocket 示例](#websocket-示例)
- [完整游戏流程](#完整游戏流程)

## REST API 示例

### 1. 健康检查

```bash
curl http://localhost:3000/health
```

响应:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

### 2. 创建用户对用户游戏

```bash
curl -X POST http://localhost:3000/api/game/create \
  -H "Content-Type: application/json" \
  -d '{
    "redPlayer": { "type": "user" },
    "blackPlayer": { "type": "user" }
  }'
```

### 3. 创建用户对AI游戏

```bash
curl -X POST http://localhost:3000/api/game/create \
  -H "Content-Type: application/json" \
  -d '{
    "redPlayer": { "type": "user" },
    "blackPlayer": { "type": "ai", "model": "deepseek" }
  }'
```

### 4. 创建AI对AI游戏

```bash
curl -X POST http://localhost:3000/api/game/create \
  -H "Content-Type: application/json" \
  -d '{
    "redPlayer": { "type": "ai", "model": "openai" },
    "blackPlayer": { "type": "ai", "model": "deepseek" }
  }'
```

### 5. 获取游戏状态

```bash
curl http://localhost:3000/api/game/GAME_ID
```

### 6. 执行走法

红方兵前进 (1,6) -> (1,5):

```bash
curl -X POST http://localhost:3000/api/game/GAME_ID/move \
  -H "Content-Type: application/json" \
  -d '{
    "from": { "x": 1, "y": 6 },
    "to": { "x": 1, "y": 5 },
    "player": "red"
  }'
```

### 7. 悔棋

```bash
curl -X POST http://localhost:3000/api/game/GAME_ID/undo
```

### 8. 获取AI提示

```bash
curl http://localhost:3000/api/game/GAME_ID/hint
```

### 9. 获取所有游戏列表

```bash
curl http://localhost:3000/api/game
```

### 10. 删除游戏

```bash
curl -X DELETE http://localhost:3000/api/game/GAME_ID
```

## WebSocket 示例

### JavaScript 客户端

```html
<!DOCTYPE html>
<html>
<head>
  <title>中国象棋 - WebSocket示例</title>
  <script src="https://cdn.socket.io/4.8.3/socket.io.min.js"></script>
</head>
<body>
  <h1>中国象棋游戏</h1>
  <div id="status">未连接</div>
  <div id="game-board"></div>

  <script>
    const socket = io('http://localhost:3000');
    let currentGameId = null;

    // 连接成功
    socket.on('connect', () => {
      document.getElementById('status').textContent = '已连接';
      console.log('Connected to server');
    });

    // 创建游戏
    async function createGame() {
      const response = await fetch('http://localhost:3000/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redPlayer: { type: 'user' },
          blackPlayer: { type: 'ai', 'model': 'deepseek' }
        })
      });

      const data = await response.json();
      if (data.success) {
        currentGameId = data.data.id;
        console.log('Game created:', currentGameId);

        // 加入游戏房间
        socket.emit('game:join', { gameId: currentGameId });
      }
    }

    // 监听游戏状态更新
    socket.on('game:state-update', (data) => {
      console.log('Game state updated:', data);
      renderBoard(data.gameState.board);
    });

    // 监听游戏结束
    socket.on('game:ended', (data) => {
      console.log('Game ended:', data);
      alert(`游戏结束! ${data.status}`);
    });

    // 执行走法
    async function makeMove(from, to) {
      const response = await fetch(`http://localhost:3000/api/game/${currentGameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: from,
          to: to,
          player: 'red'
        })
      });

      const data = await response.json();
      if (data.success) {
        console.log('Move successful:', data.data);
      } else {
        console.error('Move failed:', data.message);
      }
    }

    // 渲染棋盘
    function renderBoard(board) {
      const boardEl = document.getElementById('game-board');
      boardEl.innerHTML = '';

      for (let y = 0; y < 10; y++) {
        const row = document.createElement('div');
        for (let x = 0; x < 9; x++) {
          const cell = document.createElement('span');
          const piece = board[y][x];
          cell.textContent = piece ? piece.type : '·';
          cell.style.margin = '5px';
          row.appendChild(cell);
        }
        boardEl.appendChild(row);
      }
    }

    // 初始化
    createGame();
  </script>
</body>
</html>
```

### Node.js 客户端

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000');

// 连接
socket.on('connect', () => {
  console.log('Connected to server');

  // 加入游戏
  socket.emit('game:join', { gameId: 'your-game-id' });
});

// 监听游戏状态更新
socket.on('game:state-update', (data) => {
  console.log('Game updated:', data);
});

// 监听玩家加入
socket.on('game:player-joined', (data) => {
  console.log('Player joined:', data.socketId);
});

// 获取游戏状态
socket.emit('game:get-state', { gameId: 'your-game-id' }, (response) => {
  if (response.success) {
    console.log('Game state:', response.data);
  }
});

// 离开游戏
socket.emit('game:leave', { gameId: 'your-game-id' });
```

## 完整游戏流程

### 1. 创建并开始游戏

```javascript
// 1. 创建游戏
const createResponse = await fetch('http://localhost:3000/api/game/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    redPlayer: { type: 'user' },
    blackPlayer: { type: 'ai', model: 'deepseek' }
  })
});

const { data: game } = await createResponse.json();
console.log('游戏已创建:', game.id);

// 2. 加入WebSocket房间
socket.emit('game:join', { gameId: game.id });

// 3. 监听游戏更新
socket.on('game:state-update', (data) => {
  console.log('游戏状态更新:', data.gameState);
  renderBoard(data.gameState.board);
});
```

### 2. 玩家走棋

```javascript
// 红方走棋: 兵前进
const moveResponse = await fetch(`http://localhost:3000/api/game/${game.id}/move`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: { x: 1, y: 6 },  // 红方兵位置
    to: { x: 1, y: 5 },     // 目标位置
    player: 'red'
  })
});

const { data: moveResult } = await moveResponse.json();

if (moveResult.success) {
  console.log('走法成功:', moveResult.move);

  // 如果对手是AI,服务器会自动执行AI走棋
  if (moveResult.aiMove) {
    console.log('AI走法:', moveResult.aiMove);
  }
}
```

### 3. 获取提示

```javascript
// 获取当前最佳走法提示
const hintResponse = await fetch(`http://localhost:3000/api/game/${game.id}/hint`);
const { data: hintResult } = await hintResponse.json();

if (hintResult.success) {
  console.log('建议走法:', hintResult.hint);
  console.log('思考过程:', hintResult.hint.thinking);
}
```

### 4. 悔棋

```javascript
// 悔棋 (如果对手是AI,会自动悔两步)
const undoResponse = await fetch(`http://localhost:3000/api/game/${game.id}/undo`, {
  method: 'POST'
});

const { data: undoResult } = await undoResponse.json();

if (undoResult.success) {
  console.log('悔棋成功');
  renderBoard(undoResult.gameState.board);
}
```

### 5. 游戏结束处理

```javascript
socket.on('game:ended', (data) => {
  console.log('游戏结束');
  console.log('结果:', data.status);
  console.log('获胜者:', data.winner);

  // 显示结果
  if (data.status === 'red_win') {
    alert('红方获胜!');
  } else if (data.status === 'black_win') {
    alert('黑方获胜!');
  } else if (data.status === 'draw') {
    alert('和棋!');
  }
});
```

## 错误处理示例

```javascript
async function safeMove(gameId, from, to, player) {
  try {
    const response = await fetch(`http://localhost:3000/api/game/${gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, player })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message);
    }

    if (!result.success) {
      console.error('走法失败:', result.error);
      return false;
    }

    return result.data;
  } catch (error) {
    console.error('请求失败:', error);
    return false;
  }
}

// 使用示例
const result = safeMove(gameId, { x: 1, y: 6 }, { x: 1, y: 5 }, 'red');
if (result) {
  console.log('走法成功:', result.move);
}
```

## 坐标系统

中国象棋棋盘使用以下坐标系统:

- **X轴 (列)**: 0-8 (从左到右)
- **Y轴 (行)**: 0-9 (从上到下)
- **红方**: 位于行 5-9 (底部)
- **黑方**: 位于行 0-4 (顶部)

示例坐标:

```javascript
// 红方炮 (行7, 列1)
{ x: 1, y: 7 }

// 黑方炮 (行2, 列7)
{ x: 7, y: 2 }

// 红方帅 (行9, 列4)
{ x: 4, y: 9 }

// 黑方将 (行0, 列4)
{ x: 4, y: 0 }
```

## 棋子类型

- `k`: 将/帅
- `a`: 士/仕
- `b`: 象/相
- `n`: 马
- `r`: 车
- `c`: 炮
- `p`: 兵/卒

## 游戏状态

- `playing`: 进行中
- `red_win`: 红方获胜
- `black_win`: 黑方获胜
- `draw`: 和棋

## 更多示例

查看 `test-server.js` 文件获取完整的API测试示例。
