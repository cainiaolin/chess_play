// 象棋坐标转换与中文纵线记法
// 服务于 Pikafish 引擎模式：UCI 坐标 <-> 项目 Position 坐标互转，
// 并把走法/评估翻译成中文解说供前端"AI 思考过程"面板展示。
import { Board, PieceColor, PieceType, Position } from '../types/chess';

// ---------------------------------------------------------------------------
// UCI 坐标转换
// 坐标约定（Pikafish/Stockfish 系引擎）：file a-i 对应 x 0-8（左→右），
// rank 0-9 中 rank 0 = 红方底线（类比国际象棋 rank 1 = 白方底线）。
// 本项目 y=9 是红方底线，因此 uciRank = 9 - y。
// 该约定由 tests/integration/pikafish-engine.test.ts 的一步杀用例作正式裁决。
// ---------------------------------------------------------------------------

const FILE_CHARS = 'abcdefghi';

export function positionToUciSquare(p: Position): string {
  return `${FILE_CHARS[p.x]}${9 - p.y}`;
}

export function uciSquareToPosition(sq: string): Position {
  if (!/^[a-i][0-9]$/.test(sq)) {
    throw new Error(`非法 UCI 坐标: ${sq}`);
  }
  return { x: FILE_CHARS.indexOf(sq[0]), y: 9 - Number(sq[1]) };
}

export function parseUciMove(mv: string): { from: Position; to: Position } {
  if (!/^[a-i][0-9][a-i][0-9]$/.test(mv)) {
    throw new Error(`非法 UCI 走法: ${mv}`);
  }
  return {
    from: uciSquareToPosition(mv.slice(0, 2)),
    to: uciSquareToPosition(mv.slice(2, 4))
  };
}

// ---------------------------------------------------------------------------
// 中文纵线记法
// 规则：红方纵线用汉字一~九、从红方右手边数起（x=8 是一线）；
// 黑方纵线用阿拉伯数字 1~9、从黑方右手边数起（x=0 是 1 路）。
// ---------------------------------------------------------------------------

const PIECE_NAMES: Record<PieceColor, Record<PieceType, string>> = {
  red: { k: '帅', a: '仕', b: '相', n: '马', r: '车', c: '炮', p: '兵' },
  black: { k: '将', a: '士', b: '象', n: '马', r: '车', c: '炮', p: '卒' }
};

const CN_DIGITS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 纵线号：红方 9-x（汉字），黑方 x+1（阿拉伯数字） */
function fileNumber(x: number, color: PieceColor): number {
  return color === 'red' ? 9 - x : x + 1;
}

/** 数字转对应方记谱文本：红方汉字，黑方阿拉伯数字 */
function numToText(n: number, color: PieceColor): string {
  if (n < 1 || n > 9) {
    throw new Error(`纵线号超出范围: ${n}`);
  }
  return color === 'red' ? CN_DIGITS[n - 1] : String(n);
}

/**
 * 同纵线同类棋子消歧前缀
 * 两个子用 前/后（红方 y 小者为前、黑方 y 大者为前）；
 * 三个及以上（仅兵/卒可能出现）用 前/中/后，超过三个用序号兜底。
 */
function disambiguationPrefix(board: Board, from: Position, type: PieceType, color: PieceColor): string {
  const sameFile: number[] = [];
  for (let y = 0; y < 10; y++) {
    const piece = board[y][from.x];
    if (piece && piece.type === type && piece.color === color) {
      sameFile.push(y);
    }
  }
  if (sameFile.length < 2) {
    return '';
  }
  // 从"前"到"后"排序
  sameFile.sort((a, b) => (color === 'red' ? a - b : b - a));
  const index = sameFile.indexOf(from.y);
  if (sameFile.length === 2) {
    return index === 0 ? '前' : '后';
  }
  if (sameFile.length === 3) {
    return ['前', '中', '后'][index];
  }
  // 罕见：同纵线 4+ 个兵/卒，按"前/二/三/…/后"编号
  if (index === 0) return '前';
  if (index === sameFile.length - 1) return '后';
  return CN_DIGITS[index];
}

/**
 * 把一步走法翻译成中文纵线记法（如"炮二平五"、"马8进7"、"仕六进五"）
 * 需要"走子前"的棋盘，用于识别棋子与同纵线消歧。
 */
export function moveToChineseNotation(board: Board, from: Position, to: Position): string {
  const piece = board[from.y]?.[from.x];
  if (!piece) {
    throw new Error(`起点无棋子: (${from.x},${from.y})`);
  }
  const { type, color } = piece;
  const name = PIECE_NAMES[color][type];
  const prefix = disambiguationPrefix(board, from, type, color);

  // 主语：消歧时"前炮"（不带纵线号），否则"炮二"（棋子名+纵线号）
  const head = prefix
    ? `${prefix}${name}`
    : `${name}${numToText(fileNumber(from.x, color), color)}`;

  // 动词：平 = 横向移动；进/退按行进方向（红方 y 减小为进，黑方相反）
  let verb: string;
  if (to.y === from.y) {
    verb = '平';
  } else {
    const forward = color === 'red' ? to.y < from.y : to.y > from.y;
    verb = forward ? '进' : '退';
  }

  // 目标数：斜走子（马相象士仕）进退时用目标纵线号（如"仕六进五"）；
  // 直线子（车炮将兵卒）平用目标纵线号、进退用格数（如"兵五进一"）
  const diagonal = type === 'n' || type === 'b' || type === 'a';
  let target: string;
  if (verb === '平' || diagonal) {
    target = numToText(fileNumber(to.x, color), color);
  } else {
    target = numToText(Math.abs(to.y - from.y), color);
  }

  return `${head}${verb}${target}`;
}

// ---------------------------------------------------------------------------
// 引擎评估分 -> 中文描述
// Pikafish 惯例：正分表示"当前行棋方"占优，需先换算到红方视角再描述。
// ---------------------------------------------------------------------------

export interface EngineScore {
  /** 厘兵单位（兵=100），行棋方视角 */
  cp?: number;
  /** 行棋方 N 步内绝杀（负数 = 行棋方 N 步内被绝杀） */
  mate?: number;
}

export function describeEngineScore(score: EngineScore, mover: PieceColor): string {
  const sign = mover === 'red' ? 1 : -1;
  if (typeof score.mate === 'number' && score.mate !== 0) {
    const redMate = score.mate * sign;
    const steps = Math.abs(score.mate);
    return redMate > 0 ? `红方 ${steps} 步内绝杀` : `黑方 ${steps} 步内绝杀`;
  }
  const cp = (typeof score.cp === 'number' ? score.cp : 0) * sign;
  const abs = Math.abs(cp);
  let verdict: string;
  if (abs < 30) {
    verdict = '局面均势';
  } else if (abs < 150) {
    verdict = cp > 0 ? '红方略优' : '黑方略优';
  } else if (abs < 500) {
    verdict = cp > 0 ? '红方占优' : '黑方占优';
  } else if (abs < 1200) {
    verdict = cp > 0 ? '红方大优' : '黑方大优';
  } else {
    verdict = cp > 0 ? '红方胜势' : '黑方胜势';
  }
  return `${verdict}（${cp > 0 ? '+' : ''}${(cp / 100).toFixed(2)}）`;
}
