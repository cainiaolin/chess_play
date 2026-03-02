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

// 走法验证结果
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}
