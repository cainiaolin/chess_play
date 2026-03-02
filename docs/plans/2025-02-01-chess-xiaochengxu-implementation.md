# 中国象棋对决小程序实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 构建一个支持多种AI模型的中国象棋对决微信小程序，包含人机对战和AI观战功能。

**架构：** 三层架构 - 小程序前端（用户交互）+ Node.js后端（规则引擎+AI适配器）+ 云端AI服务。采用前后端双重规则校验保证安全性和用户体验。

**技术栈：** 微信小程序原生框架、Node.js + Express、Socket.IO、Redis、OpenAI/文心/通义千问/DeepSeek APIs

---

## Phase 1: 项目初始化与基础设施

### Task 1.1: 初始化项目结构

**目标：** 创建基础项目目录结构

**步骤：**

**Step 1: 创建项目目录结构**

```bash
cd "E:/claude code/chess"
mkdir -p miniprogram/components/chess-board
mkdir -p miniprogram/components/control-panel
mkdir -p miniprogram/components/model-selector
mkdir -p miniprogram/components/game-status
mkdir -p miniprogram/pages/game
mkdir -p miniprogram/pages/spectate
mkdir -p miniprogram/pages/settings
mkdir -p miniprogram/utils
mkdir -p server/src/routes
mkdir -p server/src/services
mkdir -p server/src/middleware
mkdir -p server/src/socket
mkdir -p server/tests
```

**Step 2: 初始化后端项目**

```bash
cd server
npm init -y
```

**Step 3: 安装核心依赖**

```bash
npm install express socket.io cors dotenv
npm install @types/express @types/node @types/cors --save-dev
npm install typescript ts-node nodemon --save-dev
```

**Step 4: 创建 TypeScript 配置**

文件：`server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "tests"]
}
```

**Step 5: 创建 .gitignore**

文件：`server/.gitignore`

```
node_modules/
dist/
.env
*.log
.DS_Store
```

**Step 6: 创建环境变量模板**

文件：`server/.env.example`

```env
PORT=3000
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_openai_key_here
QIWEN_API_KEY=your_qiwen_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
CORS_ORIGIN=https://your-domain.com
```

**Step 7: 初始化小程序项目**

文件：`miniprogram/app.json`

```json
{
  "pages": [
    "pages/game/game",
    "pages/spectate/spectate",
    "pages/settings/settings"
  ],
  "window": {
    "navigationBarTitleText": "中国象棋",
    "navigationBarBackgroundColor": "#8B4513",
    "navigationBarTextStyle": "white"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

**Step 8: 创建小程序配置文件**

文件：`miniprogram/project.config.json`

```json
{
  "appid": "your_appid_here",
  "projectname": "chess-xiaochengxu",
  "description": "中国象棋AI对决小程序",
  "setting": {
    "urlCheck": false,
    "es6": true,
    "postcss": true,
    "minified": true
  },
  "compileType": "miniprogram"
}
```

**Step 9: Commit**

```bash
git add .
git commit -m "feat: initialize project structure"
```

---

### Task 1.2: 创建核心数据类型定义

**目标：** 定义 TypeScript 类型，确保前后端类型一致

**Files:**
- Create: `server/src/types/chess.ts`

**Step 1: 创建类型定义文件**

文件：`server/src/types/chess.ts`

```typescript
// 棋子类型
export type PieceType = 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p'; // 将士象马车炮兵
export type PieceColor = 'red' | 'black' | null;

// 棋盘位置 (0-9行, 0-8列)
export interface Position {
  x: number; // 列 0-8
  y: number; // 行 0-9
}

// 棋子
export interface Piece {
  type: PieceType;
  color: PieceColor;
}

// 棋盘 10x9
export type Board = (Piece | null)[][];

// 走法
export interface Move {
  from: Position;
  to: Position;
  piece: PieceType;
  captured?: PieceType;
  timestamp: number;
}

// 游戏状态
export type GameStatus = 'playing' | 'red_win' | 'black_win' | 'draw';

// 游戏会话
export interface GameSession {
  id: string;
  board: Board;
  turn: 'red' | 'black';
  moves: Move[];
  status: GameStatus;
  players: {
    red: Player;
    black: Player;
  };
  createdAt: number;
  updatedAt: number;
}

// 玩家（用户或AI）
export interface Player {
  type: 'user' | 'ai';
  model?: string;
}

// 走法请求
export interface MoveRequest {
  gameId: string;
  from: Position;
  to: Position;
  player: 'red' | 'black';
}

// AI请求
export interface AIRequest {
  board: Board;
  role: 'red' | 'black';
  history: Move[];
}

// AI响应
export interface AIResponse {
  from: Position;
  to: Position;
  thinking?: string; // AI思考过程（可选）
}

// AI模型配置
export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'qiwens' | 'deepseek' | 'custom';
  endpoint?: string; // 自定义端点
  requiresApiKey: boolean;
}

// 错误响应
export interface ErrorResponse {
  code: string;
  message: string;
  retryable: boolean;
  details?: any;
}
```

**Step 2: Commit**

```bash
git add server/src/types/chess.ts
git commit -m "feat: add core type definitions"
```

---

## Phase 2: 中国象棋规则引擎

### Task 2.1: 创建初始棋盘

**Files:**
- Create: `server/src/services/chess-engine.ts`
- Create: `server/tests/chess-engine.test.ts`

**Step 1: 编写初始棋盘测试**

文件：`server/tests/chess-engine.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import { ChessEngine } from '../src/services/chess-engine';
import { Board, PieceType } from '../src/types/chess';

describe('ChessEngine - Initial Board', () => {
  it('should create initial board with correct pieces', () => {
    const engine = new ChessEngine();
    const board = engine.getBoard();

    // 验证棋盘尺寸
    expect(board).toHaveLength(10);
    expect(board[0]).toHaveLength(9);

    // 验证红方车
    expect(board[9][0]?.type).toBe('r');
    expect(board[9][0]?.color).toBe('red');
    expect(board[9][8]?.type).toBe('r');

    // 验证红方马
    expect(board[9][1]?.type).toBe('n');
    expect(board[9][7]?.type).toBe('n');

    // 验证红方炮
    expect(board[7][1]?.type).toBe('c');
    expect(board[7][7]?.type).toBe('c');

    // 验证红方兵
    expect(board[6][0]?.type).toBe('p');
    expect(board[6][2]?.type).toBe('p');
    expect(board[6][4]?.type).toBe('p');
    expect(board[6][6]?.type).toBe('p');
    expect(board[6][8]?.type).toBe('p');

    // 验证黑方车
    expect(board[0][0]?.type).toBe('r');
    expect(board[0][0]?.color).toBe('black');

    // 验证空位
    expect(board[5][4]).toBeNull();
  });

  it('should have red turn initially', () => {
    const engine = new ChessEngine();
    expect(engine.getTurn()).toBe('red');
  });
});
```

**Step 2: 运行测试（预期失败）**

```bash
cd server
npm install --save-dev jest @types/jest ts-jest
npx jest tests/chess-engine.test.ts
```

预期：`Cannot find module '../src/services/chess-engine'`

**Step 3: 实现初始棋盘**

文件：`server/src/services/chess-engine.ts`

```typescript
import { Board, Piece, Position, Move, GameStatus } from '../types/chess';

export class ChessEngine {
  private board: Board;
  private turn: 'red' | 'black';
  private moves: Move[];
  private status: GameStatus;

  constructor() {
    this.board = this.createInitialBoard();
    this.turn = 'red';
    this.moves = [];
    this.status = 'playing';
  }

