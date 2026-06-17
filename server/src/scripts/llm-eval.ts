/**
 * LLM 中国象棋能力评估脚本
 *
 * 三种评估模式（通过命令行参数选择）：
 *   --mode=self-play   [--games=3] [--max-moves=120]   LLM 自我对弈，统计对局质量
 *   --mode=vs-local    [--games=6] [--depth=3]         LLM vs 本地 Minimax，统计胜率
 *   --mode=legality    [--games=2] [--max-moves=100]   LLM 走法合法性压力测试
 *
 * 用法（需先配置 server/.env 的 AI_BASE_URL/AI_API_KEY/AI_MODEL）：
 *   npx tsx src/scripts/llm-eval.ts --mode=vs-local --games=6
 *
 * 设计原则：
 * - 真实模拟 game-service 的重试逻辑（非法走法重试最多 3 次）
 * - 完整记录棋谱、胜负、非法走法次数、平均回合数，便于人肉复盘
 * - 不依赖 express/socket，纯引擎驱动
 */

import 'dotenv/config';
import { ChessEngine } from '../services/chess-engine';
import { AIAdapter } from '../services/ai-adapter';
import { LocalAIProvider } from '../services/local-ai';
import { AIRequest, AIResponse, PieceColor, Move } from '../types/chess';

// ── 命令行参数解析 ────────────────────────────────────────────────────

interface CliArgs {
  mode: 'self-play' | 'vs-local' | 'legality';
  games: number;
  maxMoves: number;
  depth: number;
  retries: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const get = (key: string, fallback: string): string => {
    const found = args.find(a => a.startsWith(`--${key}=`));
    return found ? found.split('=')[1] : fallback;
  };

  const parseIntOrExit = (key: string, fallback: string): number => {
    const n = parseInt(get(key, fallback), 10);
    if (!Number.isFinite(n) || n <= 0) {
      console.error(`参数 --${key} 无效，必须是正整数`);
      process.exit(1);
    }
    return n;
  };

  const mode = get('mode', 'vs-local') as CliArgs['mode'];
  if (!['self-play', 'vs-local', 'legality'].includes(mode)) {
    console.error(`参数 --mode 无效，可选: self-play | vs-local | legality`);
    process.exit(1);
  }

  return {
    mode,
    games: parseIntOrExit('games', '6'),
    maxMoves: parseIntOrExit('max-moves', '120'),
    depth: parseIntOrExit('depth', '3'),
    retries: parseIntOrExit('retries', '3'),
  };
}

// ── 玩家抽象 ─────────────────────────────────────────────────────────

interface Player {
  name: string;
  getMove(request: AIRequest, attempt?: number): Promise<AIResponse>;
}

function makeLLMPlayer(): Player {
  const adapter = new AIAdapter();
  return {
    name: 'LLM',
    getMove: (req, attempt) => adapter.getMove(undefined, req, undefined, undefined, attempt || 0),
  };
}

function makeLocalPlayer(depth: number): Player {
  const local = new LocalAIProvider(depth);
  return {
    name: `LocalAI(d=${depth})`,
    // LocalAI 是确定性 Minimax，忽略 attempt
    getMove: (req) => local.getMove(req),
  };
}

// ── 对局引擎 ─────────────────────────────────────────────────────────

interface GameResult {
  winner: 'red' | 'black' | 'draw';
  reason: string;
  totalMoves: number;
  illegalAttempts: number;   // LLM 输出非法走法的总次数
  llmColor: PieceColor | 'both';
  finalFen: string;
  moves: Move[];
}

/**
 * 执行一局对弈。
 * @param red 红方玩家
 * @param black 黑方玩家
 * @param trackedColors 需要统计非法走法的玩家颜色（通常是 LLM 方）
 */
async function playGame(
  red: Player,
  black: Player,
  maxMoves: number,
  retries: number,
  trackedColors: PieceColor[],
): Promise<GameResult> {
  const engine = new ChessEngine();
  let illegalAttempts = 0;

  const getPlayer = (color: PieceColor): Player => color === 'red' ? red : black;
  const isTracked = (color: PieceColor) => trackedColors.includes(color);

  for (let moveNo = 0; moveNo < maxMoves; moveNo++) {
    if (engine.getStatus() !== 'playing') break;

    const color = engine.getTurn();
    const player = getPlayer(color);

    const request: AIRequest = {
      board: engine.getBoard(),
      role: color,
      history: engine.getMoves(),
    };

    // 模拟 game-service 的重试逻辑：1 次首次尝试 + 最多 retries 次重试
    let moveAccepted = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await player.getMove(request, attempt);
        // LocalAIProvider 不经过 AIAdapter 校验，这里统一再做一次合法性确认
        const valid = engine.validateMove(response.from, response.to);
        if (!valid.valid) {
          throw new Error(`非法: ${valid.reason}`);
        }
        engine.makeMove(response.from, response.to);
        moveAccepted = true;
        break;
      } catch (err) {
        if (isTracked(color)) {
          illegalAttempts++;
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`    [非法] 第${moveNo + 1}步 ${color}方 ${player.name} 第${attempt + 1}次尝试: ${msg.slice(0, 80)}`);
        }
      }
    }

    if (!moveAccepted) {
      // 超过重试上限，判该方负
      const winner = color === 'red' ? 'black' : 'red';
      return {
        winner,
        reason: `${color}方(${player.name})连续非法走法判负`,
        totalMoves: moveNo,
        illegalAttempts,
        llmColor: 'both',
        finalFen: engine.toFen(),
        moves: engine.getMoves(),
      };
    }
  }

  // 根据引擎状态判定结果
  const status = engine.getStatus();
  let winner: 'red' | 'black' | 'draw';
  let reason: string;

  if (status === 'red_win') {
    winner = 'red';
    reason = '红方胜';
  } else if (status === 'black_win') {
    winner = 'black';
    reason = '黑方胜';
  } else if (status === 'draw') {
    winner = 'draw';
    reason = '和棋';
  } else {
    winner = 'draw';
    reason = `达到最大回合数(${maxMoves})判和`;
  }

  return {
    winner,
    reason,
    totalMoves: engine.getMoves().length,
    illegalAttempts,
    llmColor: 'both',
    finalFen: engine.toFen(),
    moves: engine.getMoves(),
  };
}

