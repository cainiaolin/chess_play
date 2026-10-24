// pikafish-engine 协议层单元测试：info/bestmove 解析、难度映射、候选选择、串行队列
// 不依赖真实引擎二进制（进程交互用假 spawnFn 模拟）。
import { describe, it, expect } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  parseInfoLine,
  parseBestMove,
  pickMoveFromCandidates,
  difficultyToProfile,
  PikafishEngine,
  MpvInfo
} from '../src/services/pikafish-engine';

describe('parseInfoLine', () => {
  it('should_parse_score_cp_and_pv_when_normal_info_line', () => {
    const info = parseInfoLine('info depth 20 seldepth 22 multipv 2 score cp -35 nodes 123 nps 456 time 78 pv h2e2 h9g7');
    expect(info).not.toBeNull();
    expect(info!.multipv).toBe(2);
    expect(info!.depth).toBe(20);
    expect(info!.scoreCp).toBe(-35);
    expect(info!.pv).toEqual(['h2e2', 'h9g7']);
  });

  it('should_parse_score_mate_when_mate_line', () => {
    const info = parseInfoLine('info depth 245 seldepth 2 multipv 1 score mate 1 nodes 5400 time 4 pv b4b9');
    expect(info!.scoreMate).toBe(1);
    expect(info!.scoreCp).toBeUndefined();
  });

  it('should_default_multipv_to_1_when_token_missing', () => {
    const info = parseInfoLine('info depth 10 score cp 50 pv a0a1');
    expect(info!.multipv).toBe(1);
  });

  it('should_return_null_when_line_has_no_pv', () => {
    expect(parseInfoLine('info depth 5 score cp 10')).toBeNull();
  });

  it('should_return_null_when_line_is_not_info', () => {
    expect(parseInfoLine('uciok')).toBeNull();
    expect(parseInfoLine('bestmove b4b9')).toBeNull();
  });

  it('should_return_null_when_score_is_bound_estimate', () => {
    // lowerbound/upperbound 是搜索中间估计，不可作为选择依据
    expect(parseInfoLine('info depth 25 score cp 12 lowerbound pv a4a5')).toBeNull();
  });

  it('should_return_null_when_pv_empty_after_filtering', () => {
    expect(parseInfoLine('info depth 3 score cp 5 pv xyz')).toBeNull();
  });
});

describe('parseBestMove', () => {
  it('should_parse_move_when_bestmove_line', () => {
    expect(parseBestMove('bestmove b4b9')).toBe('b4b9');
    expect(parseBestMove('bestmove a4e4 ponder h9g7')).toBe('a4e4');
  });

  it('should_return_null_when_other_line', () => {
    expect(parseBestMove('info depth 1 pv a0a1')).toBeNull();
    expect(parseBestMove('readyok')).toBeNull();
  });
});

describe('difficultyToProfile', () => {
  it('should_return_full_strength_when_level_5', () => {
    const p = difficultyToProfile(5);
    expect(p.multiPv).toBe(1);
    expect(p.weights).toEqual([]);
    expect(p.moveTimeMs).toBeGreaterThanOrEqual(5000);
  });

  it('should_return_weakened_profile_when_level_1', () => {
    const p = difficultyToProfile(1);
    expect(p.multiPv).toBe(4);
    expect(p.weights.length).toBe(4);
    expect(p.weights[0]).toBeLessThan(1); // 最佳走法不是 100%
  });

  it('should_increase_move_time_when_level_higher', () => {
    expect(difficultyToProfile(2).moveTimeMs).toBeGreaterThan(difficultyToProfile(1).moveTimeMs);
    expect(difficultyToProfile(4).moveTimeMs).toBeGreaterThan(difficultyToProfile(3).moveTimeMs);
  });

  it('should_clamp_when_level_out_of_range', () => {
    expect(difficultyToProfile(0)).toEqual(difficultyToProfile(1));
    expect(difficultyToProfile(9)).toEqual(difficultyToProfile(5));
  });
});

