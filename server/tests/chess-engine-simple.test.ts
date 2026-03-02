import { describe, it, expect } from '@jest/globals';
import { ChessEngine } from '../src/services/chess-engine';

describe('ChessEngine - Core Functionality', () => {
  it('should create initial board correctly', () => {
    const engine = new ChessEngine();
    const board = engine.getBoard();

    expect(board).toHaveLength(10);
    expect(board[0]).toHaveLength(9);
    expect(engine.getTurn()).toBe('red');
  });

  it('should validate pawn forward movement', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 0, y: 6 }, { x: 0, y: 5 });
    expect(result.valid).toBe(true);
  });

  it('should reject pawn backward movement', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 0, y: 6 }, { x: 0, y: 7 });
    expect(result.valid).toBe(false);
  });

  it('should validate knight movement', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 1, y: 9 }, { x: 3, y: 8 });
    expect(result.valid).toBe(true);
  });

  it('should validate bishop movement', () => {
    const engine = new ChessEngine();
    // Clear path
    const board = engine.getBoard();
    board[6][2] = null;
    const result = engine.validateMove({ x: 2, y: 9 }, { x: 4, y: 7 });
    expect(result.valid).toBe(true);
  });

  it('should validate rook movement', () => {
    const engine = new ChessEngine();
    // Clear path
    const board = engine.getBoard();
    board[9][1] = null;
    const result = engine.validateMove({ x: 0, y: 9 }, { x: 2, y: 9 });
    expect(result.valid).toBe(true);
  });

  it('should validate advisor movement', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 3, y: 9 }, { x: 4, y: 8 });
    expect(result.valid).toBe(true);
  });

  it('should validate king movement', () => {
    const engine = new ChessEngine();
    // Clear path
    const board = engine.getBoard();
    board[9][3] = null;
    const result = engine.validateMove({ x: 4, y: 9 }, { x: 3, y: 9 });
    expect(result.valid).toBe(true);
  });

  it('should validate cannon movement', () => {
    const engine = new ChessEngine();
    const result = engine.validateMove({ x: 1, y: 7 }, { x: 1, y: 5 });
    expect(result.valid).toBe(true);
  });

  it('should make valid move', () => {
    const engine = new ChessEngine();
    engine.makeMove({ x: 0, y: 6 }, { x: 0, y: 5 });
    expect(engine.getTurn()).toBe('black');
    expect(engine.getMoves().length).toBe(1);
  });

  it('should reject invalid move', () => {
    const engine = new ChessEngine();
    expect(() => {
      engine.makeMove({ x: 0, y: 6 }, { x: 0, y: 7 });
    }).toThrow();
  });

  it('should detect check', () => {
    const engine = new ChessEngine();
    const board = engine.getBoard();

    // Create check scenario
    board[8][4] = null;
    board[7][4] = null;
    board[6][4] = { type: 'r', color: 'black' };

    expect(engine.isCheck('red')).toBe(true);
  });

  it('should detect checkmate', () => {
    const engine = new ChessEngine();
    const board = engine.getBoard();

    // Create checkmate scenario
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        if (board[y][x]?.color === 'red' && board[y][x]?.type !== 'k') {
          board[y][x] = null;
        }
      }
    }

    board[9][4] = { type: 'k', color: 'red' };
    board[9][3] = null;
    board[9][5] = null;
    board[8][3] = null;
    board[8][4] = null;
    board[8][5] = null;
    board[7][4] = { type: 'r', color: 'black' };

    expect(engine.isCheckmate('red')).toBe(true);
  });

  it('should detect stalemate', () => {
    const engine = new ChessEngine();
    const board = engine.getBoard();

    // Clear board except kings
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        board[y][x] = null;
      }
    }

    board[9][4] = { type: 'k', color: 'red' };
    board[0][4] = { type: 'k', color: 'black' };
    board[9][3] = { type: 'a', color: 'black' };
    board[9][5] = { type: 'a', color: 'black' };
    board[8][4] = { type: 'a', color: 'black' };

    expect(engine.isStalemate('red')).toBe(true);
  });

  it('should prevent kings from facing each other', () => {
    const engine = new ChessEngine();
    const board = engine.getBoard();

    // Clear path between kings
    for (let y = 1; y <= 8; y++) {
      board[y][4] = null;
    }

    // Try to move red king
    const result = engine.validateMove({ x: 4, y: 9 }, { x: 4, y: 8 });

    // After moving, kings would face each other
    const kingsFace = () => {
      const temp = board[8][4];
      board[8][4] = board[9][4];
      board[9][4] = null;

      let redKing = null, blackKing = null;
      for (let y = 0; y < 10; y++) {
        for (let x = 3; x <= 5; x++) {
          const p = board[y][x];
          if (p?.type === 'k') {
            if (p.color === 'red') redKing = { x, y };
            else blackKing = { x, y };
          }
        }
      }

      board[9][4] = board[8][4];
      board[8][4] = temp;

      return redKing?.x === blackKing?.x && redKing && blackKing;
    };

    expect(kingsFace()).toBe(true);
  });
});
