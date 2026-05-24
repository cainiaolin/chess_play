// 前端棋局引擎 — 从 server/src/services/chess-engine.ts 精简而来
// 仅保留走法验证核心逻辑，移除 FEN / 状态追踪等功能

type PieceType = 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p';
type PieceColor = 'red' | 'black';

interface Position { x: number; y: number; }
interface Piece { type: PieceType; color: PieceColor; }
type Board = (Piece | null)[][];
interface ValidationResult { valid: boolean; reason?: string; }

export class ChessEngine {
  private board: Board;
  private turn: 'red' | 'black';

  constructor() {
    this.board = this.createInitialBoard();
    this.turn = 'red';
  }

  private createInitialBoard(): Board {
    const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));

    board[0][0] = { type: 'r', color: 'black' };
    board[0][1] = { type: 'n', color: 'black' };
    board[0][2] = { type: 'b', color: 'black' };
    board[0][3] = { type: 'a', color: 'black' };
    board[0][4] = { type: 'k', color: 'black' };
    board[0][5] = { type: 'a', color: 'black' };
    board[0][6] = { type: 'b', color: 'black' };
    board[0][7] = { type: 'n', color: 'black' };
    board[0][8] = { type: 'r', color: 'black' };

    board[2][1] = { type: 'c', color: 'black' };
    board[2][7] = { type: 'c', color: 'black' };

    board[3][0] = { type: 'p', color: 'black' };
    board[3][2] = { type: 'p', color: 'black' };
    board[3][4] = { type: 'p', color: 'black' };
    board[3][6] = { type: 'p', color: 'black' };
    board[3][8] = { type: 'p', color: 'black' };

    board[6][0] = { type: 'p', color: 'red' };
    board[6][2] = { type: 'p', color: 'red' };
    board[6][4] = { type: 'p', color: 'red' };
    board[6][6] = { type: 'p', color: 'red' };
    board[6][8] = { type: 'p', color: 'red' };

    board[7][1] = { type: 'c', color: 'red' };
    board[7][7] = { type: 'c', color: 'red' };

    board[9][0] = { type: 'r', color: 'red' };
    board[9][1] = { type: 'n', color: 'red' };
    board[9][2] = { type: 'b', color: 'red' };
    board[9][3] = { type: 'a', color: 'red' };
    board[9][4] = { type: 'k', color: 'red' };
    board[9][5] = { type: 'a', color: 'red' };
    board[9][6] = { type: 'b', color: 'red' };
    board[9][7] = { type: 'n', color: 'red' };
    board[9][8] = { type: 'r', color: 'red' };

    return board;
  }

  getBoard(): Board { return this.board; }
  getTurn(): 'red' | 'black' { return this.turn; }

  loadBoard(board: Board, turn: 'red' | 'black'): void {
    this.board = board.map(row => row.map(cell => cell ? { ...cell } : null));
    this.turn = turn;
  }

  /** 获取指定位置棋子的所有合法目标位置 */
  getValidMovesForPosition(pos: Position): Position[] {
    const piece = this.board[pos.y]?.[pos.x];
    if (!piece || piece.color !== this.turn) return [];

    const results: Position[] = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        if (x === pos.x && y === pos.y) continue;
        const to: Position = { x, y };
        if (this.validateMove(pos, to).valid) {
          results.push(to);
        }
      }
    }
    return results;
  }

  validateMove(from: Position, to: Position): ValidationResult {
    if (!this.isValidPosition(from) || !this.isValidPosition(to)) {
      return { valid: false, reason: '位置不在棋盘内' };
    }

    const piece = this.board[from.y][from.x];
    if (!piece) return { valid: false, reason: '起始位置没有棋子' };
    if (piece.color !== this.turn) return { valid: false, reason: '不是该方回合' };
    if (from.x === to.x && from.y === to.y) return { valid: false, reason: '位置相同' };

    const targetPiece = this.board[to.y][to.x];
    if (targetPiece && targetPiece.color === piece.color) {
      return { valid: false, reason: '不能吃己方棋子' };
    }

    const pieceValidation = this.validatePieceMove(piece, from, to);
    if (!pieceValidation.valid) return pieceValidation;

    if (this.wouldBeInCheck(from, to, piece.color)) {
      return { valid: false, reason: '不能送将' };
    }

    if (this.wouldKingsFace(from, to)) {
      return { valid: false, reason: '将帅不能照面' };
    }

    return { valid: true };
  }

  private isValidPosition(pos: Position): boolean {
    return pos.x >= 0 && pos.x < 9 && pos.y >= 0 && pos.y < 10;
  }

  private validatePieceMove(piece: Piece, from: Position, to: Position): ValidationResult {
    switch (piece.type) {
      case 'p': return this.validatePawnMove(piece, from, to);
      case 'r': return this.validateRookMove(from, to);
      case 'n': return this.validateKnightMove(from, to);
      case 'b': return this.validateBishopMove(piece, from, to);
      case 'a': return this.validateAdvisorMove(piece, from, to);
      case 'k': return this.validateKingMove(piece, from, to);
      case 'c': return this.validateCannonMove(from, to);
      default: return { valid: false, reason: '未知棋子类型' };
    }
  }

  private validatePawnMove(piece: Piece, from: Position, to: Position): ValidationResult {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const isRed = piece.color === 'red';
    const forward = isRed ? -1 : 1;
    const hasCrossedRiver = isRed ? from.y <= 4 : from.y >= 5;

    if (!hasCrossedRiver) {
      if (deltaX !== 0 || deltaY !== forward) {
        return { valid: false, reason: '兵/卒未过河时只能前进一格' };
      }
    } else {
      if (!((deltaY === forward && deltaX === 0) || (deltaY === 0 && Math.abs(deltaX) === 1))) {
        return { valid: false, reason: '兵/卒过河后只能前进或横走一格' };
      }
    }

    if (deltaY === -forward) {
      return { valid: false, reason: '兵/卒不能后退' };
    }

    return { valid: true };
  }

  private validateRookMove(from: Position, to: Position): ValidationResult {
    if (to.x - from.x !== 0 && to.y - from.y !== 0) {
      return { valid: false, reason: '车必须直线移动' };
    }
    if (this.hasPieceBetween(from, to)) {
      return { valid: false, reason: '车不能越过棋子' };
    }
    return { valid: true };
  }

  private validateKnightMove(from: Position, to: Position): ValidationResult {
    const deltaX = Math.abs(to.x - from.x);
    const deltaY = Math.abs(to.y - from.y);
    if (!((deltaX === 2 && deltaY === 1) || (deltaX === 1 && deltaY === 2))) {
      return { valid: false, reason: '马必须走日字' };
    }
    if (this.isKnightBlocked(from, to)) {
      return { valid: false, reason: '撇马腿' };
    }
    return { valid: true };
  }

  private isKnightBlocked(from: Position, to: Position): boolean {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    let legX = from.x, legY = from.y;
    if (Math.abs(deltaX) === 2) {
      legX = from.x + deltaX / 2;
    } else {
      legY = from.y + deltaY / 2;
    }
    return this.board[legY][legX] !== null;
  }

  private validateBishopMove(piece: Piece, from: Position, to: Position): ValidationResult {
    const deltaX = Math.abs(to.x - from.x);
    const deltaY = Math.abs(to.y - from.y);
    if (deltaX !== 2 || deltaY !== 2) {
      return { valid: false, reason: '象必须走田字' };
    }
    const eyeX = (from.x + to.x) / 2;
    const eyeY = (from.y + to.y) / 2;
    if (this.board[eyeY][eyeX] !== null) {
      return { valid: false, reason: '塞象眼' };
    }
    if (piece.color === 'red' && to.y < 5) {
      return { valid: false, reason: '红象不能过河' };
    }
    if (piece.color === 'black' && to.y > 4) {
      return { valid: false, reason: '黑象不能过河' };
    }
    return { valid: true };
  }

  private validateAdvisorMove(piece: Piece, from: Position, to: Position): ValidationResult {
    if (Math.abs(to.x - from.x) !== 1 || Math.abs(to.y - from.y) !== 1) {
      return { valid: false, reason: '士必须斜走一格' };
    }
    if (!this.isInPalace(to, piece.color)) {
      return { valid: false, reason: '士不能离开九宫' };
    }
    return { valid: true };
  }

  private validateKingMove(piece: Piece, from: Position, to: Position): ValidationResult {
    const deltaX = Math.abs(to.x - from.x);
    const deltaY = Math.abs(to.y - from.y);
    if ((deltaX === 1 && deltaY === 0) || (deltaX === 0 && deltaY === 1)) {
      if (!this.isInPalace(to, piece.color)) {
        return { valid: false, reason: '将不能离开九宫' };
      }
      return { valid: true };
    }
    return { valid: false, reason: '将必须走一格' };
  }

  private isInPalace(pos: Position, color: PieceColor): boolean {
    if (color === 'red') return pos.x >= 3 && pos.x <= 5 && pos.y >= 7 && pos.y <= 9;
    return pos.x >= 3 && pos.x <= 5 && pos.y >= 0 && pos.y <= 2;
  }

  private validateCannonMove(from: Position, to: Position): ValidationResult {
    if (to.x - from.x !== 0 && to.y - from.y !== 0) {
      return { valid: false, reason: '炮必须直线移动' };
    }
    const targetPiece = this.board[to.y][to.x];
    const piecesBetween = this.countPiecesBetween(from, to);

    if (targetPiece === null) {
      if (piecesBetween > 0) {
        return { valid: false, reason: '炮移动时不能越过棋子' };
      }
    } else {
      if (piecesBetween !== 1) {
        return { valid: false, reason: '炮吃子时必须隔一个棋子' };
      }
    }
    return { valid: true };
  }

  private hasPieceBetween(from: Position, to: Position): boolean {
    return this.countPiecesBetween(from, to) > 0;
  }

  private countPiecesBetween(from: Position, to: Position): number {
    let count = 0;
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    let x = from.x + dx, y = from.y + dy;
    while (x !== to.x || y !== to.y) {
      if (this.board[y][x] !== null) count++;
      x += dx;
      y += dy;
    }
    return count;
  }

  private wouldBeInCheck(from: Position, to: Position, color: PieceColor): boolean {
    const originalTo = this.board[to.y][to.x];
    const movingPiece = this.board[from.y][from.x];
    this.board[to.y][to.x] = movingPiece;
    this.board[from.y][from.x] = null;
    const inCheck = this.isCheck(color);
    this.board[from.y][from.x] = movingPiece;
    this.board[to.y][to.x] = originalTo;
    return inCheck;
  }

  private wouldKingsFace(from: Position, to: Position): boolean {
    const originalTo = this.board[to.y][to.x];
    const movingPiece = this.board[from.y][from.x];
    this.board[to.y][to.x] = movingPiece;
    this.board[from.y][from.x] = null;
    const kingsFace = this.areKingsFacing();
    this.board[from.y][from.x] = movingPiece;
    this.board[to.y][to.x] = originalTo;
    return kingsFace;
  }

  private areKingsFacing(): boolean {
    let redKing: Position | null = null;
    let blackKing: Position | null = null;
    for (let y = 0; y < 10; y++) {
      for (let x = 3; x <= 5; x++) {
        const piece = this.board[y][x];
        if (piece?.type === 'k') {
          if (piece.color === 'red') redKing = { x, y };
          else blackKing = { x, y };
        }
      }
    }
    if (!redKing || !blackKing) return false;
    if (redKing.x !== blackKing.x) return false;
    for (let y = Math.min(redKing.y, blackKing.y) + 1; y < Math.max(redKing.y, blackKing.y); y++) {
      if (this.board[y][redKing.x] !== null) return false;
    }
    return true;
  }

  private isCheck(color: PieceColor): boolean {
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
    if (!kingPos) return false;

    const enemyColor: PieceColor = color === 'red' ? 'black' : 'red';
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        const piece = this.board[y][x];
        if (piece && piece.color === enemyColor) {
          if (this.canPieceAttack(piece, { x, y }, kingPos)) return true;
        }
      }
    }
    return false;
  }

  private canPieceAttack(piece: Piece, from: Position, to: Position): boolean {
    switch (piece.type) {
      case 'p': return this.validatePawnMove(piece, from, to).valid;
      case 'r': return this.validateRookMove(from, to).valid;
      case 'n': return this.validateKnightMove(from, to).valid;
      case 'b': return this.validateBishopMove(piece, from, to).valid;
      case 'a': return this.validateAdvisorMove(piece, from, to).valid;
      case 'k': {
        if (this.validateKingMove(piece, from, to).valid) return true;
        if (from.x === to.x && this.areKingsFacingOnColumn(from.x, from.y, to.y)) return true;
        return false;
      }
      case 'c': {
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        if (dx !== 0 && dy !== 0) return false;
        return this.countPiecesBetween(from, to) === 1;
      }
      default: return false;
    }
  }

  private areKingsFacingOnColumn(x: number, y1: number, y2: number): boolean {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY + 1; y < maxY; y++) {
      if (this.board[y][x] !== null) return false;
    }
    return true;
  }
}