  /**
   * 创建初始棋盘
   */
  private createInitialBoard(): Board {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));

    // 黑方 (行 0-4)
    this.placePiece(board, 0, 0, 'r', 'black'); // 车
    this.placePiece(board, 0, 1, 'n', 'black'); // 马
    this.placePiece(board, 0, 2, 'b', 'black'); // 象
    this.placePiece(board, 0, 3, 'a', 'black'); // 士
    this.placePiece(board, 0, 4, 'k', 'black'); // 将
    this.placePiece(board, 0, 5, 'a', 'black'); // 士
    this.placePiece(board, 0, 6, 'b', 'black'); // 象
    this.placePiece(board, 0, 7, 'n', 'black'); // 马
    this.placePiece(board, 0, 8, 'r', 'black'); // 车
    this.placePiece(board, 2, 1, 'c', 'black'); // 炮
    this.placePiece(board, 2, 7, 'c', 'black'); // 炮
    this.placePiece(board, 3, 0, 'p', 'black'); // 卒
    this.placePiece(board, 3, 2, 'p', 'black');
    this.placePiece(board, 3, 4, 'p', 'black');
    this.placePiece(board, 3, 6, 'p', 'black');
    this.placePiece(board, 3, 8, 'p', 'black');

    // 红方 (行 5-9)
    this.placePiece(board, 6, 0, 'p', 'red'); // 兵
    this.placePiece(board, 6, 2, 'p', 'red');
    this.placePiece(board, 6, 4, 'p', 'red');
    this.placePiece(board, 6, 6, 'p', 'red');
    this.placePiece(board, 6, 8, 'p', 'red');
    this.placePiece(board, 7, 1, 'c', 'red'); // 炮
    this.placePiece(board, 7, 7, 'c', 'red'); // 炮
    this.placePiece(board, 9, 0, 'r', 'red'); // 车
    this.placePiece(board, 9, 1, 'n', 'red'); // 马
    this.placePiece(board, 9, 2, 'b', 'red'); // 象
    this.placePiece(board, 9, 3, 'a', 'red'); // 士
    this.placePiece(board, 9, 4, 'k', 'red'); // 帅
    this.placePiece(board, 9, 5, 'a', 'red'); // 士
    this.placePiece(board, 9, 6, 'b', 'red'); // 象
    this.placePiece(board, 9, 7, 'n', 'red'); // 马
    this.placePiece(board, 9, 8, 'r', 'red'); // 车

    return board;
  }

  /**
   * 放置棋子
   */
  private placePiece(board: Board, row: number, col: number, type: string, color: string): void {
    board[row][col] = { type: type as any, color: color as any };
  }

  /**
   * 获取棋盘
   */
  getBoard(): Board {
    return this.board;
  }

  /**
   * 获取当前回合
   */
  getTurn(): 'red' | 'black' {
    return this.turn;
  }

  /**
   * 获取游戏状态
   */
  getStatus(): GameStatus {
    return this.status;
  }

  /**
   * 获取历史走法
   */
  getMoves(): Move[] {
    return [...this.moves];
  }
}
```

**Step 4: 运行测试（预期通过）**

```bash
npx jest tests/chess-engine.test.ts
```

预期：`PASS`

**Step 5: Commit**

```bash
git add server/src/services/chess-engine.ts server/tests/chess-engine.test.ts
git commit -m "feat: implement initial chess board"
```

---

### Task 2.2: 实现基本走法校验 - 兵/卒

**Files:**
- Modify: `server/src/services/chess-engine.ts`
- Modify: `server/tests/chess-engine.test.ts`

**Step 1: 编写兵/卒走法测试**

在 `server/tests/chess-engine.test.ts` 添加：

```typescript
describe('ChessEngine - Pawn Movement', () => {
  it('should validate red pawn moving forward', () => {
    const engine = new ChessEngine();
    const from = { x: 4, y: 6 };
    const to = { x: 4, y: 5 };

    const result = engine.validateMove(from, to);
    expect(result.valid).toBe(true);
  });

  it('should reject red pawn moving backward', () => {
    const engine = new ChessEngine();
    const from = { x: 4, y: 6 };
    const to = { x: 4, y: 7 };

    const result = engine.validateMove(from, to);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('backward');
  });

  it('should allow pawn to move sideways after crossing river', () => {
    const engine = new ChessEngine();
    // 移动兵过河
    engine.makeMove({ x: 4, y: 6 }, { x: 4, y: 5 });
    engine.makeMove({ x: 4, y: 3 }, { x: 4, y: 4 }); // 黑卒
    engine.makeMove({ x: 4, y: 5 }, { x: 4, y: 4 }); // 兵吃卒过河

    // 现在兵可以横走
    const result = engine.validateMove({ x: 4, y: 4 }, { x: 5, y: 4 });
    expect(result.valid).toBe(true);
  });

  it('should reject pawn moving sideways before crossing river', () => {
    const engine = new ChessEngine();
    const from = { x: 4, y: 6 };
    const to = { x: 5, y: 6 };

    const result = engine.validateMove(from, to);
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: 运行测试（预期失败）**

```bash
npx jest tests/chess-engine.test.ts -t "Pawn"
```

预期：`validateMove is not a function`

**Step 3: 实现兵/卒走法校验**

在 `server/src/services/chess-engine.ts` 添加：

```typescript
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export class ChessEngine {
  // ... 现有代码 ...

  /**
   * 校验走法
   */
  validateMove(from: Position, to: Position): ValidationResult {
    // 检查坐标是否在棋盘内
    if (!this.isValidPosition(from) || !this.isValidPosition(to)) {
      return { valid: false, reason: 'Position out of bounds' };
    }

    const piece = this.board[from.y][from.x];
    if (!piece) {
      return { valid: false, reason: 'No piece at source position' };
    }

    // 检查是否是当前回合方的棋子
    if (piece.color !== this.turn) {
      return { valid: false, reason: 'Not your turn' };
    }

    // 检查目标位置是否有己方棋子
    const targetPiece = this.board[to.y][to.x];
    if (targetPiece && targetPiece.color === piece.color) {
      return { valid: false, reason: 'Cannot capture own piece' };
    }

    // 根据棋子类型校验走法
    switch (piece.type) {
      case 'p':
        return this.validatePawnMove(from, to, piece.color);
      case 'r':
        return this.validateRookMove(from, to);
      case 'n':
        return this.validateKnightMove(from, to);
      case 'b':
        return this.validateBishopMove(from, to, piece.color);
      case 'a':
        return this.validateAdvisorMove(from, to, piece.color);
      case 'k':
        return this.validateKingMove(from, to, piece.color);
      case 'c':
        return this.validateCannonMove(from, to);
      default:
        return { valid: false, reason: 'Unknown piece type' };
    }
  }

  /**
   * 校验兵/卒走法
   */
  private validatePawnMove(from: Position, to: Position, color: 'red' | 'black'): ValidationResult {
    const dy = to.y - from.y;
    const dx = Math.abs(to.x - from.x);

    // 红兵向上移动（y减小），黑卒向下移动（y增加）
    const forward = color === 'red' ? -1 : 1;

    // 是否过河
    const crossedRiver = color === 'red' ? from.y <= 4 : from.y >= 5;

    // 前进一格
    if (dy === forward && dx === 0) {
      return { valid: true };
    }

    // 过河后可以横走
    if (crossedRiver && dy === 0 && dx === 1) {
      return { valid: true };
    }

    return { valid: false, reason: 'Invalid pawn move' };
  }

  /**
   * 检查坐标是否有效
   */
  private isValidPosition(pos: Position): boolean {
    return pos.x >= 0 && pos.x <= 8 && pos.y >= 0 && pos.y <= 9;
  }

  // ... 其他校验方法稍后实现 ...
}
```

**Step 4: 添加 makeMove 方法**

```typescript
/**
 * 执行走法
 */
makeMove(from: Position, to: Position): void {
  const result = this.validateMove(from, to);
  if (!result.valid) {
    throw new Error(result.reason || 'Invalid move');
  }

  const piece = this.board[from.y][from.x];
  const targetPiece = this.board[to.y][to.x];

  // 记录走法
  this.moves.push({
    from,
    to,
    piece: piece.type,
    captured: targetPiece?.type,
    timestamp: Date.now()
  });

  // 移动棋子
  this.board[to.y][to.x] = piece;
  this.board[from.y][from.x] = null;

  // 切换回合
  this.turn = this.turn === 'red' ? 'black' : 'red';
}
```

**Step 5: 运行测试**

```bash
npx jest tests/chess-engine.test.ts -t "Pawn"
```

预期：`PASS`

**Step 6: Commit**

```bash
git add server/src/services/chess-engine.ts server/tests/chess-engine.test.ts
git commit -m "feat: implement pawn movement validation"
```

---

### Task 2.3: 实现车走法校验

**Files:**
- Modify: `server/src/services/chess-engine.ts`
- Modify: `server/tests/chess-engine.test.ts`

**Step 1: 编写车走法测试**

在 `server/tests/chess-engine.test.ts` 添加：

```typescript
describe('ChessEngine - Rook Movement', () => {
  it('should validate rook moving horizontally', () => {
    const engine = new ChessEngine();
    // 清空路径
    engine['board'][9][1] = null;
    engine['board'][9][2] = null;

    const result = engine.validateMove({ x: 0, y: 9 }, { x: 3, y: 9 });
    expect(result.valid).toBe(true);
  });

  it('should validate rook moving vertically', () => {
    const engine = new ChessEngine();
    // 清空路径
    engine['board'][8][0] = null;
    engine['board'][7][0] = null;

    const result = engine.validateMove({ x: 0, y: 9 }, { x: 0, y: 6 });
    expect(result.valid).toBe(true);
  });

  it('should reject rook moving through pieces', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 0, y: 9 }, { x: 3, y: 9 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('should reject rook diagonal move', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 0, y: 9 }, { x: 1, y: 8 });
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: 运行测试（预期失败）**

**Step 3: 实现车走法校验**

在 `server/src/services/chess-engine.ts` 添加：

```typescript
/**
 * 校验车走法
 */
private validateRookMove(from: Position, to: Position): ValidationResult {
  // 车只能直线移动
  if (from.x !== to.x && from.y !== to.y) {
    return { valid: false, reason: 'Rook must move in straight line' };
  }

  // 检查路径是否有阻挡
  if (this.isPathBlocked(from, to)) {
    return { valid: false, reason: 'Path is blocked' };
  }

  return { valid: true };
}

/**
 * 检查路径是否有阻挡
 */
private isPathBlocked(from: Position, to: Position): boolean {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);

  let x = from.x + dx;
  let y = from.y + dy;

  while (x !== to.x || y !== to.y) {
    if (this.board[y][x] !== null) {
      return true;
    }
    x += dx;
    y += dy;
  }

  return false;
}
```

**Step 4: 运行测试**

**Step 5: Commit**

```bash
git add server/src/services/chess-engine.ts server/tests/chess-engine.test.ts
git commit -m "feat: implement rook movement validation"
```

---

### Task 2.4: 实现马走法校验

**Files:**
- Modify: `server/src/services/chess-engine.ts`
- Modify: `server/tests/chess-engine.test.ts`

**Step 1: 编写马走法测试**

在 `server/tests/chess-engine.test.ts` 添加：

```typescript
describe('ChessEngine - Knight Movement', () => {
  it('should validate knight moving in L shape', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 1, y: 9 }, { x: 2, y: 7 });
    expect(result.valid).toBe(true);
  });

  it('should validate knight all L shapes', () => {
    const engine = new ChessEngine();
    // 清空马腿
    engine['board'][8][1] = null;

    const moves = [
      { from: { x: 1, y: 9 }, to: { x: 0, y: 7 } },
      { from: { x: 1, y: 9 }, to: { x: 2, y: 7 } },
      { from: { x: 1, y: 9 }, to: { x: 3, y: 8 } }
    ];

    moves.forEach(move => {
      const result = engine.validateMove(move.from, move.to);
      expect(result.valid).toBe(true);
    });
  });

  it('should block knight when leg is blocked (撇马腿)', () => {
    const engine = new ChessEngine();
    // 马腿被兵挡住
    const result = engine.validateMove({ x: 1, y: 9 }, { x: 0, y: 7 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('should reject knight non-L movement', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 1, y: 9 }, { x: 3, y: 9 });
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: 实现马走法校验**

在 `server/src/services/chess-engine.ts` 添加：

```typescript
/**
 * 校验马走法
 */
private validateKnightMove(from: Position, to: Position): ValidationResult {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  // 马走日：L形移动
  if (!((dx === 1 && dy === 2) || (dx === 2 && dy === 1))) {
    return { valid: false, reason: 'Knight must move in L shape' };
  }

  // 检查撇马腿
  if (this.isKnightLegBlocked(from, to)) {
    return { valid: false, reason: 'Knight leg is blocked' };
  }

  return { valid: true };
}

/**
 * 检查马腿是否被阻挡
 */
private isKnightLegBlocked(from: Position, to: Position): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // 马腿位置
  let legX: number, legY: number;

  if (Math.abs(dx) === 2) {
    // 横向走日，马腿在水平方向
    legX = from.x + Math.sign(dx);
    legY = from.y;
  } else {
    // 纵向走日，马腿在垂直方向
    legX = from.x;
    legY = from.y + Math.sign(dy);
  }

  return this.board[legY][legX] !== null;
}
```

**Step 3: 运行测试**

**Step 4: Commit**

```bash
git add server/src/services/chess-engine.ts server/tests/chess-engine.test.ts
git commit -m "feat: implement knight movement validation"
```

---

### Task 2.5: 实现象走法校验

**Files:**
- Modify: `server/src/services/chess-engine.ts`
- Modify: `server/tests/chess-engine.test.ts`

**Step 1: 编写象走法测试**

在 `server/tests/chess-engine.test.ts` 添加：

```typescript
describe('ChessEngine - Bishop (Elephant) Movement', () => {
  it('should validate bishop moving diagonally 2 squares', () => {
    const engine = new ChessEngine();
    // 清空象眼
    engine['board'][8][2] = null;

    const result = engine.validateMove({ x: 2, y: 9 }, { x: 4, y: 7 });
    expect(result.valid).toBe(true);
  });

  it('should block bishop when eye is blocked (塞象眼)', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 2, y: 9 }, { x: 4, y: 7 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('should restrict bishop to own side (cannot cross river)', () => {
    const engine = new ChessEngine();
    // 红象不能过河到y<=4
    engine['board'][8][2] = null;
    engine['board'][7][3] = null;

    const result = engine.validateMove({ x: 2, y: 9 }, { x: 5, y: 6 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('river');
  });
});
```

**Step 2: 实现象走法校验**

在 `server/src/services/chess-engine.ts` 添加：

```typescript
/**
 * 校验象走法
 */
private validateBishopMove(from: Position, to: Position, color: 'red' | 'black'): ValidationResult {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  // 象飞田：对角线2格
  if (dx !== 2 || dy !== 2) {
    return { valid: false, reason: 'Bishop must move 2 squares diagonally' };
  }

  // 不能过河
  if (color === 'red' && to.y < 5) {
    return { valid: false, reason: 'Bishop cannot cross river' };
  }
  if (color === 'black' && to.y > 4) {
    return { valid: false, reason: 'Bishop cannot cross river' };
  }

  // 检查塞象眼
  const eyeX = (from.x + to.x) / 2;
  const eyeY = (from.y + to.y) / 2;
  if (this.board[eyeY][eyeX] !== null) {
    return { valid: false, reason: 'Bishop eye is blocked' };
  }

  return { valid: true };
}
```

**Step 3: 运行测试**

**Step 4: Commit**

```bash
git add server/src/services/chess-engine.ts server/tests/chess-engine.test.ts
git commit -m "feat: implement bishop movement validation"
```

---

### Task 2.6: 实现士和将走法校验

**Files:**
- Modify: `server/src/services/chess-engine.ts`
- Modify: `server/tests/chess-engine.test.ts`

**Step 1: 编写士走法测试**

```typescript
describe('ChessEngine - Advisor Movement', () => {
  it('should validate advisor moving diagonally in palace', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 3, y: 9 }, { x: 4, y: 8 });
    expect(result.valid).toBe(true);
  });

  it('should restrict advisor to palace', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 3, y: 9 }, { x: 4, y: 7 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('palace');
  });
});
```

**Step 2: 编写将走法测试**

```typescript
describe('ChessEngine - King Movement', () => {
  it('should validate king moving one step in palace', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 4, y: 9 }, { x: 4, y: 8 });
    expect(result.valid).toBe(true);
  });

  it('should restrict king to palace', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 4, y: 9 }, { x: 4, y: 7 });
    expect(result.valid).toBe(false);
  });

  it('should detect flying general (kings facing each other)', () => {
    const engine = new ChessEngine();
    // 清空中间路径
    for (let y = 1; y < 8; y++) {
      engine['board'][y][4] = null;
    }

    // 将帅照面
    engine['board'][1][4] = { type: 'k', color: 'black' };

    const result = engine.validateMove({ x: 4, y: 9 }, { x: 4, y: 8 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('flying general');
  });
});
```

**Step 3: 实现士走法校验**

```typescript
/**
 * 校验士走法
 */
private validateAdvisorMove(from: Position, to: Position, color: 'red' | 'black'): ValidationResult {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  // 士斜走1格
  if (dx !== 1 || dy !== 1) {
    return { valid: false, reason: 'Advisor must move diagonally 1 step' };
  }

  // 不能出九宫
  if (!this.isInPalace(to, color)) {
    return { valid: false, reason: 'Advisor must stay in palace' };
  }

  return { valid: true };
}

/**
 * 校验将走法
 */
private validateKingMove(from: Position, to: Position, color: 'red' | 'black'): ValidationResult {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  // 将帅每次走1格
  if (dx + dy !== 1) {
    return { valid: false, reason: 'King must move 1 step' };
  }

  // 不能出九宫
  if (!this.isInPalace(to, color)) {
    return { valid: false, reason: 'King must stay in palace' };
  }

  // 检查将帅照面
  if (this.wouldCauseFlyingGeneral(from, to)) {
    return { valid: false, reason: 'Flying general - kings cannot face each other' };
  }

  return { valid: true };
}

/**
 * 检查是否在九宫内
 */
private isInPalace(pos: Position, color: 'red' | 'black'): boolean {
  const x = pos.x;
  const y = pos.y;

  if (x < 3 || x > 5) return false;

  if (color === 'red') {
    return y >= 7 && y <= 9;
  } else {
    return y >= 0 && y <= 2;
  }
}

/**
 * 检查是否导致将帅照面
 */
private wouldCauseFlyingGeneral(from: Position, to: Position): boolean {
  // 临时移动
  const piece = this.board[from.y][from.x];
  const captured = this.board[to.y][to.x];

  this.board[to.y][to.x] = piece;
  this.board[from.y][from.x] = null;

  // 找到双方将帅位置
  let redKing: Position | null = null;
  let blackKing: Position | null = null;

  for (let y = 0; y < 10; y++) {
    for (let x = 3; x <= 5; x++) {
      const p = this.board[y][x];
      if (p?.type === 'k') {
        if (p.color === 'red') redKing = { x, y };
        else blackKing = { x, y };
      }
    }
  }

  const result = redKing && blackKing && redKing.x === blackKing.x;

  // 恢复
  this.board[from.y][from.x] = piece;
  this.board[to.y][to.x] = captured;

  if (result) {
    // 检查中间是否有棋子
    const minY = Math.min(redKing.y, blackKing.y);
    const maxY = Math.max(redKing.y, blackKing.y);
    for (let y = minY + 1; y < maxY; y++) {
      if (this.board[y][redKing.x] !== null) {
        return false; // 有阻挡，不算照面
      }
    }
    return true;
  }

  return false;
}
```

**Step 4: 运行测试**

**Step 5: Commit**

```bash
git add server/src/services/chess-engine.ts server/tests/chess-engine.test.ts
git commit -m "feat: implement advisor and king movement validation"
```

---

### Task 2.7: 实现炮走法校验

**Files:**
- Modify: `server/src/services/chess-engine.ts`
- Modify: `server/tests/chess-engine.test.ts`

**Step 1: 编写炮走法测试**

```typescript
describe('ChessEngine - Cannon Movement', () => {
  it('should validate cannon moving like rook when not capturing', () => {
    const engine = new ChessEngine();
    // 清空炮移动路径
    engine['board'][7][2] = null;
    engine['board'][7][3] = null;

    const result = engine.validateMove({ x: 1, y: 7 }, { x: 4, y: 7 });
    expect(result.valid).toBe(true);
  });

  it('should validate cannon capturing by jumping over one piece', () => {
    const engine = new ChessEngine();
    // 炮隔山打牛
    const result = engine.validateMove({ x: 1, y: 7 }, { x: 4, y: 7 });
    expect(result.valid).toBe(true);
  });

  it('should reject cannon trying to capture without jumping', () => {
    const engine = new ChessEngine();
    // 直接吃相邻的棋子（不允许）
    engine['board'][7][2] = null;

    const result = engine.validateMove({ x: 1, y: 7 }, { x: 2, y: 7 });
    expect(result.valid).toBe(false);
  });

  it('should reject cannon jumping over multiple pieces', () => {
    const engine = new ChessEngine();
    // 增加一个阻挡
    engine['board'][7][3] = { type: 'p', color: 'red' };

    const result = engine.validateMove({ x: 1, y: 7 }, { x: 5, y: 7 });
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: 实现炮走法校验**

```typescript
/**
 * 校验炮走法
 */
private validateCannonMove(from: Position, to: Position): ValidationResult {
  // 炮只能直线移动
  if (from.x !== to.x && from.y !== to.y) {
    return { valid: false, reason: 'Cannon must move in straight line' };
  }

  const targetPiece = this.board[to.y][to.x];
  const piecesBetween = this.countPiecesBetween(from, to);

  if (targetPiece === null) {
    // 移动：路径不能有阻挡
    if (piecesBetween !== 0) {
      return { valid: false, reason: 'Cannon path must be clear when moving' };
    }
  } else {
    // 吃子：必须隔一个棋子（炮架）
    if (piecesBetween !== 1) {
      return { valid: false, reason: 'Cannon must jump over exactly one piece to capture' };
    }
  }

  return { valid: true };
}

/**
 * 计算两点之间的棋子数量
 */
private countPiecesBetween(from: Position, to: Position): number {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);

  let count = 0;
  let x = from.x + dx;
  let y = from.y + dy;

  while (x !== to.x || y !== to.y) {
    if (this.board[y][x] !== null) {
      count++;
    }
    x += dx;
    y += dy;
  }

  return count;
}
```

**Step 3: 运行测试**

**Step 4: Commit**

```bash
git add server/src/services/chess-engine.ts server/tests/chess-engine.test.ts
git commit -m "feat: implement cannon movement validation"
```

---

### Task 2.8: 实现将军和困毙检测

**Files:**
- Modify: `server/src/services/chess-engine.ts`
- Modify: `server/tests/chess-engine.test.ts`

**Step 1: 编写将军检测测试**

```typescript
describe('ChessEngine - Check and Checkmate Detection', () => {
  it('should detect check state', () => {
    const engine = new ChessEngine();
    // 设置一个将军局面
    engine['board'][8][4] = null;
    engine['board'][1][4] = { type: 'k', color: 'black' };
    engine['board'][7][4] = { type: 'r', color: 'red' };

    const isCheck = engine.isCheck('black');
    expect(isCheck).toBe(true);
  });

  it('should detect checkmate', () => {
    const engine = new ChessEngine();
    // 构造一个杀局
    // ... 简化的杀局设置 ...

    const isCheckmate = engine.isCheckmate('black');
    // 依赖具体局面
  });

  it('should detect stalemate (no legal moves but not in check)', () => {
    const engine = new ChessEngine();
    // 构造困毙局面
    // ...

    const isStalemate = engine.isStalemate('black');
    expect(isStalemate).toBe(true);
  });
});
```

**Step 2: 实现将军检测**

```typescript
/**
 * 检测是否被将军
 */
isCheck(color: 'red' | 'black'): boolean {
  // 找到将帅位置
  let kingPos: Position | null = null;

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = this.board[y][x];
      if (piece?.type === 'k' && piece?.color === color) {
        kingPos = { x, y };
        break;
      }
    }
  }

  if (!kingPos) return false;

  // 检查是否有敌方棋子可以吃掉将帅
  const enemyColor = color === 'red' ? 'black' : 'red';

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = this.board[y][x];
      if (piece?.color === enemyColor) {
        const result = this.validateMoveWithoutFlyingGeneralCheck({ x, y }, kingPos);
        if (result.valid) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * 校验走法（不检查将帅照面，避免递归）
 */
private validateMoveWithoutFlyingGeneralCheck(from: Position, to: Position): ValidationResult {
  if (!this.isValidPosition(from) || !this.isValidPosition(to)) {
    return { valid: false, reason: 'Position out of bounds' };
  }

  const piece = this.board[from.y][from.x];
  if (!piece) {
    return { valid: false, reason: 'No piece at source' };
  }

  const targetPiece = this.board[to.y][to.x];
  if (targetPiece?.color === piece.color) {
    return { valid: false, reason: 'Cannot capture own piece' };
  }

  switch (piece.type) {
    case 'p': return this.validatePawnMove(from, to, piece.color);
    case 'r': return this.validateRookMove(from, to);
    case 'n': return this.validateKnightMove(from, to);
    case 'b': return this.validateBishopMove(from, to, piece.color);
    case 'a': return this.validateAdvisorMove(from, to, piece.color);
    case 'k': return this.validateKingMove(from, to, piece.color);
    case 'c': return this.validateCannonMove(from, to);
    default: return { valid: false, reason: 'Unknown piece' };
  }
}

/**
 * 检测是否被将死
 */
isCheckmate(color: 'red' | 'black'): boolean {
  if (!this.isCheck(color)) {
    return false;
  }

  return !this.hasLegalMoves(color);
}

/**
 * 检测是否困毙
 */
isStalemate(color: 'red' | 'black'): boolean {
  if (this.isCheck(color)) {
    return false;
  }

  return !this.hasLegalMoves(color);
}

/**
 * 检查是否有合法走法
 */
private hasLegalMoves(color: 'red' | 'black'): boolean {
  // 遍历所有己方棋子
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = this.board[y][x];
      if (piece?.color === color) {
        // 尝试所有可能的走法
        for (let ty = 0; ty < 10; ty++) {
          for (let tx = 0; tx < 9; tx++) {
            if (this.wouldBeLegalMove({ x, y }, { x: tx, y: ty }, color)) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

/**
 * 检查走法是否合法（执行后不会导致被将军）
 */
private wouldBeLegalMove(from: Position, to: Position, color: 'red' | 'black'): boolean {
  const result = this.validateMove(from, to);
  if (!result.valid) return false;

  // 模拟走法
  const piece = this.board[from.y][from.x];
  const captured = this.board[to.y][to.x];
  const originalTurn = this.turn;

  this.board[to.y][to.x] = piece;
  this.board[from.y][from.x] = null;

  // 检查是否会被将军
  const wouldBeInCheck = this.isCheck(color);

  // 恢复
  this.board[from.y][from.x] = piece;
  this.board[to.y][to.x] = captured;
  this.turn = originalTurn;

  return !wouldBeInCheck;
}
```

**Step 3: 运行测试**

**Step 4: Commit**

```bash
git add server/src/services/chess-engine.ts server/tests/chess-engine.test.ts
git commit -m "feat: implement check and checkmate detection"
```

---

## Phase 3: AI适配器

### Task 3.1: 创建AI适配器基础结构

**Files:**
- Create: `server/src/services/ai-adapter.ts`
- Create: `server/tests/ai-adapter.test.ts`

**Step 1: 编写AI适配器测试**

文件：`server/tests/ai-adapter.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AIAdapter } from '../src/services/ai-adapter';
import { Board, AIRequest } from '../src/types/chess';

describe('AIAdapter', () => {
  let adapter: AIAdapter;
  let mockBoard: Board;

  beforeEach(() => {
    adapter = new AIAdapter();
    mockBoard = Array(10).fill(null).map(() => Array(9).fill(null));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should request move from OpenAI', async () => {
    // 设置环境变量
    process.env.OPENAI_API_KEY = 'test-key';

    const mockResponse = {
      from: { x: 4, y: 6 },
      to: { x: 4, y: 5 },
      thinking: 'I move the pawn forward'
    };

    jest.spyOn(adapter as any, 'callOpenAI').mockResolvedValue(mockResponse);

    const request: AIRequest = {
      board: mockBoard,
      role: 'red',
      history: []
    };

    const result = await adapter.getMove('openai', request);
    expect(result).toEqual(mockResponse);
  });

  it('should handle timeout and return fallback move', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    jest.spyOn(adapter as any, 'callOpenAI').mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(null), 35000))
    );

    const request: AIRequest = {
      board: mockBoard,
      role: 'red',
      history: []
    };

    const result = await adapter.getMove('openai', request);
    expect(result).not.toBeNull();
  }, 35000);

  it('should retry on invalid move', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    const invalidResponse = { from: { x: 10, y: 10 }, to: { x: 11, y: 11 } };
    const validResponse = { from: { x: 4, y: 6 }, to: { x: 4, y: 5 } };

    const mockCall = jest.spyOn(adapter as any, 'callOpenAI')
      .mockResolvedValueOnce(invalidResponse)
      .mockResolvedValueOnce(validResponse);

    const request: AIRequest = {
      board: mockBoard,
      role: 'red',
      history: []
    };

    const result = await adapter.getMove('openai', request);
    expect(result).toEqual(validResponse);
    expect(mockCall).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: 运行测试（预期失败）**

**Step 3: 实现AI适配器**

文件：`server/src/services/ai-adapter.ts`

```typescript
import { Board, Move, AIRequest, AIResponse } from '../types/chess';
import { ChessEngine } from './chess-engine';

interface AIProvider {
  name: string;
  call(request: AIRequest): Promise<AIResponse | null>;
}

export class AIAdapter {
  private providers: Map<string, AIProvider>;
  private engine: ChessEngine;
  private readonly TIMEOUT = 30000; // 30秒
  private readonly MAX_RETRIES = 3;

  constructor() {
    this.providers = new Map();
    this.engine = new ChessEngine();
    this.registerProviders();
  }

  /**
   * 注册AI提供商
   */
  private registerProviders(): void {
    this.providers.set('openai', {
      name: 'OpenAI GPT-4',
      call: this.callOpenAI.bind(this)
    });

    this.providers.set('qiwens', {
      name: '百度文心一言',
      call: this.callQiwens.bind(this)
    });

    this.providers.set('deepseek', {
      name: 'DeepSeek',
      call: this.callDeepSeek.bind(this)
    });
  }

  /**
   * 获取AI走法
   */
  async getMove(providerId: string, request: AIRequest): Promise<AIResponse | null> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    // 重试机制
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        // 超时控制
        const response = await Promise.race([
          provider.call(request),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), this.TIMEOUT)
          )
        ]);

        if (response && this.isValidMove(response, request.board)) {
          return response;
        }

        // AI返回无效走法，重试
        console.warn(`Invalid move from ${providerId}, attempt ${attempt + 1}`);
      } catch (error) {
        console.error(`Error calling ${providerId}:`, error);
        if (attempt === this.MAX_RETRIES - 1) {
          // 最后一次尝试失败，返回随机合法走法
          return this.getFallbackMove(request);
        }
      }
    }

    return this.getFallbackMove(request);
  }

  /**
   * 验证走法是否合法
   */
  private isValidMove(response: AIResponse, board: Board): boolean {
    // 创建临时引擎验证
    const tempEngine = new ChessEngine();
    // tempEngine.setBoard(board); // 需要添加此方法

    const result = tempEngine.validateMove(response.from, response.to);
    return result.valid;
  }

  /**
   * 获取备用走法（随机合法走法）
   */
  private getFallbackMove(request: AIRequest): AIResponse {
    const engine = new ChessEngine();
    // 获取所有合法走法
    // TODO: 实现获取所有合法走法的方法

    // 暂时返回一个简单的随机走法
    return {
      from: { x: 4, y: 6 },
      to: { x: 4, y: 5 }
    };
  }

  /**
   * 调用OpenAI API
   */
  private async callOpenAI(request: AIRequest): Promise<AIResponse | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set');
    }

    const prompt = this.buildPrompt(request);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: '你是一个中国象棋专家。请根据当前棋盘状态，返回你的走法。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();
      return this.parseResponse(data.choices[0].message.content);
    } catch (error) {
      console.error('OpenAI API error:', error);
      return null;
    }
  }

  /**
   * 调用文心一言 API
   */
  private async callQiwens(request: AIRequest): Promise<AIResponse | null> {
    // TODO: 实现文心一言API调用
    return null;
  }

  /**
   * 调用DeepSeek API
   */
  private async callDeepSeek(request: AIRequest): Promise<AIResponse | null> {
    // TODO: 实现DeepSeek API调用
    return null;
  }

  /**
   * 构建AI提示词
   */
  private buildPrompt(request: AIRequest): string {
    return `你执${request.role === 'red' ? '红' : '黑'}方，请根据当前棋盘状态选择最佳走法。

棋盘状态（从上到下，行0-9；从左到右，列0-8）：
${this.boardToString(request.board)}

历史走法：
${request.history.map((m, i) => `${i + 1}. (${m.from.x},${m.from.y}) -> (${m.to.x},${m.to.y})`).join('\n') || '无'}

请返回你的走法，格式为 JSON：
{
  "from": {"x": 起点列, "y": 起点行},
  "to": {"x": 终点列, "y": 终点行},
  "thinking": "简短的思考过程（可选）"
}

注意：必须遵守中国象棋的所有规则。`;
  }

  /**
   * 将棋盘转换为字符串表示
   */
  private boardToString(board: Board): string {
    const pieceSymbols: Record<string, string> = {
      'red_k': '帅', 'red_a': '仕', 'red_b': '相', 'red_n': '马',
      'red_r': '车', 'red_c': '炮', 'red_p': '兵',
      'black_k': '将', 'black_a': '士', 'black_b': '象', 'black_n': '马',
      'black_r': '车', 'black_c': '炮', 'black_p': '卒'
    };

    return board.map((row, y) =>
      row.map((cell, x) => cell ? pieceSymbols[`${cell.color}_${cell.type}`] : '·').join(' ')
    ).join('\n');
  }

  /**
   * 解析AI响应
   */
  private parseResponse(content: string): AIResponse | null {
    try {
      // 提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in AI response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        from: parsed.from,
        to: parsed.to,
        thinking: parsed.thinking
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return null;
    }
  }

  /**
   * 获取所有可用的AI模型
   */
  getAvailableModels(): Array<{ id: string; name: string }> {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      name: provider.name
    }));
  }
}
```

**Step 4: 运行测试**

**Step 5: Commit**

```bash
git add server/src/services/ai-adapter.ts server/tests/ai-adapter.test.ts
git commit -m "feat: implement AI adapter base structure"
```

---

## Phase 4: 后端API服务

### Task 4.1: 创建Express服务器基础

**Files:**
- Create: `server/src/index.ts`
- Create: `server/src/app.ts`

**Step 1: 创建Express应用**

文件：`server/src/app.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 导出
export { app, httpServer, io };
```

**Step 2: 创建入口文件**

文件：`server/src/index.ts`

```typescript
import { httpServer, io } from './app';
import { config } from 'dotenv';

config();

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// WebSocket连接
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});
```

**Step 3: 更新 package.json 添加脚本**

文件：`server/package.json`

```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  }
}
```

**Step 4: Commit**

```bash
git add server/src/app.ts server/src/index.ts server/package.json
git commit -m "feat: setup Express server with Socket.IO"
```

---

### Task 4.2: 创建游戏API路由

**Files:**
- Create: `server/src/routes/game.ts`
- Create: `server/src/services/game-service.ts`
- Modify: `server/src/app.ts`

**Step 1: 创建游戏服务**

文件：`server/src/services/game-service.ts`

```typescript
import { GameSession, MoveRequest, GameState } from '../types/chess';
import { ChessEngine } from './chess-engine';
import { AIAdapter } from './ai-adapter';
import { v4 as uuidv4 } from 'uuid';

export class GameService {
  private games: Map<string, ChessEngine>;
  private aiAdapter: AIAdapter;

  constructor() {
    this.games = new Map();
    this.aiAdapter = new AIAdapter();
  }

  /**
   * 创建新游戏
   */
  createGame(config: {
    redPlayer: { type: 'user' | 'ai'; model?: string };
    blackPlayer: { type: 'user' | 'ai'; model?: string };
  }): GameSession {
    const gameId = uuidv4();
    const engine = new ChessEngine();

    this.games.set(gameId, engine);

    const session: GameSession = {
      id: gameId,
      board: engine.getBoard(),
      turn: 'red',
      moves: [],
      status: 'playing',
      players: {
        red: config.redPlayer,
        black: config.blackPlayer
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 如果黑方是AI，自动走第一步
    if (config.blackPlayer.type === 'ai') {
      this.makeAIMove(gameId, 'black', config.blackPlayer.model);
    }

    return session;
  }

  /**
   * 执行走法
   */
  async makeMove(gameId: string, request: MoveRequest): Promise<GameState> {
    const engine = this.games.get(gameId);
    if (!engine) {
      throw new Error('Game not found');
    }

    const session = this.getGameSession(gameId);

    // 验证是否是正确的回合
    if (request.player !== engine.getTurn()) {
      throw new Error('Not your turn');
    }

    // 执行走法
    engine.makeMove(request.from, request.to);

    // 更新会话
    session.board = engine.getBoard();
    session.moves = engine.getMoves();
    session.turn = engine.getTurn();
    session.updatedAt = Date.now();

    // 检查游戏是否结束
    const opponent = request.player === 'red' ? 'black' : 'red';
    if (engine.isCheckmate(opponent)) {
      session.status = request.player === 'red' ? 'red_win' : 'black_win';
    } else if (engine.isStalemate(opponent)) {
      session.status = 'draw';
    }

    // 如果对手是AI且游戏未结束，触发AI走棋
    const opponentPlayer = session.players[opponent];
    if (opponentPlayer.type === 'ai' && session.status === 'playing') {
      this.makeAIMove(gameId, opponent, opponentPlayer.model);
    }

    return {
      board: session.board,
      turn: session.turn,
      moves: session.moves,
      status: session.status,
      lastMove: request
    };
  }

  /**
   * AI走棋
   */
  private async makeAIMove(gameId: string, role: 'red' | 'black', model?: string): Promise<void> {
    const engine = this.games.get(gameId);
    if (!engine) return;

    const aiRequest = {
      board: engine.getBoard(),
      role,
      history: engine.getMoves()
    };

    try {
      const modelId = model || 'openai';
      const aiResponse = await this.aiAdapter.getMove(modelId, aiRequest);

      if (aiResponse) {
        engine.makeMove(aiResponse.from, aiResponse.to);
      }
    } catch (error) {
      console.error('AI move failed:', error);
    }
  }

  /**
   * 获取游戏会话
   */
  private getGameSession(gameId: string): GameSession {
    const engine = this.games.get(gameId);
    if (!engine) {
      throw new Error('Game not found');
    }

    // TODO: 从持久化存储中获取完整会话信息
    return {
      id: gameId,
      board: engine.getBoard(),
      turn: engine.getTurn(),
      moves: engine.getMoves(),
      status: engine.getStatus(),
      players: { red: { type: 'user' }, black: { type: 'user' } },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * 获取游戏状态
   */
  getGameState(gameId: string): GameState {
    const engine = this.games.get(gameId);
    if (!engine) {
      throw new Error('Game not found');
    }

    const moves = engine.getMoves();
    return {
      board: engine.getBoard(),
      turn: engine.getTurn(),
      moves,
      status: engine.getStatus(),
      lastMove: moves[moves.length - 1]
    };
  }

  /**
   * 悔棋
   */
  undo(gameId: string): GameState {
    const engine = this.games.get(gameId);
    if (!engine) {
      throw new Error('Game not found');
    }

    engine.undo();
    return this.getGameState(gameId);
  }

  /**
   * 获取提示
   */
  getHint(gameId: string): MoveRequest {
    const engine = this.games.get(gameId);
    if (!engine) {
      throw new Error('Game not found');
    }

    // 获取所有合法走法
    const legalMoves = engine.getAllLegalMoves();
    if (legalMoves.length === 0) {
      throw new Error('No legal moves available');
    }

    // 返回随机一个合法走法（TODO: 可以用AI评估）
    const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    return randomMove;
  }
}
```

**Step 2: 创建路由**

文件：`server/src/routes/game.ts`

```typescript
import { Router } from 'express';
import { GameService } from '../services/game-service';

const router = Router();
const gameService = new GameService();

// 创建游戏
router.post('/create', (req, res) => {
  try {
    const { redPlayer, blackPlayer } = req.body;
    const session = gameService.createGame({ redPlayer, blackPlayer });
    res.json(session);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 执行走法
router.post('/:gameId/move', (req, res) => {
  try {
    const { gameId } = req.params;
    const moveRequest = req.body;
    const state = gameService.makeMove(gameId, moveRequest);
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 获取游戏状态
router.get('/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const state = gameService.getGameState(gameId);
    res.json(state);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// 悔棋
router.post('/:gameId/undo', (req, res) => {
  try {
    const { gameId } = req.params;
    const state = gameService.undo(gameId);
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 获取提示
router.get('/:gameId/hint', (req, res) => {
  try {
    const { gameId } = req.params;
    const hint = gameService.getHint(gameId);
    res.json(hint);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

**Step 3: 注册路由**

文件：`server/src/app.ts`

```typescript
import gameRouter from './routes/game';

// 在 app 配置后添加
app.use('/api/game', gameRouter);
```

**Step 4: Commit**

```bash
git add server/src/routes/game.ts server/src/services/game-service.ts server/src/app.ts
git commit -m "feat: implement game API routes"
```

---

## Phase 5: 小程序前端

### Task 5.1: 创建小程序应用基础

**Files:**
- Create: `miniprogram/app.ts`
- Create: `miniprogram/app.wxss`

**Step 1: 创建应用逻辑**

文件：`miniprogram/app.ts`

```typescript
App({
  globalData: {
    serverUrl: 'http://localhost:3000',
    userInfo: null,
    currentGameId: null
  },

  onLaunch() {
    console.log('App launched');
  }
});
```

**Step 2: 创建全局样式**

文件：`miniprogram/app.wxss`

```css
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
```

**Step 3: Commit**

```bash
git add miniprogram/app.ts miniprogram/app.wxss
git commit -m "feat: setup mini program app base"
```

---

### Task 5.2: 创建棋盘组件

**Files:**
- Create: `miniprogram/components/chess-board/chess-board.ts`
- Create: `miniprogram/components/chess-board/chess-board.wxml`
- Create: `miniprogram/components/chess-board/chess-board.wxss`
- Create: `miniprogram/components/chess-board/chess-board.json`

**Step 1: 创建组件配置**

文件：`miniprogram/components/chess-board/chess-board.json`

```json
{
  "component": true,
  "usingComponents": {}
}
```

**Step 2: 创建组件模板**

文件：`miniprogram/components/chess-board/chess-board.wxml`

```xml
<view class="chess-board">
  <canvas
    type="2d"
    id="chessCanvas"
    class="board-canvas"
    bindtouchstart="onTouchStart"
    bindtouchend="onTouchEnd"
  />
</view>
```

**Step 3: 创建组件样式**

文件：`miniprogram/components/chess-board/chess-board.wxss`

```css
.chess-board {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20rpx;
}

.board-canvas {
  width: 700rpx;
  height: 780rpx;
  background-color: #DEB887;
  border-radius: 8rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.2);
}
```

**Step 4: 创建组件逻辑**

文件：`miniprogram/components/chess-board/chess-board.ts`

```typescript
Component({
  properties: {
    gameState: {
      type: Object,
      value: null
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    canvas: null,
    ctx: null,
    cellSize: 0,
    offsetX: 0,
    offsetY: 0,
    selectedPiece: null
  },

  lifetimes: {
    attached() {
      this.initCanvas();
    }
  },

  observers: {
    'gameState': function(gameState: any) {
      if (gameState) {
        this.drawBoard();
      }
    }
  },

  methods: {
    /**
     * 初始化Canvas
     */
    async initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#chessCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return;

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;

          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);

          const width = res[0].width;
          const height = res[0].height;

          // 计算格子大小
          const cellSize = Math.min(width / 9, height / 10);
          const offsetX = (width - cellSize * 8) / 2;
          const offsetY = (height - cellSize * 9) / 2;

          this.setData({ canvas, ctx, cellSize, offsetX, offsetY });
          this.drawBoard();
        });
    },

    /**
     * 绘制棋盘
     */
    drawBoard() {
      const { ctx, cellSize, offsetX, offsetY, gameState } = this.data;
      if (!ctx || !gameState) return;

      const { board, lastMove } = gameState;

      // 清空画布
      ctx.clearRect(0, 0, 1000, 1000);

      // 绘制棋盘线
      this.drawGrid();

      // 绘制楚河汉界
      this.drawRiver();

      // 绘制九宫
      this.drawPalace();

      // 绘制棋子
      this.drawPieces(board);

      // 高亮最后一走
      if (lastMove) {
        this.highlightLastMove(lastMove);
      }

      // 高亮选中棋子
      if (this.data.selectedPiece) {
        this.highlightPiece(this.data.selectedPiece);
      }
    },

    /**
     * 绘制网格
     */
    drawGrid() {
      const { ctx, cellSize, offsetX, offsetY } = this.data;

      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 1;

      // 横线
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + i * cellSize);
        ctx.lineTo(offsetX + 8 * cellSize, offsetY + i * cellSize);
        ctx.stroke();
      }

      // 竖线（楚河汉界断开）
      for (let i = 0; i < 9; i++) {
        // 上半部分
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cellSize, offsetY);
        ctx.lineTo(offsetX + i * cellSize, offsetY + 4 * cellSize);
        ctx.stroke();

        // 下半部分
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cellSize, offsetY + 5 * cellSize);
        ctx.lineTo(offsetX + i * cellSize, offsetY + 9 * cellSize);
        ctx.stroke();
      }

      // 左右边线连通
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + 4 * cellSize);
      ctx.lineTo(offsetX, offsetY + 5 * cellSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offsetX + 8 * cellSize, offsetY + 4 * cellSize);
      ctx.lineTo(offsetX + 8 * cellSize, offsetY + 5 * cellSize);
      ctx.stroke();
    },

    /**
     * 绘制楚河汉界
     */
    drawRiver() {
      const { ctx, cellSize, offsetX, offsetY } = this.data;

      ctx.save();
      ctx.font = '24px KaiTi';
      ctx.fillStyle = '#8B4513';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillText('楚 河', offsetX + 2 * cellSize, offsetY + 4.5 * cellSize);
      ctx.fillText('汉 界', offsetX + 6 * cellSize, offsetY + 4.5 * cellSize);

      ctx.restore();
    },

    /**
     * 绘制九宫
     */
    drawPalace() {
      const { ctx, cellSize, offsetX, offsetY } = this.data;
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 1;

      // 上方九宫
      ctx.beginPath();
      ctx.moveTo(offsetX + 3 * cellSize, offsetY);
      ctx.lineTo(offsetX + 5 * cellSize, offsetY + 2 * cellSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offsetX + 5 * cellSize, offsetY);
      ctx.lineTo(offsetX + 3 * cellSize, offsetY + 2 * cellSize);
      ctx.stroke();

      // 下方九宫
      ctx.beginPath();
      ctx.moveTo(offsetX + 3 * cellSize, offsetY + 7 * cellSize);
      ctx.lineTo(offsetX + 5 * cellSize, offsetY + 9 * cellSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offsetX + 5 * cellSize, offsetY + 7 * cellSize);
      ctx.lineTo(offsetX + 3 * cellSize, offsetY + 9 * cellSize);
      ctx.stroke();
    },

    /**
     * 绘制棋子
     */
    drawPieces(board: any[][]) {
      const { ctx, cellSize, offsetX, offsetY } = this.data;

      const pieceNames: Record<string, string> = {
        'red_k': '帅', 'red_a': '仕', 'red_b': '相', 'red_n': '马',
        'red_r': '车', 'red_c': '炮', 'red_p': '兵',
        'black_k': '将', 'black_a': '士', 'black_b': '象', 'black_n': '马',
        'black_r': '车', 'black_c': '炮', 'black_p': '卒'
      };

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
          const piece = board[y][x];
          if (piece) {
            const cx = offsetX + x * cellSize;
            const cy = offsetY + y * cellSize;

            // 绘制棋子底色
            ctx.beginPath();
            ctx.arc(cx, cy, cellSize * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = '#F5DEB3';
            ctx.fill();
            ctx.strokeStyle = piece.color === 'red' ? '#8B0000' : '#000';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 绘制棋子文字
            ctx.font = `${cellSize * 0.5}px KaiTi`;
            ctx.fillStyle = piece.color === 'red' ? '#8B0000' : '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const key = `${piece.color}_${piece.type}`;
            ctx.fillText(pieceNames[key] || '', cx, cy);
          }
        }
      }
    },

    /**
     * 高亮最后一走
     */
    highlightLastMove(lastMove: any) {
      const { ctx, cellSize, offsetX, offsetY } = this.data;

      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;

      // 起点框
      ctx.strokeRect(
        offsetX + lastMove.from.x * cellSize - cellSize * 0.45,
        offsetY + lastMove.from.y * cellSize - cellSize * 0.45,
        cellSize * 0.9,
        cellSize * 0.9
      );

      // 终点框
      ctx.strokeRect(
        offsetX + lastMove.to.x * cellSize - cellSize * 0.45,
        offsetY + lastMove.to.y * cellSize - cellSize * 0.45,
        cellSize * 0.9,
        cellSize * 0.9
      );
    },

    /**
     * 高亮选中棋子
     */
    highlightPiece(pos: any) {
      const { ctx, cellSize, offsetX, offsetY } = this.data;

      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        offsetX + pos.x * cellSize - cellSize * 0.45,
        offsetY + pos.y * cellSize - cellSize * 0.45,
        cellSize * 0.9,
        cellSize * 0.9
      );
    },

    /**
     * 触摸开始
     */
    onTouchStart(e: any) {
      if (this.data.disabled) return;

      const touch = e.touches[0];
      const { x, y } = this.getGridPosition(touch.x, touch.y);

      if (x < 0 || x > 8 || y < 0 || y > 9) return;

      const { gameState } = this.data;
      const piece = gameState.board[y][x];

      if (piece && piece.color === gameState.turn) {
        this.setData({ selectedPiece: { x, y } });
        this.drawBoard();
      }
    },

    /**
     * 触摸结束
     */
    onTouchEnd(e: any) {
      if (this.data.disabled || !this.data.selectedPiece) return;

      const touch = e.changedTouches[0];
      const { x, y } = this.getGridPosition(touch.x, touch.y);

      if (x < 0 || x > 8 || y < 0 || y > 9) {
        this.setData({ selectedPiece: null });
        this.drawBoard();
        return;
      }

      const from = this.data.selectedPiece;
      const to = { x, y };

      this.setData({ selectedPiece: null });

      // 触发走子事件
      this.triggerEvent('move', { from, to });
    },

    /**
     * 获取网格坐标
     */
    getGridPosition(clientX: number, clientY: number) {
      const query = this.createSelectorQuery();
      // 简化处理，实际需要获取canvas位置
      // 这里返回相对坐标
      return { x: Math.floor(clientX / 80), y: Math.floor(clientY / 80) };
    }
  }
});
```

**Step 5: Commit**

```bash
git add miniprogram/components/chess-board/
git commit -m "feat: implement chess board component"
```

---

### Task 5.3: 创建游戏页面

**Files:**
- Create: `miniprogram/pages/game/game.ts`
- Create: `miniprogram/pages/game/game.wxml`
- Create: `miniprogram/pages/game/game.wxss`
- Create: `miniprogram/pages/game/game.json`

**Step 1: 创建页面配置**

文件：`miniprogram/pages/game/game.json`

```json
{
  "usingComponents": {
    "chess-board": "/components/chess-board/chess-board",
    "control-panel": "/components/control-panel/control-panel",
    "game-status": "/components/game-status/game-status"
  },
  "navigationBarTitleText": "中国象棋"
}
```

**Step 2: 创建页面模板**

文件：`miniprogram/pages/game/game.wxml`

```xml
<view class="game-page">
  <view class="status-bar">
    <game-status
      turn="{{gameState.turn}}"
      status="{{gameState.status}}"
      lastMove="{{gameState.lastMove}}"
    />
  </view>

  <view class="board-container">
    <chess-board
      gameState="{{gameState}}"
      disabled="{{isThinking}}"
      bind:move="onMove"
    />
  </view>

  <view class="controls">
    <control-panel
      canUndo="{{gameState.moves.length > 0}}"
      canHint="{{true}}"
      isThinking="{{isThinking}}"
      bind:undo="onUndo"
      bind:hint="onHint"
      bind:restart="onRestart"
    />
  </view>
