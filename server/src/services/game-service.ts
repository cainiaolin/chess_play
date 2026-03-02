import { v4 as uuidv4 } from 'uuid';
import { ChessEngine } from './chess-engine';
import { AIAdapter } from './ai-adapter';
import {
  Board,
  Move,
  Position,
  GameStatus,
  Player,
  GameSession,
  MoveRequest,
  AIRequest,
  AIResponse
} from '../types/chess';

/**
 * 游戏配置接口
 */
export interface GameConfig {
  redPlayer: {
    type: 'user' | 'ai';
    model?: string;
  };
  blackPlayer: {
    type: 'user' | 'ai';
    model?: string;
  };
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
  createdAt: number;
  updatedAt: number;
}

/**
 * 游戏服务类
 * 管理所有游戏会话
 */
export class GameService {
  private games: Map<string, GameSession>;
  private aiAdapter: AIAdapter;
  private io: any;

  constructor(io?: any) {
    this.games = new Map();
    this.io = io;
    // 创建一个临时引擎用于初始化AI适配器
    const tempEngine = new ChessEngine();
    this.aiAdapter = new AIAdapter(tempEngine, 30000, 3);
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
  createGame(config: GameConfig): GameSession {
    const engine = new ChessEngine();
    const gameId = uuidv4();
    const now = Date.now();

    const game: GameSession = {
      id: gameId,
      board: engine.getBoard(),
      turn: engine.getTurn(),
      moves: engine.getMoves(),
      status: engine.getStatus(),
      players: {
        red: config.redPlayer,
        black: config.blackPlayer
      },
      createdAt: now,
      updatedAt: now
    };

    // 保存引擎实例（通过闭包或WeakRef）
    (game as any)._engine = engine;

    this.games.set(gameId, game);

    console.log(`游戏已创建: ${gameId}, 红方: ${config.redPlayer.type}, 黑方: ${config.blackPlayer.type}`);

    return game;
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
      if (game.status === 'playing') {
        const currentPlayer = game.turn === 'red' ? game.players.red : game.players.black;
        if (currentPlayer.type === 'ai' && currentPlayer.model) {
          console.log(`AI走棋中: ${gameId}, 模型: ${currentPlayer.model}`);
          aiMove = await this.getAIMove(gameId, currentPlayer.model);
        }
      }

      return {
        success: true,
        move: lastMove,
        aiMove,
        gameState: this.getGameStateResponse(game)
      };
    } catch (error) {
      console.error(`走法执行失败: ${gameId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取AI走法
   */
  private async getAIMove(gameId: string, model: string): Promise<AIResponse> {
    const engine = this.getEngine(gameId);
    const game = this.games.get(gameId);

    if (!game) {
      throw new Error('游戏不存在');
    }

    const aiRequest: AIRequest = {
      board: engine.getBoard(),
      role: engine.getTurn(),
      history: engine.getMoves()
    };

    try {
      const aiResponse = await this.aiAdapter.getMove(model, aiRequest);

      // 执行AI走法
      engine.makeMove(aiResponse.from, aiResponse.to);

      // 更新游戏状态
      game.board = engine.getBoard();
      game.turn = engine.getTurn();
      game.moves = engine.getMoves();
      game.status = engine.getStatus();
      game.updatedAt = Date.now();

      console.log(`AI走法已执行: ${gameId}, 从 (${aiResponse.from.x},${aiResponse.from.y}) 到 (${aiResponse.to.x},${aiResponse.to.y})`);

      return aiResponse;
    } catch (error) {
      console.error(`AI走法失败: ${gameId}`, error);
      throw error;
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
    return {
      id: game.id,
      board: game.board,
      turn: game.turn,
      status: game.status,
      moves: game.moves,
      players: game.players,
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

      // 获取当前玩家的AI模型配置
      const currentPlayer = game.turn === 'red' ? game.players.red : game.players.black;

      if (currentPlayer.type !== 'ai' || !currentPlayer.model) {
        // 如果当前玩家不是AI，使用默认模型
        const availableModels = this.aiAdapter.getAvailableModels();
        if (availableModels.length === 0) {
          return { success: false, error: '没有可用的AI模型' };
        }
        currentPlayer.model = availableModels[0].id;
      }

      const aiRequest: AIRequest = {
        board: engine.getBoard(),
        role: engine.getTurn(),
        history: engine.getMoves()
      };

      const hint = await this.aiAdapter.getMove(currentPlayer.model, aiRequest);

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
   * 获取游戏数量
   */
  getGameCount(): number {
    return this.games.size;
  }
}

// 导出单例
export const gameService = new GameService();
