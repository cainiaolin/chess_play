// 棋子类型
export type PieceType = 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p'; // 将士象马车炮兵
export type PieceColor = 'red' | 'black';

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
export type GameStatus = 'playing' | 'red_win' | 'black_win' | 'draw' | 'paused';

// 计时模式
export type TimerMode = 'per_move' | 'total_time';

// 游戏配置
export interface GameOptions {
  timerMode: TimerMode;      // 计时模式
  moveTimeLimit?: number;    // 单步限时（秒），per_move模式使用
  redTimeLimit?: number;     // 红方总时限（秒），total_time模式使用
  blackTimeLimit?: number;   // 黑方总时限（秒），total_time模式使用
  firstPlayer?: 'red' | 'black' | 'random'; // 先手选择
  allowUndo?: boolean;       // 是否允许悔棋
  autoForfeit?: boolean;     // 非法走子是否自动判负
  aiThinkDelay?: number;     // AI思考延迟（毫秒）
  aiRetryOnError?: boolean;  // AI走法非法时是否重试（true=重试最多3次，false=直接判负）
  drawOnNoCapture?: number;  // 无吃子回合数判和（默认60）
}

// 计时器状态
export interface TimerState {
  mode: TimerMode;
  redTimeRemaining: number;  // 红方剩余时间（秒）
  blackTimeRemaining: number; // 黑方剩余时间（秒）
  currentMoveStartTime: number; // 当前步开始时间（时间戳）
  lastUpdateTime: number;    // 上次更新时间（时间戳）
}

// 游戏结束原因
export type GameEndReason =
  | 'checkmate'        // 将死
  | 'stalemate'        // 困毙
  | 'resignation'      // 认输
  | 'timeout'          // 超时
  | 'illegal_move'     // 非法走子（判负）
  | 'draw_agreement'   // 和棋协议
  | 'repetition'       // 重复局面
  | 'no_capture_draw'  // 无吃子判和
  | 'max_moves_draw';  // 最大回合判和

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
  options: GameOptions;       // 游戏配置
  timer?: TimerState;         // 计时器状态
  endReason?: GameEndReason;  // 游戏结束原因
  createdAt: number;
  updatedAt: number;
}

// 玩家（用户或AI）
export interface Player {
  type: 'user' | 'ai';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
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