</view>
```

**Step 3: 创建页面样式**

文件：`miniprogram/pages/game/game.wxss`

```css
.game-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

.status-bar {
  padding: 20rpx;
  background-color: #fff;
  border-bottom: 1rpx solid #eee;
}

.board-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20rpx;
}

.controls {
  background-color: #fff;
  padding: 20rpx;
  border-top: 1rpx solid #eee;
}
```

**Step 4: 创建页面逻辑**

文件：`miniprogram/pages/game/game.ts`

```typescript
const app = getApp();

Page({
  data: {
    gameState: {
      board: [],
      turn: 'red',
      moves: [],
      status: 'playing',
      lastMove: null
    },
    isThinking: false,
    gameId: null
  },

  onLoad(options: any) {
    // 创建新游戏
    this.createGame();
  },

  /**
   * 创建游戏
   */
  async createGame() {
    wx.showLoading({ title: '创建游戏...' });

    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/game/create`,
        method: 'POST',
        data: {
          redPlayer: { type: 'user' },
          blackPlayer: { type: 'ai', model: 'openai' }
        }
      });

      this.setData({
        gameId: res.data.id,
        gameState: res.data
      });
    } catch (error) {
      wx.showToast({ title: '创建失败', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 执行走法
   */
  async onMove(e: any) {
    const { from, to } = e.detail;

    // 前端校验
    if (!this.validateMoveFrontend(from, to)) {
      wx.showToast({ title: '非法走法', icon: 'none' });
      return;
    }

    // 乐观更新UI
    this.optimisticUpdate(from, to);

    // 发送到后端
    await this.sendMove(from, to);
  },

  /**
   * 前端校验（简化版）
   */
  validateMoveFrontend(from: any, to: any): boolean {
    // TODO: 实现基本走法校验
    return true;
  },

  /**
   * 乐观更新
   */
  optimisticUpdate(from: any, to: any) {
    const { gameState } = this.data;
    const board = JSON.parse(JSON.stringify(gameState.board));

    // 移动棋子
    const piece = board[from.y][from.x];
    board[to.y][to.x] = piece;
    board[from.y][from.x] = null;

    this.setData({
      gameState: {
        ...gameState,
        board,
        turn: gameState.turn === 'red' ? 'black' : 'red',
        lastMove: { from, to }
      }
    });
  },

  /**
   * 发送走法到后端
   */
  async sendMove(from: any, to: any) {
    const { gameId } = this.data;

    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/game/${gameId}/move`,
        method: 'POST',
        data: {
          from,
          to,
          player: this.data.gameState.turn === 'red' ? 'black' : 'red'
        }
      });

      // 后端确认，更新状态
      this.setData({ gameState: res.data });

      // 检查游戏结束
      if (res.data.status !== 'playing') {
        this.showGameEnd(res.data.status);
      }
    } catch (error) {
      wx.showToast({ title: '走法无效', icon: 'none' });
      // 回滚状态
      this.rollbackState();
    }
  },

  /**
   * 悔棋
   */
  async onUndo() {
    const { gameId } = this.data;

    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/game/${gameId}/undo`,
        method: 'POST'
      });

      this.setData({ gameState: res.data });
    } catch (error) {
      wx.showToast({ title: '悔棋失败', icon: 'error' });
    }
  },

  /**
   * 获取提示
   */
  async onHint() {
    const { gameId } = this.data;

    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/game/${gameId}/hint`,
        method: 'GET'
      });

      const hint = res.data;
      wx.showModal({
        title: '提示',
        content: `建议走法: (${hint.from.x},${hint.from.y}) -> (${hint.to.x},${hint.to.y})`
      });
    } catch (error) {
      wx.showToast({ title: '获取提示失败', icon: 'error' });
    }
  },

  /**
   * 重新开始
   */
  onRestart() {
    wx.showModal({
      title: '重新开始',
      content: '确定要重新开始吗？',
      success: (res) => {
        if (res.confirm) {
          this.createGame();
        }
      }
    });
  },

  /**
   * 显示游戏结束
   */
  showGameEnd(status: string) {
    const messages: Record<string, string> = {
      'red_win': '红方获胜！',
      'black_win': '黑方获胜！',
      'draw': '和棋！'
    };

    wx.showModal({
      title: '游戏结束',
      content: messages[status] || '游戏结束',
      showCancel: false,
      success: () => {
        this.createGame();
      }
    });
  }
});
```

**Step 5: Commit**

```bash
git add miniprogram/pages/game/
git commit -m "feat: implement game page"
```

---

## Phase 6: 控制面板组件

### Task 6.1: 创建控制面板组件

**Files:**
- Create: `miniprogram/components/control-panel/control-panel.ts`
- Create: `miniprogram/components/control-panel/control-panel.wxml`
- Create: `miniprogram/components/control-panel/control-panel.wxss`
- Create: `miniprogram/components/control-panel/control-panel.json`

**Step 1: 创建组件配置**

文件：`miniprogram/components/control-panel/control-panel.json`

```json
{
  "component": true
}
```

**Step 2: 创建组件模板**

文件：`miniprogram/components/control-panel/control-panel.wxml`

```xml
<view class="control-panel">
  <button
    class="control-btn"
    disabled="{{!canUndo}}"
    bind:tap="onUndo"
  >
    悔棋
  </button>

  <button
    class="control-btn primary"
    disabled="{{!canHint}}"
    bind:tap="onHint"
  >
    提示
  </button>

  <button
    class="control-btn"
    bind:tap="onRestart"
  >
    重新开始
  </button>