describe('pickMoveFromCandidates', () => {
  const cand = (multipv: number, scoreCp: number): MpvInfo => ({
    multipv, depth: 10, scoreCp, pv: [`a${multipv}a${multipv}`, 'b0b1']
  });

  it('should_throw_when_no_candidates', () => {
    expect(() => pickMoveFromCandidates([], [])).toThrow();
  });

  it('should_always_pick_best_when_near_mate', () => {
    const mate1: MpvInfo = { multipv: 1, depth: 20, scoreMate: 1, pv: ['b4b9'] };
    const other: MpvInfo = { multipv: 2, depth: 20, scoreCp: 300, pv: ['a0a1'] };
    // 即使权重全押在次优，一步杀必须抓住
    expect(pickMoveFromCandidates([mate1, other], [0, 1]).pv[0]).toBe('b4b9');
  });

  it('should_pick_second_when_all_weight_on_it', () => {
    const c1 = cand(1, 50);
    const c2 = cand(2, 10);
    expect(pickMoveFromCandidates([c1, c2], [0, 1]).multipv).toBe(2);
  });

  it('should_pick_first_when_all_weight_on_it', () => {
    const c1 = cand(1, 50);
    const c2 = cand(2, 10);
    expect(pickMoveFromCandidates([c1, c2], [1, 0]).multipv).toBe(1);
  });

  it('should_fall_back_to_best_when_candidates_fewer_than_weights', () => {
    // 残局只有 1 个候选时无论权重如何都走它
    const c1 = cand(1, 50);
    expect(pickMoveFromCandidates([c1], [0.1, 0.9]).multipv).toBe(1);
  });

  it('should_handle_unsorted_candidates', () => {
    const c2 = cand(2, 10);
    const c1 = cand(1, 50);
    expect(pickMoveFromCandidates([c2, c1], [1, 0]).multipv).toBe(1);
  });
});

describe('PikafishEngine 串行队列（假引擎进程）', () => {
  /** 模拟 UCI 引擎：可编程地对 stdin 命令产生 stdout 响应 */
  function createFakeSpawn(scripts: Record<string, string[]>) {
    const calls: string[] = [];
    const fakeSpawn = (): any => {
      const proc = new EventEmitter() as any;
      proc.stdin = new PassThrough();
      proc.stdout = new PassThrough();
      proc.stderr = new PassThrough();
      proc.kill = () => undefined;
      proc.stdin.on('data', (chunk: Buffer) => {
        const commands = chunk.toString().split('\n').filter(Boolean);
        for (const cmd of commands) {
          calls.push(cmd);
          const responses = scripts[cmd.split(' ')[0]] ?? [];
          const exact = scripts[cmd];
          for (const line of exact ?? responses) {
            proc.stdout.write(`${line}\n`);
          }
        }
      });
      return proc;
    };
      return { fakeSpawn, calls };
  }

  const UCI_SCRIPT = {
    uci: ['id name fake', 'uciok'],
    isready: ['readyok'],
    position: [],
    go: [
      'info depth 10 multipv 1 score cp 30 pv h2e2 h9g7',
      'bestmove h2e2 ponder h9g7'
    ]
  };

  it('should_return_selected_move_when_analyze_initial_position', async () => {
    const { fakeSpawn } = createFakeSpawn(UCI_SCRIPT);
    const engine = new PikafishEngine(fakeSpawn as any);
    const info = await engine.analyze('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1', { moveTimeMs: 100 });
    expect(info.bestmoveUci).toBe('h2e2');
    // h2 = (7,7)，e2 = (4,7)：坐标换算必须正确
    expect(info.bestmove.from).toEqual({ x: 7, y: 7 });
    expect(info.bestmove.to).toEqual({ x: 4, y: 7 });
    expect(info.scoreCp).toBe(30);
    expect(info.pv).toEqual(['h2e2', 'h9g7']);
    await engine.shutdown();
  });

  it('should_serialize_when_two_analyze_calls_concurrent', async () => {
    // go 的响应延迟发出：若引擎未串行处理，第二个请求的 go 会插进第一个搜索
    const { fakeSpawn, calls } = createFakeSpawn(UCI_SCRIPT);
    const engine = new PikafishEngine(fakeSpawn as any);
    const p1 = engine.analyze('fen1', { moveTimeMs: 50 });
    const p2 = engine.analyze('fen2', { moveTimeMs: 50 });
    await Promise.all([p1, p2]);
    const goPositions = calls.map((c, i) => ({ c, i }))
      .filter(({ c }) => c.startsWith('go'))
      .map(({ i }) => calls.lastIndexOf('position fen fen1') < calls.lastIndexOf('position fen fen2')
        ? (i < calls.lastIndexOf('position fen fen2') ? 0 : 1)
        : (i < calls.lastIndexOf('position fen fen1') ? 1 : 0));
    // 两次 go 分别落在各自 position 之后，不交叉
    expect(goPositions).toContain(0);
    expect(goPositions).toContain(1);
    await engine.shutdown();
  });

  it('should_reject_when_engine_reports_critical_error', async () => {
    const { fakeSpawn } = createFakeSpawn({
      uci: ['uciok'],
      isready: ['readyok'],
      position: ['info string CRITICAL ERROR: Command `position fen bad` failed. Reason: Invalid FEN.'],
      go: []
    });
    const engine = new PikafishEngine(fakeSpawn as any);
    await expect(engine.analyze('bad', { moveTimeMs: 50 })).rejects.toThrow('引擎拒绝局面');
    await engine.shutdown();
  });
});
