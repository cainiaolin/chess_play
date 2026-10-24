// Pikafish（Stockfish 中国象棋分支）UCI 客户端
// 通过子进程常驻运行引擎，串行处理分析请求，为"引擎模式"提供超人类棋力。
//
// 实测约束（Pikafish 2026-09-06）：
// - 不支持 UCI_LimitStrength/UCI_Elo，难度分级改用 MultiPV + 次优走法加权选择
// - NNUE 权重(pikafish.nnue)必须与 exe 同目录，否则引擎启动即退出
// - 格式错误会输出 "info string CRITICAL ERROR"（进程可能继续存活但请求无结果）
import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Position } from '../types/chess';
import { parseUciMove } from './xiangqi-notation';

/** 单条 MultiPV 候选信息（来自 info 行） */
export interface MpvInfo {
  multipv: number;        // 第几好（1 = 最佳）
  depth: number;
  scoreCp?: number;       // 厘兵分（行棋方视角）
  scoreMate?: number;     // 正 = 行棋方 N 步杀；负 = 被杀
  pv: string[];           // 主变（UCI 走法序列）
}

/** analyze 的最终结果：已按难度策略选定要走的着法 */
export interface EngineSearchInfo {
  bestmove: { from: Position; to: Position };
  bestmoveUci: string;
  depth?: number;
  scoreCp?: number;
  scoreMate?: number;
  pv: string[];
  nodes?: number;
  timeMs?: number;
}

export interface EngineMoveOptions {
  moveTimeMs: number;
  /** >1 时启用 MultiPV 候选池（配合 weights 做难度） */
  multiPv?: number;
  /** 候选权重（优→差），缺省 [1] 表示永远走最佳 */
  weights?: number[];
}

/** 引擎不可用（二进制缺失/进程无法启动/崩溃）。message 含中文下载指引。 */
export class EngineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineUnavailableError';
  }
}

export const ENGINE_DOWNLOAD_HINT =
  'Pikafish 引擎未安装或无法启动：请在 server 目录运行 node scripts/download-pikafish.mjs 下载（或设置 ENGINE_PATH 环境变量指向引擎二进制）';

// ---------------------------------------------------------------------------
// UCI 文本协议解析（纯函数，导出供单元测试）
// ---------------------------------------------------------------------------

/**
 * 解析一条 info 行为 MultiPV 候选信息
 * 例: "info depth 20 seldepth 22 multipv 2 score cp -35 nodes 123 pv h2e2 h9g7"
 * 无 pv 或非 info 行返回 null；score 带 lowerbound/upperbound 时不可靠，忽略该行。
 */
export function parseInfoLine(line: string): MpvInfo | null {
  if (!line.startsWith('info ') || !line.includes(' pv ')) {
    return null;
  }
  if (line.includes('lowerbound') || line.includes('upperbound')) {
    return null;
  }
  const tokens = line.split(/\s+/);
  const info: MpvInfo = { multipv: 1, depth: 0, pv: [] };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'depth') {
      info.depth = Number(tokens[i + 1]);
    } else if (t === 'multipv') {
      info.multipv = Number(tokens[i + 1]);
    } else if (t === 'score') {
      if (tokens[i + 1] === 'cp') {
        info.scoreCp = Number(tokens[i + 2]);
      } else if (tokens[i + 1] === 'mate') {
        info.scoreMate = Number(tokens[i + 2]);
      }
    } else if (t === 'pv') {
      info.pv = tokens.slice(i + 1).filter(m => /^[a-i][0-9][a-i][0-9]$/.test(m));
      break;
    }
  }
  if (info.pv.length === 0 || info.depth <= 0) {
    return null;
  }
  return info;
}

/** 解析 bestmove 行，返回 UCI 走法（如 "b4b9"）；非 bestmove 行返回 null */
export function parseBestMove(line: string): string | null {
  const match = line.match(/^bestmove\s+([a-i][0-9][a-i][0-9])/);
  return match ? match[1] : null;
}

