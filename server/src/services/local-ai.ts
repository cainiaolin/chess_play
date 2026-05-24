import { Board, Piece, Position, Move, AIRequest, AIResponse, PieceType, PieceColor } from '../types/chess';
import { ChessEngine } from './chess-engine';

/**
 * 棋子基础价值
 */
const PIECE_VALUES: Record<PieceType, number> = {
  'k': 10000, // 将/帅 - 无价
  'r': 900,   // 车
  'c': 450,   // 炮
  'n': 400,   // 马
  'b': 200,   // 象
  'a': 200,   // 士
  'p': 100    // 兵/卒
};

/**
 * 红方位置价值表
 * 考虑中心控制、过河兵加分等
 */
const RED_POSITION_VALUES: Record<PieceType, number[][]> = {
  'k': [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 2, 2, 2, 0, 0, 0]
  ],
  'a': [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 2, 3, 2, 0, 0, 0]
  ],
  'b': [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 1, 0]
  ],
  'n': [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 2, 2, 1, 0, 0],
    [0, 1, 2, 3, 3, 3, 2, 1, 0],
    [0, 1, 2, 3, 4, 3, 2, 1, 0],
    [0, 0, 2, 3, 3, 3, 2, 0, 0],
    [0, 0, 1, 2, 2, 2, 1, 0, 0]
  ],
  'r': [
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 2, 3, 2, 0, 0, 0]
  ],
  'c': [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 2, 2, 2, 1, 0, 0],
    [0, 0, 1, 2, 3, 2, 1, 0, 0],
    [0, 0, 1, 2, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0]
  ],
  'p': [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 3, 4, 3, 0, 0, 0], // 过河后加分
    [0, 0, 0, 2, 3, 2, 0, 0, 0],
    [0, 0, 0, 1, 2, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ]
};

/**
 * 黑方位置价值表（相对于红方翻转）
 */
