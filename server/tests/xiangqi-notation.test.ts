// xiangqi-notation 单元测试：坐标转换、中文纵线记法、评估分描述
// 记法锚点取自真实开局着法（炮二平五/马8进7 等），确保算法与棋谱规范一致。
import { describe, it, expect } from '@jest/globals';
import {
  positionToUciSquare,
  uciSquareToPosition,
  parseUciMove,
  moveToChineseNotation,
  describeEngineScore
} from '../src/services/xiangqi-notation';
import { ChessEngine } from '../src/services/chess-engine';
import { Board, PieceColor, PieceType, Position } from '../src/types/chess';

/** 构造自定义盘面：pieces 放置列表，其余为空 */
function makeBoard(pieces: Array<{ type: PieceType; color: PieceColor; x: number; y: number }>): Board {
  const board: Board = Array(10).fill(null).map(() => Array(9).fill(null));
  for (const p of pieces) {
    board[p.y][p.x] = { type: p.type, color: p.color };
  }
  return board;
}

function pos(x: number, y: number): Position {
  return { x, y };
}

describe('UCI 坐标转换', () => {
  it('should_convert_to_a0_when_red_bottom_left_corner', () => {
    // y=9 是红方底线 -> rank 0；x=0 -> file a
    expect(positionToUciSquare(pos(0, 9))).toBe('a0');
  });

  it('should_convert_to_i9_when_black_top_right_corner', () => {
    expect(positionToUciSquare(pos(8, 0))).toBe('i9');
  });

  it('should_roundtrip_when_converting_squares', () => {
    for (let x = 0; x <= 8; x++) {
      for (let y = 0; y <= 9; y++) {
        const square = positionToUciSquare(pos(x, y));
        const back = uciSquareToPosition(square);
        expect(back).toEqual(pos(x, y));
      }
    }
  });

  it('should_throw_when_uci_square_format_invalid', () => {
    expect(() => uciSquareToPosition('j1')).toThrow();
    expect(() => uciSquareToPosition('a10')).toThrow();
    expect(() => uciSquareToPosition('')).toThrow();
  });

  it('should_parse_uci_move_when_valid', () => {
    // h2 = (7,7)，e2 = (4,7)：开局中炮的着点
    expect(parseUciMove('h2e2')).toEqual({ from: pos(7, 7), to: pos(4, 7) });
  });

  it('should_throw_when_uci_move_format_invalid', () => {
    expect(() => parseUciMove('h2e')).toThrow();
    expect(() => parseUciMove('h2e20')).toThrow();
  });
});

describe('中文纵线记法（初始局面锚点）', () => {
  // 初始盘面取自规则引擎，与真实开局一致
  const initial = new ChessEngine().getBoard();

  it('should_notate_cannon_to_center_when_red_plays_central_cannon', () => {
    // 红炮 (7,7) 平中路 -> "炮二平五"（当头炮）
    expect(moveToChineseNotation(initial, pos(7, 7), pos(4, 7))).toBe('炮二平五');
  });

  it('should_notate_black_horse_when_defending_central_cannon', () => {
    // 黑马 (7,0) 进到 (6,2) -> "马8进7"（屏风马）
    expect(moveToChineseNotation(initial, pos(7, 0), pos(6, 2))).toBe('马8进7');
  });

  it('should_notate_red_horse_when_advancing_to_third_file', () => {
    // 红马 (7,9) 进 (6,7) -> "马二进三"
    expect(moveToChineseNotation(initial, pos(7, 9), pos(6, 7))).toBe('马二进三');
  });

  it('should_notate_black_left_horse_with_arabic_digits', () => {
    // 黑马 (1,0) 进 (2,2) -> "马2进3"
    expect(moveToChineseNotation(initial, pos(1, 0), pos(2, 2))).toBe('马2进3');
  });

  it('should_notate_red_pawn_advance_by_step_count', () => {
    // 红兵 (4,6) 进一格 -> "兵五进一"（直线子进退用格数）
    expect(moveToChineseNotation(initial, pos(4, 6), pos(4, 5))).toBe('兵五进一');
  });

  it('should_notate_black_pawn_advance_with_arabic_digits', () => {
    expect(moveToChineseNotation(initial, pos(4, 3), pos(4, 4))).toBe('卒5进1');
  });

  it('should_notate_chariot_advance_when_moving_forward', () => {
    // 红车 (8,9) 进两格 (8,7) -> "车一进二"
    expect(moveToChineseNotation(initial, pos(8, 9), pos(8, 7))).toBe('车一进二');
  });

  it('should_throw_when_source_square_empty', () => {
    expect(() => moveToChineseNotation(initial, pos(4, 4), pos(4, 5))).toThrow();
  });
});