/**
 * 从候选中按权重选着法（难度实现的核心）
 * - 最佳候选是 |mate| <= 2 的近杀时强制选它：一步杀/两步杀没有"手下留情"的理由，
 *   也保证集成测试的确定性
 * - 否则按 weights 轮盘赌（权重对应优→差）
 */
export function pickMoveFromCandidates(candidates: MpvInfo[], weights: number[]): MpvInfo {
  if (candidates.length === 0) {
    throw new Error('引擎未返回任何候选走法');
  }
  const sorted = [...candidates].sort((a, b) => a.multipv - b.multipv);
  const best = sorted[0];
  if (typeof best.scoreMate === 'number' && Math.abs(best.scoreMate) <= 2) {
    return best;
  }
  const w = weights.length > 0 ? weights : [1];
  // 可选候选数受限于引擎实际返回的数量（残局合法着法可能少于 MultiPV 设定）
  const usable = Math.min(sorted.length, w.length);
  const total = w.slice(0, usable).reduce((s, x) => s + x, 0);
  if (total <= 0) {
    return best;
  }
  let roll = Math.random() * total;
  for (let i = 0; i < usable; i++) {
    roll -= w[i];
    if (roll <= 0) {
      return sorted[i];
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 难度映射
// ---------------------------------------------------------------------------

export interface DifficultyProfile {
  moveTimeMs: number;
  multiPv: number;
  weights: number[];
}

/**
 * 难度 1-5 → 引擎参数
 * 此版 Pikafish 不支持 UCI_Elo，弱化 = 更短思考时间 + 按概率选择次优着法。
 * 难度 5 = 全强度：只用主 PV、永远最佳、思考时间最长（可用 PIKAFISH_MAX_MOVETIME_MS 覆盖）。
 */
export function difficultyToProfile(level: number): DifficultyProfile {
  const clamped = Math.min(5, Math.max(1, Math.round(level)));
  const maxMoveTime = Number(process.env.PIKAFISH_MAX_MOVETIME_MS) || 5000;
  const table: Record<number, DifficultyProfile> = {
    1: { moveTimeMs: 300, multiPv: 4, weights: [0.35, 0.30, 0.20, 0.15] },
    2: { moveTimeMs: 600, multiPv: 3, weights: [0.60, 0.25, 0.15] },
    3: { moveTimeMs: 1200, multiPv: 2, weights: [0.85, 0.15] },
    4: { moveTimeMs: 2500, multiPv: 2, weights: [0.97, 0.03] },
    5: { moveTimeMs: maxMoveTime, multiPv: 1, weights: [] }
  };
  return table[clamped];
}

// ---------------------------------------------------------------------------
// 引擎进程管理
// ---------------------------------------------------------------------------

type LineHandler = (line: string) => void;
type SpawnFn = typeof spawn;

export class PikafishEngine {
  private proc: ChildProcess | null = null;
  private procDead = false;
  private lineHandler: LineHandler | null = null;
  private stdoutBuffer = '';
  /** 串行队列：同一时刻最多一个 go 在执行 */
  private queue: Promise<unknown> = Promise.resolve();
  private lastMultiPv = 1;
  private startupPromise: Promise<void> | null = null;

  constructor(private spawnFn: SpawnFn = spawn) {}

  /** 引擎二进制是否就位（同步检查，供创建对局时快速失败） */
  isBinaryPresent(): boolean {
    return existsSync(this.resolveBinaryPath());
  }

  private resolveBinaryPath(): string {
    if (process.env.ENGINE_PATH) {
      return process.env.ENGINE_PATH;
    }
    // src/services -> ../../engines（ts-node/ts-jest/编译后 dist/services 均成立）
    return resolve(__dirname, '../../engines/pikafish.exe');
  }

  /**
   * 分析局面并返回选定走法
   * 请求在内部排队串行执行；进程缺失/崩溃抛 EngineUnavailableError。
   */
  analyze(fen: string, options: EngineMoveOptions): Promise<EngineSearchInfo> {
    const run = () => this.analyzeOnce(fen, options);
    const result = this.queue.then(run, run);
    // 队列吞掉失败，保证后续请求不被前一个失败卡死
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private analyzeOnce(fen: string, options: EngineMoveOptions): Promise<EngineSearchInfo> {
    return this.ensureStarted().then(() => this.runSearch(fen, options));
  }

  /** 懒启动 + UCI 握手；进程已死则重启 */
  private ensureStarted(): Promise<void> {
    if (this.proc && !this.procDead) {
      return Promise.resolve();
    }
    if (!this.isBinaryPresent()) {
      return Promise.reject(new EngineUnavailableError(ENGINE_DOWNLOAD_HINT));
    }
    if (!this.startupPromise) {
      this.startupPromise = this.startProcess();
      this.startupPromise.catch(() => {
        // 启动失败允许下次重试
        this.startupPromise = null;
      });
    }
    return this.startupPromise;
  }

  private startProcess(): Promise<void> {
    const bin = this.resolveBinaryPath();
    return new Promise<void>((resolvePromise, rejectPromise) => {
      let proc: ChildProcess;
      try {
        proc = this.spawnFn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      } catch (err) {
        rejectPromise(new EngineUnavailableError(`${ENGINE_DOWNLOAD_HINT}（启动失败: ${err instanceof Error ? err.message : err}）`));
        return;
      }
      this.proc = proc;
      this.procDead = false;
      this.lastMultiPv = 1;

      const fail = (reason: string): void => {
        this.procDead = true;
        this.startupPromise = null;
        rejectPromise(new EngineUnavailableError(`${ENGINE_DOWNLOAD_HINT}（${reason}）`));
      };

      proc.on('error', err => fail(`进程错误: ${err.message}`));
      proc.on('exit', () => {
        this.procDead = true;
        this.startupPromise = null;
      });

      const stdout = proc.stdout;
      const stderr = proc.stderr;
      if (!stdout || !proc.stdin || !stderr) {
        fail('无法建立进程管道');
        return;
      }
      stdout.setEncoding('utf8');
      stderr.setEncoding('utf8');
      // NNUE 加载失败等致命信息会打到 stderr 或 info string，握手阶段直接判失败
      stderr.on('data', (chunk: string) => {
        if (!this.procDead && chunk.includes('ERROR')) {
          fail(`引擎输出错误: ${chunk.trim().slice(0, 300)}`);
        }
      });
      stdout.on('data', (chunk: string) => this.onStdout(chunk, line => {
        if (line.startsWith('info string CRITICAL ERROR') || line.includes('was not loaded successfully')) {
          fail(`引擎输出错误: ${line.slice(0, 300)}`);
        }
      }));

      const handshake = (line: string): void => {
        if (line === 'uciok') {
          this.lineHandler = null;
          proc.stdin!.write('isready\n');
          this.lineHandler = (l: string) => {
            if (l === 'readyok') {
              this.lineHandler = null;
              resolvePromise();
            }
          };
        }
      };
      this.lineHandler = handshake;
      proc.stdin.write('uci\n');

      // 握手看门狗：15 秒内没完成视为引擎不可用
      setTimeout(() => {
        if (this.lineHandler === handshake || !proc.stdin) {
          this.killProcess();
          fail('UCI 握手超时');
        }
      }, 15000).unref();
    });
  }

  private runSearch(fen: string, options: EngineMoveOptions): Promise<EngineSearchInfo> {
    const proc = this.proc;
    const stdin = proc?.stdin;
    if (!proc || this.procDead || !stdin) {
      return Promise.reject(new EngineUnavailableError(`${ENGINE_DOWNLOAD_HINT}（引擎进程已退出）`));
    }

    const multiPv = options.multiPv && options.multiPv > 1 ? options.multiPv : 1;
    return new Promise<EngineSearchInfo>((resolvePromise, rejectPromise) => {
      // 按深度归组的候选：key = depth，保留最深一层的全部 multipv 行
      let bestDepth = 0;
      let candidates: MpvInfo[] = [];
      let finished = false;

      const onExit = (): void => {
        finish(new EngineUnavailableError(`${ENGINE_DOWNLOAD_HINT}（引擎进程在搜索中退出）`));
      };

      const finish = (err?: Error): void => {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(watchdog);
        this.lineHandler = null;
        proc.removeListener('exit', onExit);
        if (err) {
          rejectPromise(err);
        } else {
          resolvePromise(result);
        }
      };

      let result: EngineSearchInfo = {
        bestmove: { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
        bestmoveUci: '',
        pv: []
      };

      const watchdog = setTimeout(() => {
        this.killProcess();
        finish(new EngineUnavailableError(`${ENGINE_DOWNLOAD_HINT}（搜索超时被终止）`));
      }, options.moveTimeMs + 15000);

      this.lineHandler = (line: string) => {
        if (line.startsWith('info string CRITICAL ERROR')) {
          finish(new Error(`引擎拒绝局面: ${line.slice(0, 300)}`));
          return;
        }
        const info = parseInfoLine(line);
        if (info) {
          if (info.depth > bestDepth) {
            bestDepth = info.depth;
            candidates = [info];
          } else if (info.depth === bestDepth) {
            const existing = candidates.findIndex(c => c.multipv === info.multipv);
            if (existing >= 0) {
              candidates[existing] = info;
            } else {
              candidates.push(info);
            }
          }
          return;
        }
        const bestmoveUci = parseBestMove(line);
        if (bestmoveUci) {
          try {
            const chosen = pickMoveFromCandidates(candidates, options.weights ?? []);
            const { from, to } = parseUciMove(chosen.pv[0] ?? bestmoveUci);
            result = {
              bestmove: { from, to },
              bestmoveUci: chosen.pv[0] ?? bestmoveUci,
              depth: chosen.depth,
              scoreCp: chosen.scoreCp,
              scoreMate: chosen.scoreMate,
              pv: chosen.pv,
              nodes: undefined,
              timeMs: undefined
            };
            finish();
          } catch (err) {
            finish(err instanceof Error ? err : new Error(String(err)));
          }
        }
      };

      if (multiPv !== this.lastMultiPv) {
        stdin.write(`setoption name MultiPV value ${multiPv}\n`);
        this.lastMultiPv = multiPv;
      }
      stdin.write(`position fen ${fen}\n`);
      stdin.write(`go movetime ${options.moveTimeMs}\n`);

      proc.once('exit', onExit);
    });
  }

  private onStdout(chunk: string, fallback: LineHandler): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.replace(/\r$/, '');
      if (!trimmed) {
        continue;
      }
      const handler = this.lineHandler;
      if (handler) {
        handler(trimmed);
      } else if (this.proc && !this.procDead) {
        fallback(trimmed);
      }
    }
  }

  /** 停止引擎进程（服务退出时调用，防止孤儿进程） */
  async shutdown(): Promise<void> {
    const proc = this.proc;
    this.startupPromise = null;
    if (!proc) {
      return;
    }
    this.proc = null;
    await new Promise<void>(resolvePromise => {
      proc.once('exit', () => resolvePromise());
      try {
        proc.stdin?.write('quit\n');
      } catch {
        // stdin 已关闭则直接杀
      }
      setTimeout(() => {
        proc.kill();
        resolvePromise();
      }, 2000).unref();
    });
  }

  private killProcess(): void {
    const proc = this.proc;
    this.proc = null;
    this.procDead = true;
    this.startupPromise = null;
    try {
      proc?.kill();
    } catch {
      // 进程可能已退出
    }
  }
}

/** 模块级单例：整个服务共享一个引擎进程（对局天然串行，排队足够） */
export const pikafishEngine = new PikafishEngine();
