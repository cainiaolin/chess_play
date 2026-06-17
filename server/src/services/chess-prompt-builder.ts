import { Board, Move, AIRequest, PieceType, PieceColor } from '../types/chess';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 中国象棋 LLM Prompt 构建器
 *
 * 职责单一：把对局状态转换为高质量的 LLM 输入（系统提示 + 用户提示）。
 * 不做任何走法枚举或合法性判断（保持"纯 LLM 推理"理念）。
 *
 * 设计要点：
 * - 战略知识与 CoT 模板外置为 Markdown，支持缓存读取，便于非开发人员调优
 * - 棋盘同时提供「可视化图 + FEN + 中文棋谱 + 子力统计 + 阶段」，多维度帮助 LLM 理解局面
 * - 提示 LLM 当前回合数与阶段（开局/中局/残局），引导其采用对应战略
 */

// ── 棋子展示价值（用于子力统计，给 LLM 直观对比） ─────────────────────
const PIECE_DISPLAY_VALUE: Record<PieceType, number> = {
  k: 0,    // 将帅不计入子力
  r: 9,    // 车
  c: 4.5,  // 炮
  n: 4,    // 马
  b: 2,    // 相/象
  a: 2,    // 仕/士
  p: 1,    // 兵/卒（过河加成在计算时处理）
};

// 红方棋子名称（大写含义：红方在底部，y 较大）
const PIECE_NAMES_RED: Record<PieceType, string> = {
  k: '帅', a: '仕', b: '相', n: '马', r: '车', c: '炮', p: '兵',
};
const PIECE_NAMES_BLACK: Record<PieceType, string> = {
  k: '将', a: '士', b: '象', n: '马', r: '车', c: '炮', p: '卒',
};

// ── Markdown 提示文件缓存 ───────────────────────────────────────────
const cache = new Map<string, string>();

function loadPromptFile(filename: string): string {
  const cached = cache.get(filename);
  if (cached) return cached;

  const filepath = path.join(__dirname, '..', 'prompts', filename);
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    cache.set(filename, content);
    return content;
  } catch {
    // 文件缺失时给出明确错误，避免静默退化
    throw new Error(`Prompt 文件加载失败: ${filepath}`);
  }
}

// ── 棋盘表示工具 ─────────────────────────────────────────────────────

/**
 * 将棋盘转换为人类易读的可视化字符串（带坐标轴与楚河汉界）。
 * 黑方棋子用圆括号标注，红方用方括号，便于 LLM 区分。
 */
function boardToVisual(board: Board): string {
  // 列号表头
  let str = '      0   1   2   3   4   5   6   7   8   (x列)\n';
  str += '    ┌───┬───┬───┬───┬───┬───┬───┬───┬───┐\n';

  for (let y = 0; y < 10; y++) {
    str += `  ${y} │`;
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];
      if (piece) {
        const name = piece.color === 'red'
          ? PIECE_NAMES_RED[piece.type]
          : PIECE_NAMES_BLACK[piece.type];
        // 红方[帅] 黑方(将)，空位用 ·
        str += piece.color === 'red' ? ` ${name}│` : `(${name})│`;
      } else {
        str += ' · │';
      }
    }
    str += '\n';

    // 楚河汉界分隔线
    if (y === 4) {
      str += '    ├───┴───┴───┴───┴───┴───┴───┴───┴───┤\n';
      str += '    │        楚    河    汉    界        │\n';
      str += '    ├───┬───┬───┬───┬───┬───┬───┬───┬───┤\n';
    } else if (y < 9) {
      str += '    ├───┼───┼───┼───┼───┼───┼───┼───┼───┤\n';
    }
  }
  str += '    └───┴───┴───┴───┴───┴───┴───┴───┴───┘\n';
  str += '     红方在底部(y=5-9)  黑方在顶部(y=0-4)\n';
  return str;
}

/**
 * 将棋盘转换为 FEN 字符串（紧凑表示，便于 LLM 精确定位）。
 * 红方大写、黑方小写，与 chess-engine.toFen 一致。
 */