</view>
```

**Step 3: 创建组件样式**

文件：`miniprogram/components/control-panel/control-panel.wxss`

```css
.control-panel {
  display: flex;
  justify-content: space-around;
  padding: 20rpx;
}

.control-btn {
  flex: 1;
  margin: 0 10rpx;
  padding: 24rpx;
  border-radius: 8rpx;
  font-size: 32rpx;
  background-color: #fff;
  border: 1rpx solid #ddd;
}

.control-btn.primary {
  background-color: #8B4513;
  color: #fff;
  border-color: #8B4513;
}

.control-btn[disabled] {
  opacity: 0.5;
}
```

**Step 4: 创建组件逻辑**

文件：`miniprogram/components/control-panel/control-panel.ts`

```typescript
Component({
  properties: {
    canUndo: {
      type: Boolean,
      value: false
    },
    canHint: {
      type: Boolean,
      value: true
    },
    isThinking: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onUndo() {
      if (!this.data.canUndo) return;
      this.triggerEvent('undo');
    },

    onHint() {
      if (!this.data.canHint) return;
      this.triggerEvent('hint');
    },

    onRestart() {
      this.triggerEvent('restart');
    }
  }
});
```

**Step 5: Commit**

```bash
git add miniprogram/components/control-panel/
git commit -m "feat: implement control panel component"
```

---

## Phase 7: 测试与部署

### Task 7.1: 添加Jest配置

**Files:**
- Create: `server/jest.config.js`

**Step 1: 创建Jest配置**

文件：`server/jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

