import { TimerMode, TimerState, GameOptions, GameEndReason } from '../types/chess';

/**
 * 计时器服务
 * 处理单步限时和总对局限时两种计时模式
 */
export class TimerService {
  private timerState: TimerState | null = null;
  private timerInterval: NodeJS.Timeout | null = null;
  private onTimeout: ((color: 'red' | 'black') => void) | null = null;
  private onTick: ((state: TimerState) => void) | null = null;

  /**
   * 初始化计时器
   */
  initialize(options: GameOptions, currentTurn: 'red' | 'black'): TimerState {
    const now = Date.now();

    if (options.timerMode === 'per_move' && options.moveTimeLimit) {
      // 单步限时模式
      this.timerState = {
        mode: 'per_move',
        redTimeRemaining: options.moveTimeLimit,
        blackTimeRemaining: options.moveTimeLimit,
        currentMoveStartTime: now,
        lastUpdateTime: now
      };
    } else if (options.timerMode === 'total_time') {
      // 总对局限时模式
      this.timerState = {
        mode: 'total_time',
        redTimeRemaining: options.redTimeLimit || 600, // 默认10分钟
        blackTimeRemaining: options.blackTimeLimit || 600,
        currentMoveStartTime: now,
        lastUpdateTime: now
      };
    } else {
      // 无计时模式
      this.timerState = {
        mode: 'per_move',
        redTimeRemaining: Infinity,
        blackTimeRemaining: Infinity,
        currentMoveStartTime: now,
        lastUpdateTime: now
      };
    }

    return this.timerState;
  }

  /**
   * 启动计时器
   */
  start(
    onTimeout: (color: 'red' | 'black') => void,
    onTick: (state: TimerState) => void
  ): void {
    this.onTimeout = onTimeout;
    this.onTick = onTick;

    // 每秒更新一次
    this.timerInterval = setInterval(() => {
      this.tick();
    }, 100);
  }

  /**
   * 停止计时器
   */
  stop(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * 计时器tick
   */
  private tick(): void {
    if (!this.timerState) return;

    const now = Date.now();
    const elapsed = (now - this.timerState.lastUpdateTime) / 1000;
    this.timerState.lastUpdateTime = now;

    // 更新当前玩家的剩余时间
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer === 'red') {
      this.timerState.redTimeRemaining -= elapsed;
    } else {
      this.timerState.blackTimeRemaining -= elapsed;
    }

    // 检查是否超时
    if (this.timerState.redTimeRemaining <= 0) {
      this.stop();
      if (this.onTimeout) this.onTimeout('red');
    } else if (this.timerState.blackTimeRemaining <= 0) {
      this.stop();
      if (this.onTimeout) this.onTimeout('black');
    }

    // 触发tick回调
    if (this.onTick) {
      this.onTick({ ...this.timerState });
    }
  }

  /**
   * 切换回合（开始新的计时周期）
   */
  switchTurn(newTurn: 'red' | 'black'): void {
    if (!this.timerState) return;

    const now = Date.now();
    this.timerState.currentMoveStartTime = now;
    this.timerState.lastUpdateTime = now;
  }

  /**
   * 暂停计时器
   */
  pause(): void {
    if (!this.timerState) return;
    this.stop();
  }

  /**
   * 恢复计时器
   */
  resume(
    onTimeout: (color: 'red' | 'black') => void,
    onTick: (state: TimerState) => void
  ): void {
    if (!this.timerState) return;

    // 重置开始时间，避免暂停期间的时间被计入
    const now = Date.now();
    this.timerState.lastUpdateTime = now;

    this.start(onTimeout, onTick);
  }

  /**
   * 获取当前计时器状态
   */
  getState(): TimerState | null {
    return this.timerState ? { ...this.timerState } : null;
  }

  /**
   * 获取当前玩家的剩余时间
   */
  getTimeRemaining(color: 'red' | 'black'): number {
    if (!this.timerState) return Infinity;
    return color === 'red' ? this.timerState.redTimeRemaining : this.timerState.blackTimeRemaining;
  }

  /**
   * 检查是否进入最后10秒
   */
  isLastTenSeconds(color: 'red' | 'black'): boolean {
    const remaining = this.getTimeRemaining(color);
    return remaining > 0 && remaining <= 10;
  }

  /**
   * 获取当前玩家（通过时间戳判断）
   */
  private getCurrentPlayer(): 'red' | 'black' {
    // 这个方法需要外部传入当前回合信息
    // 实际使用时，GameService会传入正确的turn
    return 'red';
  }

  /**
   * 清理计时器
   */
  destroy(): void {
    this.stop();
    this.timerState = null;
    this.onTimeout = null;
    this.onTick = null;
  }
}
