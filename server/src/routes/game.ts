import { Router, Request, Response } from 'express';
import { gameService, GameConfig } from '../services/game-service';
import { Position } from '../types/chess';

/**
 * 创建游戏请求接口
 */
interface CreateGameRequest {
  redPlayer: {
    type: 'user' | 'ai';
  };
  blackPlayer: {
    type: 'user' | 'ai';
  };
  options?: {
    timerMode?: 'per_move' | 'total_time';
    moveTimeLimit?: number;
    redTimeLimit?: number;
    blackTimeLimit?: number;
    firstPlayer?: 'red' | 'black' | 'random';
    allowUndo?: boolean;
    autoForfeit?: boolean;
    aiThinkDelay?: number;
    drawOnNoCapture?: number;
  };
}

/**
 * 强制结束请求接口
 */
interface EndGameRequest {
  winner: 'red' | 'black' | 'draw';
  reason: 'checkmate' | 'stalemate' | 'resignation' | 'timeout' | 'illegal_move' | 'draw_agreement' | 'repetition' | 'no_capture_draw' | 'max_moves_draw';
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

    const config: GameConfig = {
      redPlayer: body.redPlayer,
      blackPlayer: body.blackPlayer,
      options: body.options
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
        error: result.error,
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
 * POST /api/game/:gameId/ai-step
 * 由当前执子方 AI 走一步（用于双 AI 观战或开局先手为 AI）
 */
router.post('/:gameId/ai-step', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const result = await gameService.stepAiMove(gameId);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'AI_STEP_FAILED'
      });
    }

    res.json({
      success: true,
      data: {
        move: result.move,
        aiThinking: result.aiThinking,
        gameState: result.gameState
      }
    });
  } catch (error) {
    console.error('AI 步进失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'AI 步进失败',
      code: 'AI_STEP_EXECUTION_FAILED'
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
 * GET /api/game/:gameId/valid-moves
 * 获取指定位置棋子的所有合法走法
 */
router.get('/:gameId/valid-moves', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { x, y } = req.query;

    // 确保gameId是字符串类型
    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    // 验证坐标参数
    const posX = parseInt(x as string, 10);
    const posY = parseInt(y as string, 10);

    if (isNaN(posX) || isNaN(posY)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '坐标参数无效，需要数字类型的 x 和 y',
        code: 'INVALID_COORDINATES'
      });
    }

    const result = gameService.getValidMoves(gameId, { x: posX, y: posY });

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'VALID_MOVES_FAILED'
      });
    }

    res.json({
      success: true,
      data: {
        piece: result.piece,
        validMoves: result.validMoves
      }
    });
  } catch (error) {
    console.error('获取有效走法失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '获取有效走法失败',
      code: 'VALID_MOVES_EXECUTION_FAILED'
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
 * 获取所有游戏列表（包含简要信息）
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const games = gameService.getAllGamesSummary();

    res.json({
      success: true,
      data: games
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

/**
 * POST /api/game/:gameId/pause
 * 暂停游戏
 */
router.post('/:gameId/pause', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const result = gameService.pauseGame(gameId);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'PAUSE_FAILED'
      });
    }

    res.json({
      success: true,
      data: result.gameState
    });
  } catch (error) {
    console.error('暂停游戏失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '暂停游戏失败',
      code: 'PAUSE_EXECUTION_FAILED'
    });
  }
});

/**
 * POST /api/game/:gameId/resume
 * 继续游戏
 */
router.post('/:gameId/resume', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const result = gameService.resumeGame(gameId);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'RESUME_FAILED'
      });
    }

    res.json({
      success: true,
      data: result.gameState
    });
  } catch (error) {
    console.error('继续游戏失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '继续游戏失败',
      code: 'RESUME_EXECUTION_FAILED'
    });
  }
});

/**
 * POST /api/game/:gameId/end
 * 强制结束游戏
 */
router.post('/:gameId/end', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const body = req.body as EndGameRequest;

    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    if (!body.winner || !body.reason) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '缺少必要参数: winner, reason',
        code: 'MISSING_PARAMETERS'
      });
    }

    const result = gameService.endGame(gameId, body.winner, body.reason);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'END_GAME_FAILED'
      });
    }

    res.json({
      success: true,
      data: result.gameState
    });
  } catch (error) {
    console.error('结束游戏失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '结束游戏失败',
      code: 'END_GAME_EXECUTION_FAILED'
    });
  }
});

/**
 * GET /api/game/:gameId/notation
 * 获取棋谱
 */
router.get('/:gameId/notation', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const result = gameService.getNotation(gameId);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'NOTATION_FAILED'
      });
    }

    res.json({
      success: true,
      data: {
        notation: result.notation
      }
    });
  } catch (error) {
    console.error('获取棋谱失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '获取棋谱失败',
      code: 'NOTATION_EXECUTION_FAILED'
    });
  }
});

/**
 * GET /api/game/:gameId/debug
 * 获取调试信息
 */
router.get('/:gameId/debug', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const result = gameService.getDebugInfo(gameId);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'DEBUG_INFO_FAILED'
      });
    }

    res.json({
      success: true,
      data: result.debug
    });
  } catch (error) {
    console.error('获取调试信息失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '获取调试信息失败',
      code: 'DEBUG_INFO_EXECUTION_FAILED'
    });
  }
});

/**
 * GET /api/game/:gameId/fen
 * 导出 FEN 棋局
 */
router.get('/:gameId/fen', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    const result = gameService.getFen(gameId);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'FEN_EXPORT_FAILED'
      });
    }

    res.json({
      success: true,
      data: {
        fen: result.fen
      }
    });
  } catch (error) {
    console.error('导出 FEN 失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '导出 FEN 失败',
      code: 'FEN_EXPORT_EXECUTION_FAILED'
    });
  }
});

/**
 * POST /api/game/:gameId/fen
 * 导入 FEN 棋局
 */
router.post('/:gameId/fen', (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { fen } = req.body;

    if (Array.isArray(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '无效的游戏ID',
        code: 'INVALID_GAME_ID'
      });
    }

    if (!fen || typeof fen !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: '缺少 FEN 字符串',
        code: 'MISSING_FEN'
      });
    }

    const result = gameService.setFromFen(gameId, fen);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
        code: 'FEN_IMPORT_FAILED'
      });
    }

    res.json({
      success: true,
      data: {
        gameState: result.gameState
      }
    });
  } catch (error) {
    console.error('导入 FEN 失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : '导入 FEN 失败',
      code: 'FEN_IMPORT_EXECUTION_FAILED'
    });
  }
});

export { router as gameRouter };
