// 棋力自证脚本（手动运行，不进 CI）：验证难度机制的有效性
//   npx tsx scripts/strength-check.ts [games]
// 对局 1：引擎难度 1 vs 随机合法走法方 —— 强 AI 应碾压随机方
// 对局 2：引擎难度 5（短时全强度）vs 难度 1 —— 全强度应显著占优
import { ChessEngine } from '../src/services/chess-engine';
import { pikafishEngine, difficultyToProfile } from '../src/services/pikafish-engine';
import { Position } from '../src/types/chess';

interface SideConfig {
  name: string;
  /** 引擎参数；undefined = 随机合法走法 */
  options?: { moveTimeMs: number; multiPv?: number; weights?: number[] };
}

/** 枚举全部合法走法并随机取一（随机方基线） */
function randomMove(engine: ChessEngine): { from: Position; to: Position } {
  const moves: Array<{ from: Position; to: Position }> = [];
  const board = engine.getBoard();
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];
      if (!piece || piece.color !== engine.getTurn()) continue;
      for (let ty = 0; ty < 10; ty++) {
        for (let tx = 0; tx < 9; tx++) {
          if (engine.validateMove({ x, y }, { x: tx, y: ty }).valid) {
            moves.push({ from: { x, y }, to: { x: tx, y: ty } });
          }
        }
      }
    }
  }
  if (moves.length === 0) {
    throw new Error('无合法走法（终局）');
  }
  return moves[Math.floor(Math.random() * moves.length)];
}

async function playGame(red: SideConfig, black: SideConfig, maxHalfMoves: number): Promise<'red' | 'black' | 'draw'> {
  const engine = new ChessEngine();
  for (let half = 0; half < maxHalfMoves; half++) {
    if (engine.getStatus() !== 'playing') {
      break;
    }
    const side = engine.getTurn() === 'red' ? red : black;
    let move: { from: Position; to: Position };
    if (side.options) {
      const info = await pikafishEngine.analyze(engine.toFen(), side.options);
      move = info.bestmove;
    } else {
      move = randomMove(engine);
    }
    engine.makeMove(move.from, move.to);
  }
  const status = engine.getStatus();
  if (status === 'red_win') return 'red';
  if (status === 'black_win') return 'black';
  return 'draw';
}

async function match(title: string, red: SideConfig, black: SideConfig, games: number): Promise<void> {
  const score = { red: 0, black: 0, draw: 0 };
  for (let i = 0; i < games; i++) {
    // 交替先后手，抵消先手优势
    const result = i % 2 === 0
      ? await playGame(red, black, 250)
      : await playGame(black, red, 250).then(r => (r === 'red' ? 'black' : r === 'black' ? 'red' : 'draw') as 'red' | 'black' | 'draw');
    score[result]++;
    process.stdout.write(`  第 ${i + 1}/${games} 局: ${result === 'draw' ? '和' : result + ' 胜'}  [红${score.red} 黑${score.black} 和${score.draw}]\n`);
  }
  console.log(`${title}: 红(=第一方) ${score.red} 胜 / 对方 ${score.black} 胜 / 和 ${score.draw}`);
}

async function main() {
  const games = Number(process.argv[2]) || 6;
  const d1 = difficultyToProfile(1);
  const d5 = difficultyToProfile(5);

  console.log(`棋力自证：每边 ${games} 局，交替先手\n`);
  await match(
    '难度1(弱化) vs 随机走法',
    { name: '难度1', options: { moveTimeMs: d1.moveTimeMs, multiPv: d1.multiPv, weights: d1.weights } },
    { name: '随机' },
    games
  );
  await match(
    '难度5(全强度800ms) vs 难度1(300ms)',
    { name: '难度5', options: { moveTimeMs: 800 } },
    { name: '难度1', options: { moveTimeMs: d1.moveTimeMs, multiPv: d1.multiPv, weights: d1.weights } },
    games
  );

  await pikafishEngine.shutdown();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
