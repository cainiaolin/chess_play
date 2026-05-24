import { v4 as uuidv4 } from 'uuid';
import { ChessEngine } from './chess-engine';
import { AIAdapter } from './ai-adapter';
import { TimerService } from './timer-service';
import {
  Board,
  Move,
  Position,
  GameStatus,
  Player,
  GameSession,
  MoveRequest,
  AIRequest,
  AIResponse,
  GameOptions,
  GameEndReason,
  TimerMode,
  TimerState
} from '../types/chess';

/**
 * 游戏配置接口
 */
export interface GameConfig {
  redPlayer: {
    type: 'user' | 'ai';
  };
  blackPlayer: {
    type: 'user' | 'ai';
  };
  options?: Partial<GameOptions>;
}

/**
 * 游戏状态响应
 */
export interface GameStateResponse {
  id: string;
  board: Board;
  turn: 'red' | 'black';
  status: GameStatus;
  moves: Move[];
  players: {
    red: Player;
    black: Player;
  };
  options: GameOptions;
  timer?: {
    mode: TimerMode;
    redTimeRemaining: number;
    blackTimeRemaining: number;
    isLastTenSeconds?: {
      red: boolean;
      black: boolean;
    };
  };
  endReason?: GameEndReason;
  createdAt: number;
  updatedAt: number;
}

/**
 * 游戏服务类
 * 管理所有游戏会话
 */
export class GameService {
  private games: Map<string, GameSession>;
  private timers: Map<string, TimerService>;
  private aiAdapter: AIAdapter;
  private io: any;

  // 默认游戏选项
  private static readonly DEFAULT_OPTIONS: GameOptions = {
    timerMode: 'per_move',
    moveTimeLimit: 60,
    redTimeLimit: 600,
    blackTimeLimit: 600,
    firstPlayer: 'red',
    allowUndo: true,
    autoForfeit: true,
    aiThinkDelay: 1000,
    aiRetryOnError: true,
    drawOnNoCapture: 60
  };

  constructor(io?: any) {
    this.games = new Map();
    this.timers = new Map();
    this.io = io;
    this.aiAdapter = new AIAdapter();
  }

  /**
   * 设置Socket.IO实例（用于广播游戏状态更新）
   */
  setIO(io: any): void {
    this.io = io;
  }

  /**
   * 创建新游戏
   */
  createGame(config: GameConfig): GameStateResponse {
    const engine = new ChessEngine();
    const gameId = uuidv4();
    const now = Date.now();

    // 合并默认选项和自定义选项
    const options: GameOptions = {
      ...GameService.DEFAULT_OPTIONS,
      ...config.options
    };

    // 确定先手
    let firstTurn: 'red' | 'black' = 'red';
    if (options.firstPlayer === 'random') {
      firstTurn = Math.random() > 0.5 ? 'red' : 'black';
    } else if (options.firstPlayer === 'black') {
      firstTurn = 'black';
    }

    // 设置引擎的回合（关键：确保引擎内部回合与游戏回合一致）
    engine.setTurn(firstTurn);

    const game: GameSession = {
      id: gameId,
      board: engine.getBoard(),
      turn: firstTurn,
      moves: engine.getMoves(),
      status: engine.getStatus(),
      players: {
        red: config.redPlayer,
        black: config.blackPlayer
      },
      options,
      createdAt: now,
      updatedAt: now
    };

    // 保存引擎实例（通过闭包或WeakRef）
    (game as any)._engine = engine;

    this.games.set(gameId, game);

    // 初始化计时器
    const timerService = new TimerService();
    const timerState = timerService.initialize(options, firstTurn);
    game.timer = timerState;
    this.timers.set(gameId, timerService);

    // 启动计时器
    timerService.start(
      (color) => this.handleTimeout(gameId, color),
      (state) => this.updateTimerState(gameId, state)
    );

    console.log(`游戏已创建: ${gameId}, 红方: ${config.redPlayer.type}, 黑方: ${config.blackPlayer.type}`);

    return this.getGameStateResponse(game);
  }

