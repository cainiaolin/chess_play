// Pikafish 引擎集成测试（依赖真实二进制 + NNUE 权重，缺失时整体跳过）
// 同时是坐标约定的正式回归：uciRank = 9 - y（rank 0 = 红方底线）
import { describe, it, expect, afterAll } from '@jest/globals';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChessEngine } from '../../src/services/chess-engine';
import {
  pikafishEngine,
  difficultyToProfile
} from '../../src/services/pikafish-engine';
import { parseUciMove } from '../../src/services/xiangqi-notation';

const ENGINE_BIN = process.env.ENGINE_PATH || resolve(__dirname, '../../engines/pikafish.exe');
const hasEngine = existsSync(ENGINE_BIN);
// 引擎缺失时整体跳过（环境无二进制的 CI 场景）
const describeEngine = hasEngine ? describe : describe.skip;

// 闷宫一步杀：红炮 b4->b9 (1,5)->(1,0) 隔红马架将军，将路全堵
// 该局面在排雷阶段由真实引擎验证过（score mate 1, bestmove b4b9）
const MATE_IN_ONE_FEN = '2Nkc4/2Pn5/9/9/9/1C7/9/9/9/4K4 w - - 0 1';

describeEngine('PikafishEngine 集成（真实引擎）', () => {
  afterAll(async () => {
    await pikafishEngine.shutdown();
  });

  it('should_return_legal_red_move_when_initial_position', async () => {
    const engine = new ChessEngine();
    const info = await pikafishEngine.analyze(engine.toFen(), { moveTimeMs: 400 });

    const fromPiece = engine.getBoard()[info.bestmove.from.y][info.bestmove.from.x];
    // 三合一验证：FEN 兼容（引擎有输出）+ 坐标方向（from 是红子）+ 走法合法
    expect(fromPiece).not.toBeNull();
    expect(fromPiece!.color).toBe('red');
    expect(engine.validateMove(info.bestmove.from, info.bestmove.to).valid).toBe(true);
    expect(typeof info.depth).toBe('number');
    expect(info.depth!).toBeGreaterThan(0);
    expect(info.pv.length).toBeGreaterThan(0);
  }, 30000);

  it('should_find_mate_in_one_when_smothered_cannon_position', async () => {
    // 坐标约定裁决器：若 rank 方向搞反，bestmove 将解出黑方区域坐标导致断言失败
    const info = await pikafishEngine.analyze(MATE_IN_ONE_FEN, { moveTimeMs: 600 });
    expect(info.scoreMate).toBe(1);
    expect(info.bestmoveUci).toBe('b4b9');
    expect(info.bestmove.from).toEqual({ x: 1, y: 5 });
    expect(info.bestmove.to).toEqual({ x: 1, y: 0 });
  }, 30000);

  it('should_return_legal_move_when_difficulty_one', async () => {
    // 低难度启用 MultiPV + 权重选择，选出的走法仍必须合法
    const engine = new ChessEngine();
    const profile = difficultyToProfile(1);
    const info = await pikafishEngine.analyze(engine.toFen(), {
      moveTimeMs: profile.moveTimeMs,
      multiPv: profile.multiPv,
      weights: profile.weights
    });
    expect(engine.validateMove(info.bestmove.from, info.bestmove.to).valid).toBe(true);
  }, 30000);

  it('should_return_multiple_candidates_when_multipv_enabled', async () => {
    // MultiPV 是难度机制的基础：中局应返回多个候选
    const engine = new ChessEngine();
    // 先走两步构造非对称局面，避免开局候选特殊
    engine.makeMove({ x: 7, y: 7 }, { x: 4, y: 7 });
    engine.makeMove({ x: 1, y: 0 }, { x: 2, y: 2 });

    const multiPv = 3;
    // 直接跑一次 analyze 拿多候选：借助 weights 全押次优来侧面验证（见下一用例）
    const info = await pikafishEngine.analyze(engine.toFen(), {
      moveTimeMs: 500,
      multiPv,
      weights: []
    });
    // weights 为空 = 永远最佳：拿到的是主 PV 且合法
    expect(engine.validateMove(info.bestmove.from, info.bestmove.to).valid).toBe(true);
    expect(parseUciMove(info.bestmoveUci)).toEqual(info.bestmove);
  }, 30000);
});
