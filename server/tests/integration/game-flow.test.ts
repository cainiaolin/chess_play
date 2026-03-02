import { describe, it, expect, beforeEach } from '@jest/globals';
import { GameService } from '../../src/services/game-service';

describe('Game Flow Integration', () => {
  let gameService: GameService;

  beforeEach(() => {
    gameService = new GameService();
  });

  it('should complete a full game flow', async () => {
    // 创建游戏 - 两个用户玩家避免AI调用
    const session = gameService.createGame({
      redPlayer: { type: 'user' },
      blackPlayer: { type: 'user' }
    });

    expect(session.status).toBe('playing');
    expect(session.turn).toBe('red');

    // 执行走法 - 按照实际接口结构
    const moveRequest = {
      gameId: session.id,
      from: { x: 4, y: 6 },
      to: { x: 4, y: 5 },
      player: 'red' as const
    };

    const result = await gameService.makeMove(session.id, moveRequest);

    // 检查响应结构
    expect(result.success).toBe(true);
    expect(result.gameState).toBeDefined();
    expect(result.gameState?.turn).toBe('black');
    expect(result.gameState?.moves.length).toBeGreaterThan(0);
  });

  it('should handle undo correctly', () => {
    const session = gameService.createGame({
      redPlayer: { type: 'user' },
      blackPlayer: { type: 'user' }
    });

    // 先执行一步
    const moveRequest = {
      gameId: session.id,
      from: { x: 4, y: 6 },
      to: { x: 4, y: 5 },
      player: 'red' as const
    };

    gameService.makeMove(session.id, moveRequest);

    // 获取悔棋前的状态
    const beforeUndo = gameService.getGameState(session.id);
    expect(beforeUndo).not.toBeNull();
    const movesCount = beforeUndo?.moves.length || 0;

    // 执行悔棋
    const undoResult = gameService.undo(session.id);

    expect(undoResult.success).toBe(true);
    expect(undoResult.gameState).not.toBeNull();
    expect(undoResult.gameState?.moves.length).toBe(movesCount - 1);
  });

  it('should handle game not found errors', async () => {
    const moveRequest = {
      gameId: 'non-existent-id',
      from: { x: 4, y: 6 },
      to: { x: 4, y: 5 },
      player: 'red' as const
    };

    const result = await gameService.makeMove('non-existent-id', moveRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain('游戏不存在');
  });

  it('should validate turn order', async () => {
    const session = gameService.createGame({
      redPlayer: { type: 'user' },
      blackPlayer: { type: 'user' }
    });

    // 尝试用黑方走第一步（应该失败，因为是红方先）
    const moveRequest = {
      gameId: session.id,
      from: { x: 4, y: 3 },
      to: { x: 4, y: 4 },
      player: 'black' as const
    };

    const result = await gameService.makeMove(session.id, moveRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain('不是该玩家的回合');
  });

  it('should get game state correctly', () => {
    const session = gameService.createGame({
      redPlayer: { type: 'user' },
      blackPlayer: { type: 'user' }
    });

    const gameState = gameService.getGameState(session.id);

    expect(gameState).not.toBeNull();
    expect(gameState?.id).toBe(session.id);
    expect(gameState?.turn).toBe('red');
    expect(gameState?.status).toBe('playing');
  });

  it('should return null for non-existent game state', () => {
    const gameState = gameService.getGameState('non-existent-id');
    expect(gameState).toBeNull();
  });
});