  /**
   * 处理超时
   */
  private handleTimeout(gameId: string, color: 'red' | 'black'): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const winner = color === 'red' ? 'black' : 'red';
    game.status = winner === 'red' ? 'red_win' : 'black_win';
    game.endReason = 'timeout';
    game.updatedAt = Date.now();

    // 停止计时器
    const timer = this.timers.get(gameId);
    if (timer) timer.stop();

    console.log(`游戏 ${gameId} ${color} 方超时，${winner} 方获胜`);

    // 通知客户端
    if (this.io) {
      this.io.to(`game:${gameId}`).emit('game:ended', {
        gameId,
        winner,
        reason: 'timeout',
        message: `${color === 'red' ? '红方' : '黑方'}超时，${winner === 'red' ? '红方' : '黑方'}获胜`
      });
    }
  }

  /**
   * 更新计时器状态
   */
  private updateTimerState(gameId: string, state: any): void {
    const game = this.games.get(gameId);
    if (!game) return;

    game.timer = state;
    game.updatedAt = Date.now();

    // 通知客户端计时器更新
    if (this.io) {
      this.io.to(`game:${gameId}`).emit('game:timer-update', {
        gameId,
        timer: state
      });
    }
  }

  /**
   * 获取游戏引擎
   */
  private getEngine(gameId: string): ChessEngine {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`游戏不存在: ${gameId}`);
    }

    const engine = (game as any)._engine;
    if (!engine) {
      throw new Error(`游戏引擎不存在: ${gameId}`);
    }

    return engine;
  }

  /**
   * 执行走法
   */
  async makeMove(gameId: string, request: MoveRequest): Promise<{
    success: boolean;
    move?: Move;
    aiMove?: AIResponse;
    error?: string;
    gameState?: GameStateResponse;
  }> {
    try {
      const engine = this.getEngine(gameId);
      const game = this.games.get(gameId);

      if (!game) {
        return { success: false, error: '游戏不存在' };
      }

      // 检查游戏是否已暂停
      if (game.status === 'paused') {
        return { success: false, error: '游戏已暂停' };
      }

      // 验证是否是该玩家的回合
      if (game.turn !== request.player) {
        return { success: false, error: '不是该玩家的回合' };
      }

      // 执行走法
      engine.makeMove(request.from, request.to);

      // 更新游戏状态
      game.board = engine.getBoard();
      game.turn = engine.getTurn();
      game.moves = engine.getMoves();
      game.status = engine.getStatus();
      game.updatedAt = Date.now();

      const lastMove = game.moves[game.moves.length - 1];

      console.log(`走法已执行: ${gameId}, 从 (${request.from.x},${request.from.y}) 到 (${request.to.x},${request.to.y})`);

      // 切换计时器回合
      const timer = this.timers.get(gameId);
      if (timer) {
        timer.switchTurn(game.turn);
      }

      // 广播游戏状态更新（如果有Socket.IO实例）
      if (this.io) {
        this.io.to(`game:${gameId}`).emit('game:state-update', {
          gameId,
          gameState: this.getGameStateResponse(game),
          move: lastMove,
          timestamp: Date.now()
        });
      }

      // 检查是否需要AI走棋
      let aiMove: AIResponse | undefined;
      let aiError: string | undefined;
      if (game.status === 'playing') {
        const currentPlayer = game.turn === 'red' ? game.players.red : game.players.black;
        if (currentPlayer.type === 'ai') {
          console.log(`AI走棋中: ${gameId}`);
          try {
            aiMove = await this.getAIMove(gameId);
          } catch (error) {
            // AI调用失败不应阻塞用户移动，记录错误但继续返回
            aiError = error instanceof Error ? error.message : 'AI调用失败';
            console.error(`AI走棋失败 (${gameId}):`, aiError);

            // AI失败时需要将回合切换回人类玩家
            // 此时 game.turn 是 AI 的颜色（getAIMove 内部 engine.makeMove 未执行）
            // 将 turn 切回人类玩家，使游戏能继续进行
            const humanColor = game.turn === 'red' ? 'black' : 'red';
            game.turn = humanColor;
            game.updatedAt = Date.now();
            console.log(`AI走棋失败，回合已切回: ${gameId}, 当前回合: ${game.turn}`);
          }
        }
      }

      // AI 走棋后同步计时器并广播（用户走子后已在上方 switchTurn，此处仅补 AI 回合结束后状态）
      if (aiMove && !aiError) {
        const timerAfterAi = this.timers.get(gameId);
        if (timerAfterAi) {
          timerAfterAi.switchTurn(game.turn);
        }
        if (this.io) {
          const last = game.moves[game.moves.length - 1];
          this.io.to(`game:${gameId}`).emit('game:state-update', {
            gameId,
            gameState: this.getGameStateResponse(game),
            move: last,
            timestamp: Date.now()
          });
        }
      }

      return {
        success: true,
        move: lastMove,
        aiMove,
        error: aiError,
        gameState: this.getGameStateResponse(game)
      };
    } catch (error) {
      console.error(`走法执行失败: ${gameId}`, error);

      // 如果配置了非法走子自动判负
      const game = this.games.get(gameId);
      if (game?.options?.autoForfeit) {
        const winner = game.turn === 'red' ? 'black' : 'red';
        game.status = winner === 'red' ? 'red_win' : 'black_win';
        game.endReason = 'illegal_move';
        game.updatedAt = Date.now();

        const timer = this.timers.get(gameId);
        if (timer) timer.stop();

        if (this.io) {
          this.io.to(`game:${gameId}`).emit('game:ended', {
            gameId,
            winner,
            reason: 'illegal_move',
            message: `${game.turn === 'red' ? '红方' : '黑方'}非法走子，${winner === 'red' ? '红方' : '黑方'}获胜`
          });
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  private static readonly AI_MAX_RETRIES = 3;

  /**
   * 获取AI走法（使用后端 .env 统一配置的模型）
   * 根据 game.options.aiRetryOnError 决定非法走法时重试还是直接判负
   */
  private async getAIMove(gameId: string): Promise<AIResponse> {
    const engine = this.getEngine(gameId);
    const game = this.games.get(gameId);

    if (!game) {
      throw new Error('游戏不存在');
    }

    const maxRetries = game.options.aiRetryOnError ? GameService.AI_MAX_RETRIES : 0;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const aiRequest: AIRequest = {
          board: engine.getBoard(),
          role: engine.getTurn(),
          history: engine.getMoves()
        };

        const aiResponse = await this.aiAdapter.getMove(undefined, aiRequest);

        // 执行AI走法
        engine.makeMove(aiResponse.from, aiResponse.to);

        // 更新游戏状态
        game.board = engine.getBoard();
        game.turn = engine.getTurn();
        game.moves = engine.getMoves();
        game.status = engine.getStatus();
        game.updatedAt = Date.now();

        if (attempt > 0) {
          console.log(`AI 第 ${attempt + 1} 次尝试成功: ${gameId}`);
        }
        console.log(`AI走法已执行: ${gameId}, 从 (${aiResponse.from.x},${aiResponse.from.y}) 到 (${aiResponse.to.x},${aiResponse.to.y})`);

        return aiResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          console.warn(`AI 走法失败 (第 ${attempt + 1} 次), 重试中: ${lastError.message}`);
        }
      }
    }

    throw lastError || new Error('AI 走棋失败');
  }

  /**
   * 执行当前回合 AI 的一步（开局先手为 AI、或双 AI 观战模式）
   */
  async stepAiMove(gameId: string): Promise<{
    success: boolean;
    move?: Move;
    aiThinking?: string;
    error?: string;
    gameState?: GameStateResponse;
  }> {
    try {
      const game = this.games.get(gameId);
      if (!game) {
        return { success: false, error: '游戏不存在' };
      }
      if (game.status === 'paused') {
        return { success: false, error: '游戏已暂停' };
      }
      if (game.status !== 'playing') {
        return { success: false, error: '游戏已结束' };
      }

      const currentPlayer = game.turn === 'red' ? game.players.red : game.players.black;
      if (currentPlayer.type !== 'ai') {
        return { success: false, error: '当前不是 AI 回合' };
      }

      const lastBefore = game.moves.length;
      const aiResponse = await this.getAIMove(gameId);

      const timer = this.timers.get(gameId);
      if (timer) {
        timer.switchTurn(game.turn);
      }

      const lastMove = game.moves[game.moves.length - 1];
      if (!lastMove || game.moves.length <= lastBefore) {
        return { success: false, error: 'AI 未产生有效走法' };
      }

      if (this.io) {
        this.io.to(`game:${gameId}`).emit('game:state-update', {
          gameId,
          gameState: this.getGameStateResponse(game),
          move: lastMove,
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        move: lastMove,
        aiThinking: aiResponse.thinking,
        gameState: this.getGameStateResponse(game)
      };
    } catch (error) {
      console.error(`AI 步进失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 走棋失败'
      };
    }
  }

  /**
   * 获取游戏状态
   */
  getGameState(gameId: string): GameStateResponse | null {
    const game = this.games.get(gameId);
    if (!game) {
      return null;
    }

    return this.getGameStateResponse(game);
  }

  /**
   * 获取游戏状态响应
   */
  private getGameStateResponse(game: GameSession): GameStateResponse {
    const timer = this.timers.get(game.id);
    const timerState = timer?.getState();

    return {
      id: game.id,
      board: game.board,
      turn: game.turn,
      status: game.status,
      moves: game.moves,
      players: game.players,
      options: game.options,
      timer: timerState ? {
        mode: timerState.mode,
        redTimeRemaining: timerState.redTimeRemaining,
        blackTimeRemaining: timerState.blackTimeRemaining,
        isLastTenSeconds: {
          red: timer ? timer.isLastTenSeconds('red') : false,
          black: timer ? timer.isLastTenSeconds('black') : false
        }
      } : undefined,
      endReason: game.endReason,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt
    };
  }

  /**
   * 悔棋
   */
  undo(gameId: string): {
    success: boolean;
    error?: string;
    gameState?: GameStateResponse;
  } {
    try {
      const engine = this.getEngine(gameId);
      const game = this.games.get(gameId);

      if (!game) {
        return { success: false, error: '游戏不存在' };
      }

      const moves = engine.getMoves();

      if (moves.length === 0) {
        return { success: false, error: '没有可以悔的棋' };
      }

      // 检查最后一步是否是AI走的
      const lastMove = moves[moves.length - 1];
      const currentPlayer = game.turn === 'red' ? game.players.red : game.players.black;
      const lastPlayer = game.turn === 'red' ? game.players.black : game.players.red;

      // 如果最后一步是AI走的，需要悔两步（AI一步 + 玩家一步）
      if (lastPlayer.type === 'ai') {
        if (moves.length < 2) {
          return { success: false, error: '需要至少两步才能悔棋' };
        }
        // 悔两步
        moves.pop();
        moves.pop();
      } else {
        // 悔一步
        moves.pop();
      }

      // 重新构建游戏状态
      // 注意：这里需要重新初始化引擎并重放所有走法
      const newEngine = new ChessEngine();
      for (const move of moves) {
        newEngine.makeMove(move.from, move.to);
      }

      // 更新游戏
      (game as any)._engine = newEngine;
      game.board = newEngine.getBoard();
      game.turn = newEngine.getTurn();
      game.moves = newEngine.getMoves();
      game.status = newEngine.getStatus();
      game.updatedAt = Date.now();

      console.log(`悔棋成功: ${gameId}, 剩余 ${moves.length} 步`);

      return {
        success: true,
        gameState: this.getGameStateResponse(game)
      };
    } catch (error) {
      console.error(`悔棋失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取提示（使用AI分析）
   */
  async getHint(gameId: string): Promise<{
    success: boolean;
    hint?: AIResponse;
    error?: string;
  }> {
    try {
      const engine = this.getEngine(gameId);
      const game = this.games.get(gameId);

      if (!game) {
        return { success: false, error: '游戏不存在' };
      }

      if (game.status !== 'playing') {
        return { success: false, error: '游戏已结束' };
      }

      const aiRequest: AIRequest = {
        board: engine.getBoard(),
        role: engine.getTurn(),
        history: engine.getMoves()
      };

      const hint = await this.aiAdapter.getMove(undefined, aiRequest);

      console.log(`提示已生成: ${gameId}`);

      return {
        success: true,
        hint
      };
    } catch (error) {
      console.error(`获取提示失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 删除游戏
   */
  deleteGame(gameId: string): boolean {
    return this.games.delete(gameId);
  }

  /**
   * 获取所有游戏ID
   */
  getAllGameIds(): string[] {
    return Array.from(this.games.keys());
  }

  /**
   * 获取所有游戏的简要信息（用于观战列表）
   */
  getAllGamesSummary(): Array<{
    id: string;
    turn: 'red' | 'black';
    status: GameStatus;
    moves: number;
    players: {
      red: { type: string; model?: string };
      black: { type: string; model?: string };
    };
    createdAt: number;
  }> {
    const result: Array<any> = [];
    this.games.forEach((game, id) => {
      result.push({
        id,
        turn: game.turn,
        status: game.status,
        moves: game.moves.length,
        players: {
          red: { type: game.players.red.type, model: game.players.red.model },
          black: { type: game.players.black.type, model: game.players.black.model }
        },
        createdAt: game.createdAt
      });
    });
    return result;
  }

  /**
   * 获取游戏数量
   */
  getGameCount(): number {
    return this.games.size;
  }

  /**
   * 获取指定位置棋子的所有合法走法
   */
  getValidMoves(gameId: string, position: Position): {
    success: boolean;
    piece?: { type: string; color: string };
    validMoves?: Array<{ to: Position }>;
    error?: string;
  } {
    try {
      const engine = this.getEngine(gameId);
      const game = this.games.get(gameId);

      if (!game) {
        return { success: false, error: '游戏不存在' };
      }

      // 检查游戏是否已结束
      if (game.status !== 'playing') {
        return { success: false, error: '游戏已结束' };
      }

      // 检查位置是否在棋盘内
      if (position.x < 0 || position.x > 8 || position.y < 0 || position.y > 9) {
        return { success: false, error: '位置不在棋盘内' };
      }

      // 获取该位置的棋子
      const piece = game.board[position.y][position.x];
      if (!piece) {
        return { success: false, error: '该位置没有棋子' };
      }

      // 检查是否是当前回合方的棋子
      if (piece.color !== game.turn) {
        return { success: false, error: '不是该方回合' };
      }

      // 遍历所有可能的目标位置，找出合法走法
      const validMoves: Array<{ to: Position }> = [];

      for (let toY = 0; toY < 10; toY++) {
        for (let toX = 0; toX < 9; toX++) {
          const to = { x: toX, y: toY };
          const validation = engine.validateMove(position, to);
          if (validation.valid) {
            validMoves.push({ to });
          }
        }
      }

      console.log(`获取有效走法: ${gameId}, 位置 (${position.x},${position.y}), 有效走法数量: ${validMoves.length}`);

      return {
        success: true,
        piece: { type: piece.type, color: piece.color },
        validMoves
      };
    } catch (error) {
      console.error(`获取有效走法失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 暂停游戏
   */
  pauseGame(gameId: string): {
    success: boolean;
    error?: string;
    gameState?: GameStateResponse;
  } {
    try {
      const game = this.games.get(gameId);
      if (!game) {
        return { success: false, error: '游戏不存在' };
      }

      if (game.status !== 'playing') {
        return { success: false, error: '游戏未进行中' };
      }

      game.status = 'paused';
      game.updatedAt = Date.now();

      // 暂停计时器
      const timer = this.timers.get(gameId);
      if (timer) {
        timer.pause();
      }

      console.log(`游戏已暂停: ${gameId}`);

      // 通知客户端
      if (this.io) {
        this.io.to(`game:${gameId}`).emit('game:paused', {
          gameId,
          gameState: this.getGameStateResponse(game)
        });
      }

      return {
        success: true,
        gameState: this.getGameStateResponse(game)
      };
    } catch (error) {
      console.error(`暂停游戏失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 继续游戏
   */
  resumeGame(gameId: string): {
    success: boolean;
    error?: string;
    gameState?: GameStateResponse;
  } {
    try {
      const game = this.games.get(gameId);
      if (!game) {
        return { success: false, error: '游戏不存在' };
      }

      if (game.status !== 'paused') {
        return { success: false, error: '游戏未暂停' };
      }

      game.status = 'playing';
      game.updatedAt = Date.now();

      // 恢复计时器
      const timer = this.timers.get(gameId);
      if (timer) {
        timer.resume(
          (color) => this.handleTimeout(gameId, color),
          (state) => this.updateTimerState(gameId, state)
        );
      }

      console.log(`游戏已继续: ${gameId}`);

      // 通知客户端
      if (this.io) {
        this.io.to(`game:${gameId}`).emit('game:resumed', {
          gameId,
          gameState: this.getGameStateResponse(game)
        });
      }

      return {
        success: true,
        gameState: this.getGameStateResponse(game)
      };
    } catch (error) {
      console.error(`继续游戏失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 强制结束游戏
   */
  endGame(gameId: string, winner: 'red' | 'black' | 'draw', reason: GameEndReason): {
    success: boolean;
    error?: string;
    gameState?: GameStateResponse;
  } {
    try {
      const game = this.games.get(gameId);
      if (!game) {
        return { success: false, error: '游戏不存在' };
      }

      if (game.status === 'red_win' || game.status === 'black_win' || game.status === 'draw') {
        return { success: false, error: '游戏已结束' };
      }

      game.status = winner === 'draw' ? 'draw' : (winner === 'red' ? 'red_win' : 'black_win');
      game.endReason = reason;
      game.updatedAt = Date.now();

      // 停止计时器
      const timer = this.timers.get(gameId);
      if (timer) {
        timer.stop();
      }

      console.log(`游戏已结束: ${gameId}, 获胜方: ${winner}, 原因: ${reason}`);

      // 通知客户端
      if (this.io) {
        this.io.to(`game:${gameId}`).emit('game:ended', {
          gameId,
          winner,
          reason,
          message: this.getEndMessage(winner, reason)
        });
      }

      return {
        success: true,
        gameState: this.getGameStateResponse(game)
      };
    } catch (error) {
      console.error(`结束游戏失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取结束消息
   */
  private getEndMessage(winner: 'red' | 'black' | 'draw', reason: GameEndReason): string {
    const winnerText = winner === 'red' ? '红方' : winner === 'black' ? '黑方' : '';
    const reasonText: Record<GameEndReason, string> = {
      'checkmate': '将死',
      'stalemate': '困毙',
      'resignation': '认输',
      'timeout': '超时',
      'illegal_move': '非法走子',
      'draw_agreement': '双方和棋',
      'repetition': '重复局面',
      'no_capture_draw': '无吃子判和',
      'max_moves_draw': '最大回合判和'
    };

    if (winner === 'draw') {
      return `和棋（${reasonText[reason]}）`;
    }
    return `${winnerText}获胜（${reasonText[reason]}）`;
  }

  /**
   * 生成棋谱（中国象棋标准记谱法）
   */
  getNotation(gameId: string): {
    success: boolean;
    notation?: string;
    error?: string;
  } {
    try {
      const game = this.games.get(gameId);
      if (!game) {
        return { success: false, error: '游戏不存在' };
      }

      const notation = this.movesToNotation(game.moves);
      return {
        success: true,
        notation
      };
    } catch (error) {
      console.error(`生成棋谱失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 将走法转换为标准棋谱
   */
  private movesToNotation(moves: Move[]): string {
    const pieceNames: Record<string, { red: string; black: string }> = {
      'k': { red: '帅', black: '将' },
      'a': { red: '仕', black: '士' },
      'b': { red: '相', black: '象' },
      'n': { red: '马', black: '马' },
      'r': { red: '车', black: '车' },
      'c': { red: '炮', black: '炮' },
      'p': { red: '兵', black: '卒' }
    };

    const columnNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

    return moves.map((move, index) => {
      const isRed = index % 2 === 0; // 红方先走
      const pieceName = isRed ? pieceNames[move.piece].red : pieceNames[move.piece].black;

      // 计算移动方向和距离
      const deltaX = move.to.x - move.from.x;
      const deltaY = move.to.y - move.from.y;

      let direction: string;
      let distance: number;

      if (deltaY === 0) {
        // 横向移动
        direction = '平';
        distance = Math.abs(deltaX);
      } else if ((isRed && deltaY < 0) || (!isRed && deltaY > 0)) {
        // 前进
        direction = '进';
        distance = Math.abs(deltaY);
      } else {
        // 后退
        direction = '退';
        distance = Math.abs(deltaY);
      }

      // 目标位置表示
      let target: string;
      if (direction === '平') {
        target = columnNumbers[move.to.x];
      } else {
        // 对于纵向移动，用数字表示（红方从一到大，黑方从1到9）
        if (isRed) {
          target = columnNumbers[distance - 1];
        } else {
          target = (distance).toString();
        }
      }

      // 起始位置（用于区分相同的棋子）
      const fromPos = isRed ? columnNumbers[move.from.x] : (9 - move.from.x).toString();

      return `${pieceName}${fromPos}${direction}${target}`;
    }).join(' ');
  }

  /**
   * 获取游戏调试信息
   */
  getDebugInfo(gameId: string): {
    success: boolean;
    debug?: {
      gameState: GameStateResponse;
      timerState: any;
      moveCount: number;
      totalDuration: number;
      movesWithoutCapture: number;
    };
    error?: string;
  } {
    try {
      const game = this.games.get(gameId);
      if (!game) {
        return { success: false, error: '游戏不存在' };
      }

      const engine = this.getEngine(gameId);
      const totalDuration = game.updatedAt - game.createdAt;

      return {
        success: true,
        debug: {
          gameState: this.getGameStateResponse(game),
          timerState: game.timer,
          moveCount: game.moves.length,
          totalDuration,
          movesWithoutCapture: engine.getMovesWithoutCapture()
        }
      };
    } catch (error) {
      console.error(`获取调试信息失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 导出 FEN 字符串
   */
  getFen(gameId: string): {
    success: boolean;
    fen?: string;
    error?: string;
  } {
    try {
      const engine = this.getEngine(gameId);
      const fen = engine.toFen();

      console.log(`导出 FEN: ${gameId}, FEN=${fen}`);

      return {
        success: true,
        fen
      };
    } catch (error) {
      console.error(`导出 FEN 失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 从 FEN 字符串导入棋局
   */
  setFromFen(gameId: string, fen: string): {
    success: boolean;
    error?: string;
    gameState?: GameStateResponse;
  } {
    try {
      const engine = this.getEngine(gameId);
      const game = this.games.get(gameId);

      if (!game) {
        return { success: false, error: '游戏不存在' };
      }

      // 检查游戏是否已结束
      if (game.status !== 'playing') {
        return { success: false, error: '游戏已结束，无法导入棋局' };
      }

      // 从 FEN 加载棋局
      engine.setFromFen(fen);

      // 更新游戏状态
      game.board = engine.getBoard();
      game.turn = engine.getTurn();
      game.moves = engine.getMoves();
      game.status = engine.getStatus();
      game.updatedAt = Date.now();

      console.log(`导入 FEN 成功: ${gameId}`);

      return {
        success: true,
        gameState: this.getGameStateResponse(game)
      };
    } catch (error) {
      console.error(`导入 FEN 失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }
}

// 导出单例
export const gameService = new GameService();