function boardToFen(board: Board, turn: PieceColor): string {
  const rows: string[] = [];
  for (let y = 0; y < 10; y++) {
    let row = '';
    let empty = 0;
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];
      if (piece === null) {
        empty++;
      } else {
        if (empty > 0) {
          row += empty.toString();
          empty = 0;
        }
        const ch = piece.color === 'red'
          ? piece.type.toUpperCase()
          : piece.type.toLowerCase();
        row += ch;
      }
    }
    if (empty > 0) row += empty.toString();
    rows.push(row);
  }
  return `${rows.join('/')} ${turn === 'red' ? 'w' : 'b'}`;
}

// ── 子力统计 ─────────────────────────────────────────────────────────

interface MaterialSummary {
  redValue: number;
  blackValue: number;
  redPieces: string[];
  blackPieces: string[];
  balance: number; // 正数=红方优，负数=黑方优
  balanceText: string;
}

/**
 * 统计双方子力价值。过河兵/卒价值翻倍。
 */
function calculateMaterial(board: Board): MaterialSummary {
  let redValue = 0;
  let blackValue = 0;
  const redPieces: string[] = [];
  const blackPieces: string[] = [];

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];
      if (!piece || piece.type === 'k') continue;

      let value = PIECE_DISPLAY_VALUE[piece.type];
      const name = piece.color === 'red'
        ? PIECE_NAMES_RED[piece.type]
        : PIECE_NAMES_BLACK[piece.type];

      // 过河兵卒价值翻倍
      if (piece.type === 'p') {
        const crossed = piece.color === 'red' ? y < 5 : y > 4;
        if (crossed) value *= 2;
      }

      if (piece.color === 'red') {
        redValue += value;
        redPieces.push(name);
      } else {
        blackValue += value;
        blackPieces.push(name);
      }
    }
  }

  const balance = redValue - blackValue;
  let balanceText: string;
  if (Math.abs(balance) < 0.5) {
    balanceText = '双方子力均势';
  } else if (balance > 0) {
    balanceText = `红方领先 ${balance.toFixed(1)}`;
  } else {
    balanceText = `黑方领先 ${(-balance).toFixed(1)}`;
  }

  return {
    redValue,
    blackValue,
    redPieces,
    blackPieces,
    balance,
    balanceText,
  };
}

// ── 阶段判断 ─────────────────────────────────────────────────────────

type Phase = '开局' | '中局' | '残局';

/**
 * 根据回合数与剩余大子数量判断局面阶段，引导 LLM 采用对应战略。
 */
function detectPhase(history: Move[], board: Board): Phase {
  const fullMoves = Math.ceil(history.length / 2);

  // 统计大子（车马炮）总数
  let majorPieces = 0;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (p && (p.type === 'r' || p.type === 'n' || p.type === 'c')) {
        majorPieces++;
      }
    }
  }

  if (fullMoves <= 10 && majorPieces >= 10) return '开局';
  if (majorPieces <= 5 || fullMoves >= 30) return '残局';
  return '中局';
}

// ── 走法记谱 ─────────────────────────────────────────────────────────

const COLUMN_CHINESE = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/**
 * 将走法序列转为中文棋谱（红方汉字列号、黑方阿拉伯数字列号），便于 LLM 理解上下文。
 */