const BLACK_POSITION_VALUES: Record<PieceType, number[][]> = {
  'k': [
    [0, 0, 0, 2, 2, 2, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ],
  'a': [
    [0, 0, 0, 2, 3, 2, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ],
  'b': [
    [0, 1, 0, 0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ],
  'n': [
    [0, 0, 1, 2, 2, 2, 1, 0, 0],
    [0, 0, 2, 3, 3, 3, 2, 0, 0],
    [0, 1, 2, 3, 4, 3, 2, 1, 0],
    [0, 1, 2, 3, 3, 3, 2, 1, 0],
    [0, 0, 1, 2, 2, 2, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ],
  'r': [
    [0, 0, 0, 2, 3, 2, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0]
  ],
  'c': [
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 2, 2, 2, 1, 0, 0],
    [0, 0, 1, 2, 3, 2, 1, 0, 0],
    [0, 0, 1, 2, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ],
  'p': [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 2, 1, 0, 0, 0],
    [0, 0, 0, 2, 3, 2, 0, 0, 0],
    [0, 0, 0, 3, 4, 3, 0, 0, 0], // 过河后加分
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ]
};

/**
 * 走法评估接口
 */
interface MoveScore {
  from: Position;
  to: Position;
  score: number;
  captured?: PieceType;
}

/**
 * 本地 AI 提供商
 * 使用 Minimax 搜索 + Alpha-Beta 剪枝
 */
export class LocalAIProvider {
  id = 'local';
  name = '本地 AI (Minimax)';
  private depth: number;

  constructor(depth: number = 3) {
    this.depth = depth;
  }

  /**
   * 获取 AI 走法
   */
  async getMove(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    // 创建临时引擎用于模拟
    const tempEngine = new ChessEngine();

    // 从 FEN 恢复局面
    const fen = this.boardToFen(request.board, request.role);
    tempEngine.setFromFen(fen);

    // 获取最佳走法
    const bestMove = this.findBestMove(tempEngine, request.role, this.depth);

    const elapsed = Date.now() - startTime;
    const thinking = this.generateThinking(bestMove, elapsed);

    return {
      from: bestMove.from,
      to: bestMove.to,
      thinking
    };
  }

  /**
   * 查找最佳走法（Minimax + Alpha-Beta）
   */
  private findBestMove(engine: ChessEngine, color: PieceColor, depth: number): MoveScore {
    const legalMoves = this.getAllLegalMoves(engine, color);

    if (legalMoves.length === 0) {
      throw new Error('没有可用的合法走法');
    }

    let bestMove: MoveScore | null = null;
    let bestScore = -Infinity;
    const isMaximizing = color === 'red';

    // 对每个合法走法进行评估
    for (const move of legalMoves) {
      // 创建临时引擎模拟走法
      const tempEngine = this.cloneEngine(engine);
      tempEngine.makeMove(move.from, move.to);

      // 使用 Minimax 评估
      const score = this.minimax(
        tempEngine,
        depth - 1,
        -Infinity,
        Infinity,
        !isMaximizing,
        color === 'red' ? 'black' : 'red'
      );

      if (isMaximizing ? score > bestScore : score < bestScore) {
        bestScore = score;
        bestMove = { ...move, score };
      }
    }

    return bestMove || legalMoves[0];
  }

  /**
   * Minimax 搜索 + Alpha-Beta 剪枝
   */
  private minimax(
    engine: ChessEngine,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    currentColor: PieceColor
  ): number {
    // 终止条件：达到最大深度或游戏结束
    if (depth === 0 || engine.getStatus() !== 'playing') {
      return this.evaluateBoard(engine.getBoard(), currentColor === 'red' ? 'black' : 'red');
    }

    const legalMoves = this.getAllLegalMoves(engine, currentColor);

    if (legalMoves.length === 0) {
      // 没有合法走法，可能是将死或困毙
      if (engine.isCheck(currentColor)) {
        // 被将死
        return isMaximizing ? -100000 : 100000;
      }
      // 困毙
      return 0;
    }

    const nextColor = currentColor === 'red' ? 'black' : 'red';

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of legalMoves) {
        const tempEngine = this.cloneEngine(engine);
        tempEngine.makeMove(move.from, move.to);
        const evalScore = this.minimax(tempEngine, depth - 1, alpha, beta, false, nextColor);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) {
          break; // Beta 剪枝
        }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of legalMoves) {
        const tempEngine = this.cloneEngine(engine);
        tempEngine.makeMove(move.from, move.to);
        const evalScore = this.minimax(tempEngine, depth - 1, alpha, beta, true, nextColor);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) {
          break; // Alpha 剪枝
        }
      }
      return minEval;
    }
  }

  /**
   * 评估棋盘局面
   * 正数对红方有利，负数对黑方有利
   */
  private evaluateBoard(board: Board, color: PieceColor): number {
    let score = 0;

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        const piece = board[y][x];
        if (piece) {
          // 棋子基础价值
          let pieceValue = PIECE_VALUES[piece.type];

          // 位置价值
          const positionValue = piece.color === 'red'
            ? RED_POSITION_VALUES[piece.type][y][x]
            : BLACK_POSITION_VALUES[piece.type][y][x];

          const totalValue = pieceValue + positionValue * 10;

          if (piece.color === 'red') {
            score += totalValue;
          } else {
            score -= totalValue;
          }
        }
      }
    }

    // 返回相对于当前颜色的分数
    return color === 'red' ? score : -score;
  }

  /**
   * 获取所有合法走法
   */
  private getAllLegalMoves(engine: ChessEngine, color: PieceColor): MoveScore[] {
    const moves: MoveScore[] = [];
    const board = engine.getBoard();

    for (let fromY = 0; fromY < 10; fromY++) {
      for (let fromX = 0; fromX < 9; fromX++) {
        const piece = board[fromY][fromX];
        if (piece && piece.color === color) {
          const from = { x: fromX, y: fromY };

          for (let toY = 0; toY < 10; toY++) {
            for (let toX = 0; toX < 9; toX++) {
              const to = { x: toX, y: toY };
              const validation = engine.validateMove(from, to);
              if (validation.valid) {
                const targetPiece = board[toY][toX];
                moves.push({
                  from,
                  to,
                  score: 0,
                  captured: targetPiece?.type
                });
              }
            }
          }
        }
      }
    }

    // 排序优化：优先考虑吃子走法
    moves.sort((a, b) => {
      const aValue = a.captured ? PIECE_VALUES[a.captured] : 0;
      const bValue = b.captured ? PIECE_VALUES[b.captured] : 0;
      return bValue - aValue;
    });

    return moves;
  }

  /**
   * 克隆引擎状态
   */
  private cloneEngine(engine: ChessEngine): ChessEngine {
    const newEngine = new ChessEngine();
    newEngine.setFromFen(engine.toFen());
    return newEngine;
  }

  /**
   * 将棋盘转换为 FEN（简化版）
   */
  private boardToFen(board: Board, turn: PieceColor): string {
    const fenRows: string[] = [];

    for (let y = 0; y < 10; y++) {
      let row = '';
      let emptyCount = 0;

      for (let x = 0; x < 9; x++) {
        const piece = board[y][x];
        if (piece === null) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            row += emptyCount.toString();
            emptyCount = 0;
          }
          const fenChar = piece.color === 'red'
            ? piece.type.toUpperCase()
            : piece.type.toLowerCase();
          row += fenChar;
        }
      }

      if (emptyCount > 0) {
        row += emptyCount.toString();
      }

      fenRows.push(row);
    }

    const turnFen = turn === 'red' ? 'w' : 'b';
    return `${fenRows.join('/')} ${turnFen} - - 0 1`;
  }

  /**
   * 生成 AI 思考过程描述
   */
  private generateThinking(move: MoveScore, elapsed: number): string {
    const pieceNames: Record<PieceType, string> = {
      'k': '将',
      'a': '士',
      'b': '象',
      'n': '马',
      'r': '车',
      'c': '炮',
      'p': '兵'
    };

    const capturedStr = move.captured
      ? `，吃掉对方${pieceNames[move.captured]}`
      : '';

    return `本地AI分析：从(${move.from.x},${move.from.y})走到(${move.to.x},${move.to.y})${capturedStr}。` +
      `评估分数：${move.score.toFixed(0)}，思考耗时：${elapsed}ms`;
  }
}