**Step 2: 更新package.json**

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Step 3: Commit**

```bash
git add server/jest.config.js server/package.json
git commit -m "test: add Jest configuration"
```

---

### Task 7.2: 集成测试

**Files:**
- Create: `server/tests/integration/game-flow.test.ts`

**Step 1: 编写集成测试**

文件：`server/tests/integration/game-flow.test.ts`

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { GameService } from '../../src/services/game-service';

describe('Game Flow Integration', () => {
  let gameService: GameService;

  beforeEach(() => {
    gameService = new GameService();
  });

  it('should complete a full game flow', async () => {
    // 创建游戏
    const session = gameService.createGame({
      redPlayer: { type: 'user' },
      blackPlayer: { type: 'ai', model: 'openai' }
    });

    expect(session.status).toBe('playing');
    expect(session.turn).toBe('red');

    // 执行走法
    const moveRequest = {
      from: { x: 4, y: 6 },
      to: { x: 4, y: 5 },
      player: 'red'
    };

    const newState = await gameService.makeMove(session.id, moveRequest);

    expect(newState.turn).toBe('black');
    expect(newState.moves.length).toBeGreaterThan(0);
  });

  it('should handle undo correctly', () => {
    const session = gameService.createGame({
      redPlayer: { type: 'user' },
      blackPlayer: { type: 'user' }
    });

    const beforeUndo = gameService.getGameState(session.id);
    const movesCount = beforeUndo.moves.length;

    const afterUndo = gameService.undo(session.id);

    expect(afterUndo.moves.length).toBe(movesCount - 1);
  });
});
```

**Step 2: Commit**

```bash
git add server/tests/integration/
git commit -m "test: add integration tests"
```

---

### Task 7.3: 创建部署文档

**Files:**
- Create: `docs/deployment.md`

**Step 1: 创建部署文档**

文件：`docs/deployment.md`

```markdown
# 部署指南