describe('中文纵线记法（构造局面）', () => {
  it('should_notate_advisor_by_target_file_when_moving_diagonally', () => {
    // 红仕 (3,9) 进 (4,8)：斜走子进退用目标纵线号 -> "仕六进五"
    const board = makeBoard([
      { type: 'a', color: 'red', x: 3, y: 9 },
      { type: 'k', color: 'red', x: 4, y: 9 }
    ]);
    expect(moveToChineseNotation(board, pos(3, 9), pos(4, 8))).toBe('仕六进五');
  });

  it('should_notate_chariot_retreat_when_moving_backward', () => {
    const board = makeBoard([
      { type: 'r', color: 'red', x: 4, y: 4 },
      { type: 'k', color: 'red', x: 4, y: 9 }
    ]);
    // 红车 (4,4) 退两格 (4,6) -> "车五退二"
    expect(moveToChineseNotation(board, pos(4, 4), pos(4, 6))).toBe('车五退二');
  });

  it('should_use_front_back_when_two_same_pieces_on_one_file', () => {
    // 双红炮同在 x=4 纵线：y=5 为前、y=7 为后（红方 y 小为前）
    const board = makeBoard([
      { type: 'c', color: 'red', x: 4, y: 5 },
      { type: 'c', color: 'red', x: 4, y: 7 },
      { type: 'k', color: 'red', x: 4, y: 9 }
    ]);
    expect(moveToChineseNotation(board, pos(4, 5), pos(4, 4))).toBe('前炮进一');
    expect(moveToChineseNotation(board, pos(4, 7), pos(0, 7))).toBe('后炮平九');
  });

  it('should_use_front_middle_back_when_three_pawns_on_one_file', () => {
    const board = makeBoard([
      { type: 'p', color: 'red', x: 4, y: 2 },
      { type: 'p', color: 'red', x: 4, y: 3 },
      { type: 'p', color: 'red', x: 4, y: 4 }
    ]);
    expect(moveToChineseNotation(board, pos(4, 2), pos(4, 1))).toBe('前兵进一');
    expect(moveToChineseNotation(board, pos(4, 3), pos(4, 2))).toBe('中兵进一');
    expect(moveToChineseNotation(board, pos(4, 4), pos(4, 3))).toBe('后兵进一');
  });

  it('should_use_black_perspective_for_front_back_ordering', () => {
    // 双黑炮同在 x=4：黑方 y 大为前
    const board = makeBoard([
      { type: 'c', color: 'black', x: 4, y: 5 },
      { type: 'c', color: 'black', x: 4, y: 7 }
    ]);
    expect(moveToChineseNotation(board, pos(4, 7), pos(4, 8))).toBe('前炮进1');
    expect(moveToChineseNotation(board, pos(4, 5), pos(4, 4))).toBe('后炮退1');
  });
});

describe('引擎评估分中文描述', () => {
  it('should_describe_mate_when_red_to_move_wins', () => {
    expect(describeEngineScore({ mate: 3 }, 'red')).toBe('红方 3 步内绝杀');
  });

  it('should_describe_mate_from_red_perspective_when_black_to_move', () => {
    // 黑方行棋且黑方 N 步杀 -> 红方视角为被杀
    expect(describeEngineScore({ mate: 2 }, 'black')).toBe('黑方 2 步内绝杀');
  });

  it('should_describe_balance_when_score_tiny', () => {
    expect(describeEngineScore({ cp: 10 }, 'red')).toBe('局面均势（+0.10）');
  });

  it('should_describe_slight_advantage_when_score_small', () => {
    expect(describeEngineScore({ cp: 100 }, 'red')).toBe('红方略优（+1.00）');
  });

  it('should_describe_advantage_when_score_medium', () => {
    expect(describeEngineScore({ cp: 250 }, 'red')).toBe('红方占优（+2.50）');
  });

  it('should_flip_perspective_when_black_to_move', () => {
    // 黑方行棋 cp=250（黑优）-> 红方视角 -250 黑方占优
    expect(describeEngineScore({ cp: 250 }, 'black')).toBe('黑方占优（-2.50）');
  });

  it('should_describe_winning_when_score_huge', () => {
    expect(describeEngineScore({ cp: 1500 }, 'red')).toBe('红方胜势（+15.00）');
  });
});
