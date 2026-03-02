import { Board, Piece, GameStatus, Move, Position, PieceType, PieceColor, ValidationResult } from '../types/chess';

export class ChessEngine {
  private board: Board;
  private turn: 'red' | 'black';
  private status: GameStatus;
  private moves: Move[];

  constructor() {
    this.board = this.createInitialBoard();
    this.turn = 'red';
    this.status = 'playing';
    this.moves = [];
  }

  /**
   * 创建初始棋盘布局
   * 黑方在上（行 0-4），红方在下（行 5-9）
   */
  private createInitialBoard(): Board {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));

    // 黑方底线 (行 0)
    board[0][0] = { type: 'r', color: 'black' }; // 车
    board[0][1] = { type: 'n', color: 'black' }; // 马
    board[0][2] = { type: 'b', color: 'black' }; // 象
    board[0][3] = { type: 'a', color: 'black' }; // 士
    board[0][4] = { type: 'k', color: 'black' }; // 将
    board[0][5] = { type: 'a', color: 'black' }; // 士
    board[0][6] = { type: 'b', color: 'black' }; // 象
    board[0][7] = { type: 'n', color: 'black' }; // 马
    board[0][8] = { type: 'r', color: 'black' }; // 车

    // 黑方炮 (行 2)
    board[2][1] = { type: 'c', color: 'black' };
    board[2][7] = { type: 'c', color: 'black' };

    // 黑方卒 (行 3)
    board[3][0] = { type: 'p', color: 'black' };
    board[3][2] = { type: 'p', color: 'black' };
    board[3][4] = { type: 'p', color: 'black' };
    board[3][6] = { type: 'p', color: 'black' };
    board[3][8] = { type: 'p', color: 'black' };

    // 红方兵 (行 6)
    board[6][0] = { type: 'p', color: 'red' };
    board[6][2] = { type: 'p', color: 'red' };
    board[6][4] = { type: 'p', color: 'red' };
    board[6][6] = { type: 'p', color: 'red' };
    board[6][8] = { type: 'p', color: 'red' };

    // 红方炮 (行 7)
    board[7][1] = { type: 'c', color: 'red' };
    board[7][7] = { type: 'c', color: 'red' };

    // 红方底线 (行 9)
    board[9][0] = { type: 'r', color: 'red' }; // 车
    board[9][1] = { type: 'n', color: 'red' }; // 马
    board[9][2] = { type: 'b', color: 'red' }; // 象
    board[9][3] = { type: 'a', color: 'red' }; // 士
    board[9][4] = { type: 'k', color: 'red' }; // 帅
    board[9][5] = { type: 'a', color: 'red' }; // 士
    board[9][6] = { type: 'b', color: 'red' }; // 象
    board[9][7] = { type: 'n', color: 'red' }; // 马
    board[9][8] = { type: 'r', color: 'red' }; // 车

    return board;
  }

  /**
   * 获取当前棋盘
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
   * 获取走法历史
   */
  getMoves(): Move[] {
    return this.moves;
  }

  /**
   * 验证走法是否合法
   */
  validateMove(from: Position, to: Position): ValidationResult {
    // 检查位置是否在棋盘内
    if (!this.isValidPosition(from)) {
      return { valid: false, reason: '起始位置不在棋盘内' };
    }
    if (!this.isValidPosition(to)) {
      return { valid: false, reason: '目标位置不在棋盘内' };
    }

    // 获取起始位置的棋子
    const piece = this.board[from.y][from.x];
    if (!piece) {
      return { valid: false, reason: '起始位置没有棋子' };
    }

    // 检查是否是当前回合方的棋子
    if (piece.color !== this.turn) {
      return { valid: false, reason: '不是该方回合' };
    }

    // 检查目标位置是否有己方棋子
    const targetPiece = this.board[to.y][to.x];
    if (targetPiece && targetPiece.color === piece.color) {
      return { valid: false, reason: '目标位置有己方棋子' };
    }

    // 检查起始和目标位置是否相同
    if (from.x === to.x && from.y === to.y) {
      return { valid: false, reason: '起始和目标位置相同' };
    }

    // 根据棋子类型验证具体走法
    const pieceValidation = this.validatePieceMove(piece, from, to);
    if (!pieceValidation.valid) {
      return pieceValidation;
    }

    // 检查走法后是否导致己方被将军（不能送将）
    if (this.wouldBeInCheck(from, to, piece.color)) {
      return { valid: false, reason: '不能送将' };
    }

    // 检查将帅是否照面
    if (this.wouldKingsFace(from, to)) {
      return { valid: false, reason: '将帅不能照面' };
    }

    return { valid: true };
  }

  /**
   * 检查位置是否在棋盘内
   */
  private isValidPosition(pos: Position): boolean {
    return pos.x >= 0 && pos.x < 9 && pos.y >= 0 && pos.y < 10;
  }

  /**
   * 根据棋子类型验证具体走法
   */
  private validatePieceMove(piece: Piece, from: Position, to: Position): ValidationResult {
    switch (piece.type) {
      case 'p': // 兵/卒
        return this.validatePawnMove(piece, from, to);
      case 'r': // 车
        return this.validateRookMove(from, to);
      case 'n': // 马
        return this.validateKnightMove(from, to);
      case 'b': // 象
        return this.validateBishopMove(piece, from, to);
      case 'a': // 士
        return this.validateAdvisorMove(piece, from, to);
      case 'k': // 将/帅
        return this.validateKingMove(piece, from, to);
      case 'c': // 炮
        return this.validateCannonMove(from, to);
      default:
        return { valid: false, reason: '未知棋子类型' };
    }
  }

  /**
   * Task 2.2: 兵/卒走法校验
   * - 前进一格
   * - 过河后可以横走
   * - 不能后退
   */
  private validatePawnMove(piece: Piece, from: Position, to: Position): ValidationResult {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const isRed = piece.color === 'red';

    // 红兵向上（y减小），黑卒向下（y增加）
    const forward = isRed ? -1 : 1;

    // 检查是否过河
    const hasCrossedRiver = isRed ? from.y <= 4 : from.y >= 5;

    // 未过河：只能前进一格
    if (!hasCrossedRiver) {
      if (deltaX !== 0 || deltaY !== forward) {
        return { valid: false, reason: '兵/卒未过河时只能前进一格' };
      }
    } else {
      // 已过河：可以前进或横走一格
      if (deltaY === forward && deltaX === 0) {
        // 前进一格，合法
      } else if (deltaY === 0 && Math.abs(deltaX) === 1) {
        // 横走一格，合法
      } else {
        return { valid: false, reason: '兵/卒过河后只能前进或横走一格' };
      }
    }

    // 不能后退（deltaY 不能与 forward 相反）
    if (deltaY === -forward) {
      return { valid: false, reason: '兵/卒不能后退' };
    }

    return { valid: true };
  }

  /**
   * Task 2.3: 车走法校验
   * - 直线移动（横或竖）
   * - 不能越过棋子
   */
  private validateRookMove(from: Position, to: Position): ValidationResult {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;

    // 必须直线移动
    if (deltaX !== 0 && deltaY !== 0) {
      return { valid: false, reason: '车必须直线移动' };
    }

    // 检查路径上是否有棋子
    if (this.hasPieceBetween(from, to)) {
      return { valid: false, reason: '车不能越过棋子' };
    }

    return { valid: true };
  }

  /**
   * Task 2.4: 马走法校验
   * - L形移动（日字）
   * - 撇马腿检测
   */
  private validateKnightMove(from: Position, to: Position): ValidationResult {
    const deltaX = Math.abs(to.x - from.x);
    const deltaY = Math.abs(to.y - from.y);

    // 必须是日字形移动（2格 x 1格 或 1格 x 2格）
    if (!((deltaX === 2 && deltaY === 1) || (deltaX === 1 && deltaY === 2))) {
      return { valid: false, reason: '马必须走日字' };
    }

    // 检查撇马腿
    if (this.isKnightBlocked(from, to)) {
      return { valid: false, reason: '撇马腿' };
    }

    return { valid: true };
  }

  /**
   * 检查马腿是否被堵
   */
  private isKnightBlocked(from: Position, to: Position): boolean {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;

    // 马腿位置
    let legX = from.x;
    let legY = from.y;

    if (Math.abs(deltaX) === 2) {
      // 横向走日字，马腿在横向
      legX = from.x + deltaX / 2;
    } else {
      // 纵向走日字，马腿在纵向
      legY = from.y + deltaY / 2;
    }

    return this.board[legY][legX] !== null;
  }

  /**
   * Task 2.5: 象走法校验
   * - 对角线2格（田字）
   * - 塞象眼检测
   * - 不能过河
   */
  private validateBishopMove(piece: Piece, from: Position, to: Position): ValidationResult {
    const deltaX = Math.abs(to.x - from.x);
    const deltaY = Math.abs(to.y - from.y);

    // 必须是对角线2格（田字）
    if (deltaX !== 2 || deltaY !== 2) {
      return { valid: false, reason: '象必须走田字' };
    }

    // 检查塞象眼
    const eyeX = (from.x + to.x) / 2;
    const eyeY = (from.y + to.y) / 2;
    if (this.board[eyeY][eyeX] !== null) {
      return { valid: false, reason: '塞象眼' };
    }

    // 检查是否过河
    const isRed = piece.color === 'red';
    if (isRed && to.y < 5) {
      return { valid: false, reason: '红象不能过河' };
    }
    if (!isRed && to.y > 4) {
      return { valid: false, reason: '黑象不能过河' };
    }

    return { valid: true };
  }

  /**
   * Task 2.6: 士和将走法校验
   * 士：九宫内斜走1格
   * 将：九宫内走1格
   */
  private validateAdvisorMove(piece: Piece, from: Position, to: Position): ValidationResult {
    const deltaX = Math.abs(to.x - from.x);
    const deltaY = Math.abs(to.y - from.y);

    // 必须斜走1格
    if (deltaX !== 1 || deltaY !== 1) {
      return { valid: false, reason: '士必须斜走一格' };
    }

    // 检查是否在九宫内
    if (!this.isInPalace(to, piece.color)) {
      return { valid: false, reason: '士不能离开九宫' };
    }

    return { valid: true };
  }

  private validateKingMove(piece: Piece, from: Position, to: Position): ValidationResult {
    const deltaX = Math.abs(to.x - from.x);
    const deltaY = Math.abs(to.y - from.y);

    // 必须走1格（横或竖）
    if ((deltaX === 1 && deltaY === 0) || (deltaX === 0 && deltaY === 1)) {
      // 检查是否在九宫内
      if (!this.isInPalace(to, piece.color)) {
        return { valid: false, reason: '将不能离开九宫' };
      }
      return { valid: true };
    }

    return { valid: false, reason: '将必须走一格' };
  }

  /**
   * 检查位置是否在九宫内
   */
  private isInPalace(pos: Position, color: PieceColor): boolean {
    if (color === 'red') {
      // 红方九宫：x(3-5), y(7-9)
      return pos.x >= 3 && pos.x <= 5 && pos.y >= 7 && pos.y <= 9;
    } else {
      // 黑方九宫：x(3-5), y(0-2)
      return pos.x >= 3 && pos.x <= 5 && pos.y >= 0 && pos.y <= 2;
    }
  }

  /**
   * Task 2.7: 炮走法校验
   * - 移动时同车
   * - 吃子时必须隔一个棋子（炮架）
   */
  private validateCannonMove(from: Position, to: Position): ValidationResult {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;

    // 必须直线移动
    if (deltaX !== 0 && deltaY !== 0) {
      return { valid: false, reason: '炮必须直线移动' };
    }

    const targetPiece = this.board[to.y][to.x];
    const piecesBetween = this.countPiecesBetween(from, to);

    if (targetPiece === null) {
      // 移动（不吃子）：路径上不能有棋子
      if (piecesBetween > 0) {
        return { valid: false, reason: '炮移动时不能越过棋子' };
      }
    } else {
      // 吃子：必须隔一个棋子
      if (piecesBetween !== 1) {
        return { valid: false, reason: '炮吃子时必须隔一个棋子' };
      }
    }

    return { valid: true };
  }

  /**
   * 检查两点之间是否有棋子
   */
  private hasPieceBetween(from: Position, to: Position): boolean {
    return this.countPiecesBetween(from, to) > 0;
  }

  /**
   * 计算两点之间的棋子数量
   */
  private countPiecesBetween(from: Position, to: Position): number {
    let count = 0;
    const deltaX = Math.sign(to.x - from.x);
    const deltaY = Math.sign(to.y - from.y);

    let x = from.x + deltaX;
    let y = from.y + deltaY;

    while (x !== to.x || y !== to.y) {
      if (this.board[y][x] !== null) {
        count++;
      }
      x += deltaX;
      y += deltaY;
    }

    return count;
  }

  /**
   * 检查走法后是否导致将帅照面
   */
  private wouldKingsFace(from: Position, to: Position): boolean {
    // 模拟走法
    const originalTo = this.board[to.y][to.x];
    const movingPiece = this.board[from.y][from.x];

    this.board[to.y][to.x] = movingPiece;
    this.board[from.y][from.x] = null;

    // 检查将帅是否照面
    const kingsFace = this.areKingsFacing();

    // 恢复棋盘
    this.board[from.y][from.x] = movingPiece;
    this.board[to.y][to.x] = originalTo;

    return kingsFace;
  }

  /**
   * 检查将帅是否照面
   */
  private areKingsFacing(): boolean {
    // 找到红帅和黑将的位置
    let redKing: Position | null = null;
    let blackKing: Position | null = null;

    for (let y = 0; y < 10; y++) {
      for (let x = 3; x <= 5; x++) {
        const piece = this.board[y][x];
        if (piece?.type === 'k') {
          if (piece.color === 'red') {
            redKing = { x, y };
          } else {
            blackKing = { x, y };
          }
        }
      }
    }

    // 如果找不到将帅，返回 false
    if (!redKing || !blackKing) {
      return false;
    }

    // 检查是否在同一列
    if (redKing.x !== blackKing.x) {
      return false;
    }

    // 检查中间是否有棋子
    const x = redKing.x;
    for (let y = Math.min(redKing.y, blackKing.y) + 1; y < Math.max(redKing.y, blackKing.y); y++) {
      if (this.board[y][x] !== null) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查走法后是否导致己方被将军
   */
  private wouldBeInCheck(from: Position, to: Position, color: PieceColor): boolean {
    // 模拟走法
    const originalTo = this.board[to.y][to.x];
    const movingPiece = this.board[from.y][from.x];

    this.board[to.y][to.x] = movingPiece;
    this.board[from.y][from.x] = null;

    // 检查是否被将军
    const inCheck = this.isCheck(color);

    // 恢复棋盘
    this.board[from.y][from.x] = movingPiece;
    this.board[to.y][to.x] = originalTo;

    return inCheck;
  }

  /**
   * Task 2.8: 检测是否被将军
   */
  isCheck(color: PieceColor): boolean {
    // 找到己方将的位置
    let kingPos: Position | null = null;

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        const piece = this.board[y][x];
        if (piece?.type === 'k' && piece.color === color) {
          kingPos = { x, y };
          break;
        }
      }
      if (kingPos) break;
    }

    if (!kingPos) {
      return false; // 找不到将，理论上不应该发生
    }

    // 检查对方所有棋子是否能吃到己方将
    const enemyColor = color === 'red' ? 'black' : 'red';

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        const piece = this.board[y][x];
        if (piece && piece.color === enemyColor) {
          const from = { x, y };
          // 临时跳过将帅照面检查，防止递归
          if (this.canPieceAttack(piece, from, kingPos)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 检查棋子是否能攻击目标位置（不考虑将军和将帅照面）
   */
  private canPieceAttack(piece: Piece, from: Position, to: Position): boolean {
    switch (piece.type) {
      case 'p':
        return this.validatePawnMove(piece, from, to).valid;
      case 'r':
        return this.validateRookMove(from, to).valid;
      case 'n':
        return this.validateKnightMove(from, to).valid;
      case 'b':
        return this.validateBishopMove(piece, from, to).valid;
      case 'a':
        return this.validateAdvisorMove(piece, from, to).valid;
      case 'k':
        // 将攻击范围：九宫内1格 + 将帅照面
        if (this.validateKingMove(piece, from, to).valid) {
          return true;
        }
        // 检查将帅照面
        if (from.x === to.x && this.areKingsFacingOnColumn(from.x, from.y, to.y)) {
          return true;
        }
        return false;
      case 'c':
        // 炮吃子时需要隔一个棋子
        const deltaX = Math.abs(to.x - from.x);
        const deltaY = Math.abs(to.y - from.y);
        if (deltaX !== 0 && deltaY !== 0) {
          return false;
        }
        const piecesBetween = this.countPiecesBetween(from, to);
        return piecesBetween === 1;
      default:
        return false;
    }
  }

  /**
   * 检查将帅是否在某一列照面
   */
  private areKingsFacingOnColumn(x: number, y1: number, y2: number): boolean {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    for (let y = minY + 1; y < maxY; y++) {
      if (this.board[y][x] !== null) {
        return false;
      }
    }
    return true;
  }

  /**
   * Task 2.8: 检测是否将死
   */
  isCheckmate(color: PieceColor): boolean {
    // 如果没有被将军，就不是将死
    if (!this.isCheck(color)) {
      return false;
    }

    // 检查是否所有走法都无法解除将军
    return !this.hasAnyLegalMove(color);
  }

  /**
   * Task 2.8: 检测是否困毙
   */
  isStalemate(color: PieceColor): boolean {
    // 如果被将军，就不是困毙
    if (this.isCheck(color)) {
      return false;
    }

    // 检查是否所有走法都无法走
    return !this.hasAnyLegalMove(color);
  }

  /**
   * 检查是否有任何合法走法
   */
  private hasAnyLegalMove(color: PieceColor): boolean {
    for (let fromY = 0; fromY < 10; fromY++) {
      for (let fromX = 0; fromX < 9; fromX++) {
        const piece = this.board[fromY][fromX];
        if (piece && piece.color === color) {
          const from = { x: fromX, y: fromY };

          // 尝试所有可能的目标位置
          for (let toY = 0; toY < 10; toY++) {
            for (let toX = 0; toX < 9; toX++) {
              const to = { x: toX, y: toY };
              const result = this.validateMove(from, to);
              if (result.valid) {
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
   * 执行走法
   */
  makeMove(from: Position, to: Position): void {
    // 验证走法
    const validation = this.validateMove(from, to);
    if (!validation.valid) {
      throw new Error(validation.reason || '非法走法');
    }

    const piece = this.board[from.y][from.x];
    const targetPiece = this.board[to.y][to.x];

    // piece 不可能为 null，因为 validateMove 已经验证过
    if (!piece) {
      throw new Error('起始位置没有棋子');
    }

    // 记录走法
    const move: Move = {
      from,
      to,
      piece: piece.type,
      captured: targetPiece?.type,
      timestamp: Date.now()
    };

    // 执行走法
    this.board[to.y][to.x] = piece;
    this.board[from.y][from.x] = null;

    // 添加到历史
    this.moves.push(move);

    // 切换回合
    this.turn = this.turn === 'red' ? 'black' : 'red';

    // 检查游戏状态
    this.checkGameStatus();
  }

  /**
   * 检查游戏状态
   */
  private checkGameStatus(): void {
    const opponentColor = this.turn;

    if (this.isCheckmate(opponentColor)) {
      // 对方被将死，当前方获胜
      this.status = this.turn === 'red' ? 'black_win' : 'red_win';
    } else if (this.isStalemate(opponentColor)) {
      // 对方困毙，当前方获胜
      this.status = this.turn === 'red' ? 'black_win' : 'red_win';
    } else if (this.moves.length >= 200) {
      // 超过200回合，判和
      this.status = 'draw';
    }
  }
}