## 后端部署

### 环境要求
- Node.js 20+
- Redis 7+
- Nginx (可选)

### 步骤

1. 安装依赖
```bash
cd server
npm install --production
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入实际的API Key
```

3. 构建TypeScript
```bash
npm run build
```

4. 启动服务
```bash
npm start
# 或使用 PM2
pm2 start dist/index.js --name chess-api
```

## 小程序部署

1. 使用微信开发者工具打开 `miniprogram` 目录

2. 填写 AppID

3. 点击"上传"按钮

4. 在微信公众平台提交审核

## 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| PORT | 服务端口 | 否 |
| REDIS_URL | Redis连接 | 是 |
| OPENAI_API_KEY | OpenAI密钥 | 是 |
| CORS_ORIGIN | 允许的跨域源 | 是 |
```

**Step 2: Commit**

```bash
git add docs/deployment.md
git commit -m "docs: add deployment guide"
```

---

## 实施检查清单

### Phase 1: 项目初始化
- [ ] Task 1.1: 初始化项目结构
- [ ] Task 1.2: 创建核心数据类型定义

### Phase 2: 规则引擎
- [ ] Task 2.1: 创建初始棋盘
- [ ] Task 2.2: 实现兵/卒走法校验
- [ ] Task 2.3: 实现车走法校验
- [ ] Task 2.4: 实现马走法校验
- [ ] Task 2.5: 实现象走法校验
- [ ] Task 2.6: 实现士和将走法校验
- [ ] Task 2.7: 实现炮走法校验
- [ ] Task 2.8: 实现将军和困毙检测

### Phase 3: AI适配器
- [ ] Task 3.1: 创建AI适配器基础结构

### Phase 4: 后端API
- [ ] Task 4.1: 创建Express服务器基础
- [ ] Task 4.2: 创建游戏API路由

### Phase 5: 小程序前端
- [ ] Task 5.1: 创建小程序应用基础
- [ ] Task 5.2: 创建棋盘组件
- [ ] Task 5.3: 创建游戏页面

### Phase 6: 控制面板
- [ ] Task 6.1: 创建控制面板组件

### Phase 7: 测试与部署
- [ ] Task 7.1: 添加Jest配置
- [ ] Task 7.2: 集成测试
- [ ] Task 7.3: 创建部署文档

---

**文档版本：** 1.0
**创建日期：** 2025-02-01
**预计工时：** 15个工作日
