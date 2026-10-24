// 引擎思考过程 → 中文解说文本
// 把 Pikafish 的真实搜索数据（深度/评估/主变）转成用户可读的解说，
// 替代 LLM thinking：零延迟、零成本，且与实际走法绝对一致。
import { Board, PieceColor } from '../types/chess';
import { EngineSearchInfo } from './pikafish-engine';
import { moveToChineseNotation, parseUciMove, describeEngineScore } from './xiangqi-notation';

/** PV 展示的最大步数（半回合），过长会淹没面板 */
const MAX_PV_MOVES = 6;

/**
 * 在棋盘副本上执行一步 UCI 走法（不校验规则——引擎 PV 必然合法）
 * 返回执行后的新棋盘与中文记法
 */
function applyUciMove(board: Board, uci: string): { board: Board; text: string } {
  const { from, to } = parseUciMove(uci);
  const text = moveToChineseNotation(board, from, to);
  const next: Board = board.map(row => row.map(cell => (cell ? { ...cell } : null)));
  next[to.y][to.x] = next[from.y][from.x];
  next[from.y][from.x] = null;
  return { board: next, text };
}

/**
 * 生成引擎思考解说
 * 示例："深度 24 层，用时 1.2 秒，局面评估：红方占优（+2.36）。预演着法：炮二平五、马8进7、车9进1…"
 * @param boardBefore 走子前的棋盘（用于 PV 记谱）
 * @param mover 本次行棋方
 */
export function formatEngineThinking(boardBefore: Board, mover: PieceColor, info: EngineSearchInfo): string {
  const parts: string[] = [];

  if (typeof info.depth === 'number') {
    parts.push(`深度 ${info.depth} 层`);
  }

  // 评估：优先 mate（绝杀预告），否则用厘兵分档位描述
  const hasMate = typeof info.scoreMate === 'number' && info.scoreMate !== 0;
  if (hasMate || typeof info.scoreCp === 'number') {
    const verdict = describeEngineScore(
      { cp: info.scoreCp, mate: info.scoreMate },
      mover
    );
    parts.push(`局面评估：${verdict}`);
  }

  // 主变转中文记法：逐着在副本盘面上推演记谱
  if (info.pv.length > 0) {
    let board = boardBefore;
    const texts: string[] = [];
    for (const uci of info.pv.slice(0, MAX_PV_MOVES)) {
      try {
        const step = applyUciMove(board, uci);
        board = step.board;
        texts.push(step.text);
      } catch {
        // PV 某步解析失败（理论上不该发生）就截断到此
        break;
      }
    }
    if (texts.length > 0) {
      const suffix = info.pv.length > MAX_PV_MOVES ? '…' : '';
      parts.push(`预演着法：${texts.join('、')}${suffix}`);
    }
  }

  return parts.join('，') + (parts.length > 0 ? '。' : '');
}