function movesToNotation(history: Move[]): string {
  if (history.length === 0) return '（无，这是第一步）';

  return history.map((move, index) => {
    const isRed = index % 2 === 0;
    const pieceName = isRed
      ? PIECE_NAMES_RED[move.piece]
      : PIECE_NAMES_BLACK[move.piece];
    const captureMark = move.captured ? '吃' : '';

    const fromCol = isRed
      ? COLUMN_CHINESE[8 - move.from.x]
      : (move.from.x + 1).toString();
    const toCol = isRed
      ? COLUMN_CHINESE[8 - move.to.x]
      : (move.to.x + 1).toString();

    const dy = move.to.y - move.from.y;
    let action: string;
    if (dy === 0) {
      action = `平${toCol}`;
    } else if ((isRed && dy < 0) || (!isRed && dy > 0)) {
      const dist = Math.abs(dy);
      action = `进${isRed ? COLUMN_CHINESE[dist - 1] || dist : dist}`;
    } else {
      const dist = Math.abs(dy);
      action = `退${isRed ? COLUMN_CHINESE[dist - 1] || dist : dist}`;
    }

    const sideMark = isRed ? '红' : '黑';
    return `${Math.floor(index / 2) + 1}. ${sideMark}${pieceName}${fromCol}${captureMark}${action}`;
  }).join('  ');
}

// ── Prompt 组装 ──────────────────────────────────────────────────────

/**
 * 构建系统提示：身份 + 棋规 + 战略知识 + CoT 输出模板。
 */
export function buildSystemPrompt(): string {
  const rules = loadPromptFile('chess-rules.md');
  const strategy = loadPromptFile('strategy-knowledge.md');
  const cotTemplate = loadPromptFile('cot-template.md');

  return `你是一位大师级的中国象棋棋手，拥有深厚的开局理论、中局战术计算和残局技巧。
你的目标是在当前局面下走出最优着法，既要争取胜利，也要确保不犯错、不送子、不让己方被将死。

# 第一部分：棋规（必须严格遵守）
${rules}

# 第二部分：战略知识库（决策依据）
${strategy}

# 第三部分：思维链输出格式（强制）
${cotTemplate}

# 最终强调
1. 你必须独立完成局面分析，自行识别将军、威胁与机会。
2. 严禁输出非法走法：坐标越界、走子不符合该棋子规则、走出后被将军，都将被视为失败。
3. 严格按第三部分的 JSON 五段式结构输出，只输出一个 JSON 代码块，不要输出任何额外文字。`;
}

/**
 * 构建用户提示：当前局面的完整上下文。
 */
export function buildUserPrompt(request: AIRequest): string {
  const role = request.role === 'red' ? '红方' : '黑方';
  const visual = boardToVisual(request.board);
  const fen = boardToFen(request.board, request.role);
  const material = calculateMaterial(request.board);
  const phase = detectPhase(request.history, request.board);
  const notation = movesToNotation(request.history);
  const fullMoves = Math.ceil(request.history.length / 2);

  // 执子方视角说明
  const perspective = request.role === 'red'
    ? '你执红方，棋子在棋盘底部（y 较大），目标是把棋子向 y 减小方向（黑方九宫）推进。'
    : '你执黑方，棋子在棋盘顶部（y 较小），目标是把棋子向 y 增大方向（红方九宫）推进。';

  return `## 当前对局信息

**你执棋方**：${role}
**当前回合**：第 ${fullMoves + 1} 回合
**局面阶段**：${phase}（请采用对应的战略原则）
${perspective}

## 棋盘可视化

${visual}

## FEN 表示（紧凑格式）

\`${fen}\`
（大写=红方，小写=黑方；字符含义：k=帅/将 a=仕/士 b=相/象 n=马 r=车 c=炮 p=兵/卒）

## 子力对比

- 红方剩余：${material.redPieces.join('、') || '无'}（估值 ${material.redValue.toFixed(1)}）
- 黑方剩余：${material.blackPieces.join('、') || '无'}（估值 ${material.blackValue.toFixed(1)}）
- 子力评估：${material.balanceText}

## 历史走法（中文棋谱）

${notation}

## 你的任务

请仔细分析当前局面，严格按照系统提示中规定的五段式 JSON 格式输出你的决策。
记住：先识别自身威胁（step1），再扫描机会（step2），生成候选（step3），深度评估（step4），最终决策（step5）。
确保你的走法合法、不送子、不让己方被将军。`;
}

/**
 * 组装完整的 messages 数组，直接传给 LLM。
 */
export function buildMessages(request: AIRequest): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(request) },
  ];
}