// ── 评估模式 ─────────────────────────────────────────────────────────

async function evalSelfPlay(args: CliArgs): Promise<void> {
  console.log(`\n========== LLM 自我对弈 (${args.games} 局) ==========\n`);
  const llm = makeLLMPlayer();
  let totalMoves = 0;
  let totalIllegal = 0;

  for (let i = 0; i < args.games; i++) {
    console.log(`--- 第 ${i + 1} 局 ---`);
    const result = await playGame(llm, llm, args.maxMoves, args.retries, ['red', 'black']);
    totalMoves += result.totalMoves;
    totalIllegal += result.illegalAttempts;
    console.log(`  结果: ${result.reason}, 回合数: ${result.totalMoves}, 非法次数: ${result.illegalAttempts}`);
    console.log(`  终局 FEN: ${result.finalFen.slice(0, 60)}...\n`);
  }

  console.log(`========== 自我对弈汇总 ==========`);
  console.log(`  平均回合数: ${(totalMoves / args.games).toFixed(1)}`);
  console.log(`  总非法走法次数: ${totalIllegal} (平均 ${(totalIllegal / args.games).toFixed(1)} 次/局)`);
  console.log(`  质量指标: 非法率越低、回合数越多（接近完整对局），LLM 水平越稳定\n`);
}

async function evalVsLocal(args: CliArgs): Promise<void> {
  console.log(`\n========== LLM vs LocalAI(d=${args.depth}) (${args.games} 局) ==========\n`);
  let llmWins = 0;
  let localWins = 0;
  let draws = 0;
  let llmIllegal = 0;
  let totalMoves = 0;

  for (let i = 0; i < args.games; i++) {
    // 交替先后手，避免先手优势干扰
    const llmColor: PieceColor = i % 2 === 0 ? 'red' : 'black';
    const llm = makeLLMPlayer();
    const local = makeLocalPlayer(args.depth);
    const red = llmColor === 'red' ? llm : local;
    const black = llmColor === 'red' ? local : llm;
    console.log(`--- 第 ${i + 1} 局 (LLM 执${llmColor === 'red' ? '红' : '黑'}) ---`);

    const result = await playGame(red, black, args.maxMoves, args.retries, [llmColor]);
    totalMoves += result.totalMoves;
    llmIllegal += result.illegalAttempts;

    let llmResult: 'win' | 'loss' | 'draw';
    if (result.winner === 'draw') {
      draws++;
      llmResult = 'draw';
    } else if (result.winner === llmColor) {
      llmWins++;
      llmResult = 'win';
    } else {
      localWins++;
      llmResult = 'loss';
    }
    console.log(`  结果: ${result.reason} → LLM ${llmResult} | 回合数: ${result.totalMoves} | LLM非法: ${result.illegalAttempts}\n`);
  }

  console.log(`========== LLM vs LocalAI 汇总 ==========`);
  console.log(`  LLM 胜: ${llmWins}  负: ${localWins}  和: ${draws}  (共 ${args.games} 局)`);
  console.log(`  LLM 胜率: ${((llmWins + draws * 0.5) / args.games * 100).toFixed(1)}% (和棋计0.5胜)`);
  console.log(`  LLM 总非法走法: ${llmIllegal}, 平均回合数: ${(totalMoves / args.games).toFixed(1)}\n`);
}

async function evalLegality(args: CliArgs): Promise<void> {
  console.log(`\n========== LLM 走法合法性测试 (${args.games} 局) ==========\n`);
  const llm = makeLLMPlayer();
  let totalSteps = 0;
  let totalIllegal = 0;

  for (let i = 0; i < args.games; i++) {
    console.log(`--- 第 ${i + 1} 局 ---`);
    const result = await playGame(llm, llm, args.maxMoves, args.retries, ['red', 'black']);
    totalSteps += result.totalMoves;
    totalIllegal += result.illegalAttempts;
    console.log(`  完成 ${result.totalMoves} 步, 非法尝试 ${result.illegalAttempts} 次, 结果: ${result.reason}\n`);
  }

  const illegalRate = totalSteps + totalIllegal > 0
    ? (totalIllegal / (totalSteps + totalIllegal) * 100).toFixed(2)
    : '0.00';
  console.log(`========== 合法性汇总 ==========`);
  console.log(`  总成功走法: ${totalSteps}, 总非法尝试: ${totalIllegal}`);
  console.log(`  非法走法率: ${illegalRate}% (目标: < 10%)\n`);
}

// ── 主入口 ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`评估配置: mode=${args.mode}, games=${args.games}, maxMoves=${args.maxMoves}, retries=${args.retries}`);

  try {
    switch (args.mode) {
      case 'self-play': await evalSelfPlay(args); break;
      case 'vs-local': await evalVsLocal(args); break;
      case 'legality': await evalLegality(args); break;
      default:
        console.error(`未知模式: ${args.mode}`);
        process.exit(1);
    }
  } catch (err) {
    console.error('\n评估失败:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

void main();
