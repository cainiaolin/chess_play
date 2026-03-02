import { Router, Request, Response } from 'express';
import { gameService, GameConfig } from '../services/game-service';
import { Position } from '../types/chess';

/**
 * 创建游戏请求接口
 */
interface CreateGameRequest {
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
 * 走法请求接口
 */
interface MoveRequestBody {
  from: Position;
  to: Position;
  player: 'red' | 'black';
}

const router = Router();

/**
 * POST /api/game/create
 * 创建新游戏
 */
router.post('/create', (req: Request, res: Response) => {
  try {
    const body = req.body as CreateGameRequest;

    // 验证请求体
    if (!body.redPlayer || !body.blackPlayer) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '缺少玩家配置',
        code: 'MISSING_PLAYER_CONFIG'
      });
    }

    if (!body.redPlayer.type || !body.blackPlayer.type) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '缺少玩家类型',
        code: 'MISSING_PLAYER_TYPE'
      });
    }

    if (body.redPlayer.type === 'ai' && !body.redPlayer.model) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'AI玩家需要指定模型',
        code: 'MISSING_AI_MODEL'
      });
    }

    if (body.blackPlayer.type === 'ai' && !body.blackPlayer.model) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'AI玩家需要指定模型',
        code: 'MISSING_AI_MODEL'
      });
    }

    const config: GameConfig = {
      redPlayer: body.redPlayer,
      blackPlayer: body.blackPlayer
    };

    const game = gameService.createGame(config);

    res.status(201).json({
      success: true,
      data: game
    });
  } catch (error) {
    console.error('创建游戏失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '创建游戏失败',
      code: 'CREATE_GAME_FAILED'
    });
  }
});

/**
 * POST /api/game/:gameId/move
 * 执行走法
 */
router.post('/:gameId/move', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // 确保gameId是字符串类型
    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const body = req.body as MoveRequestBody;

    // 验证请求体
    if (!body.from || !body.to || !body.player) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '缺少必要参数: from, to, player',
        code: 'MISSING_PARAMETERS'
      });
    }

    // 验证坐标格式
    if (
      typeof body.from.x !== 'number' ||
      typeof body.from.y !== 'number' ||
      typeof body.to.x !== 'number' ||
      typeof body.to.y !== 'number'
    ) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '坐标格式错误',
        code: 'INVALID_COORDINATES'
      });
    }

    if (body.player !== 'red' && body.player !== 'black') {
      return res.status(400).json({
        error: 'Bad Request',
        message: '玩家类型错误',
        code: 'INVALID_PLAYER'
      });
    }

    const result = await gameService.makeMove(gameId, {
      gameId,
      from: body.from,
      to: body.to,
      player: body.player
    });

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'MOVE_FAILED'
      });
    }

    res.json({
      success: true,
      data: {
        move: result.move,
        aiMove: result.aiMove,
        gameState: result.gameState
      }
    });
  } catch (error) {
    console.error('执行走法失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '执行走法失败',
      code: 'MOVE_EXECUTION_FAILED'
    });
  }
});

/**
 * GET /api/game/:gameId
 * 获取游戏状态
 */
router.get('/:gameId', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // 确保gameId是字符串类型
    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const gameState = gameService.getGameState(gameId);

    if (!gameState) {
      return res.status(404).json({
        error: 'Not Found',
        message: `游戏不存在: ${gameId}`,
        code: 'GAME_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: gameState
    });
  } catch (error) {
    console.error('获取游戏状态失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '获取游戏状态失败',
      code: 'GET_STATE_FAILED'
    });
  }
});

/**
 * POST /api/game/:gameId/undo
 * 悔棋
 */
router.post('/:gameId/undo', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // 确保gameId是字符串类型
    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const result = gameService.undo(gameId);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'UNDO_FAILED'
      });
    }

    res.json({
      success: true,
      data: result.gameState
    });
  } catch (error) {
    console.error('悔棋失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '悔棋失败',
      code: 'UNDO_EXECUTION_FAILED'
    });
  }
});

/**
 * GET /api/game/:gameId/hint
 * 获取提示
 */
router.get('/:gameId/hint', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // 确保gameId是字符串类型
    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const result = await gameService.getHint(gameId);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'HINT_FAILED'
      });
    }

    res.json({
      success: true,
      data: {
        hint: result.hint
      }
    });
  } catch (error) {
    console.error('获取提示失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '获取提示失败',
      code: 'HINT_EXECUTION_FAILED'
    });
  }
});

/**
 * DELETE /api/game/:gameId
 * 删除游戏
 */
router.delete('/:gameId', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // 确保gameId是字符串类型
    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const deleted = gameService.deleteGame(gameId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: `游戏不存在: ${gameId}`,
        code: 'GAME_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: '游戏已删除'
    });
  } catch (error) {
    console.error('删除游戏失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '删除游戏失败',
      code: 'DELETE_GAME_FAILED'
    });
  }
});

/**
 * GET /api/game
 * 获取所有游戏ID列表
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const gameIds = gameService.getAllGameIds();

    res.json({
      success: true,
      data: {
        count: gameIds.length,
        games: gameIds
      }
    });
  } catch (error) {
    console.error('获取游戏列表失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '获取游戏列表失败',
      code: 'GET_GAMES_FAILED'
    });
  }
});

export { router as gameRouter };
