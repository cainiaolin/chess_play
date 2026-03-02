const app = getApp();

// 速度配置（毫秒）
const SPEED_CONFIG = {
  slow: 5000,
  normal: 2000,
  fast: 500
};

Page({
  data: {
    // 设置状态
    redModelIndex: 0,
    blackModelIndex: 1,
    aiModels: ['GPT-4', 'DeepSeek', '文心一言'],
    speed: 'normal',
    isStarting: false,

    // 游戏状态
    gameStarted: false,
    isPaused: false,
    isThinking: false,
    moveCount: 0,
    currentTurnModel: '',

    // 游戏状态
    gameState: {
      board: [],
      turn: 'red',
      status: 'playing',
      moves: [],
      lastMove: null
    },

    // 定时器
    moveTimer: null as number | null,

    // 游戏ID
    gameId: null as string | null
  },

  onLoad() {
    // 从存储中恢复上次的选择
    this.loadSettings();
  },

  onUnload() {
    // 清理定时器
    this.clearMoveTimer();
  },

  /**
   * 加载设置
   */
  loadSettings() {
    try {
      const settings = wx.getStorageSync('spectate_settings');
      if (settings) {
        this.setData({
          redModelIndex: settings.redModelIndex || 0,
          blackModelIndex: settings.blackModelIndex || 1,
          speed: settings.speed || 'normal'
        });
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  },

  /**
   * 保存设置
   */
  saveSettings() {
    try {
      wx.setStorageSync('spectate_settings', {
        redModelIndex: this.data.redModelIndex,
        blackModelIndex: this.data.blackModelIndex,
        speed: this.data.speed
      });
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  },

  /**
   * 选择红方模型
   */
  onRedModelChange(e: any) {
    const modelIndex = e.detail.value;
    this.setData({ redModelIndex: modelIndex });
    this.saveSettings();
  },

  /**
   * 选择黑方模型
   */
  onBlackModelChange(e: any) {
    const modelIndex = e.detail.value;
    this.setData({ blackModelIndex: modelIndex });
    this.saveSettings();
  },

  /**
   * 选择速度
   */
  onSpeedSelect(e: any) {
    const speed = e.currentTarget.dataset.speed;
    this.setData({ speed });
    this.saveSettings();
  },

  /**
   * 开始游戏
   */
  async onStartGame() {
    if (this.data.isStarting) return;

    this.setData({ isStarting: true });

    // 映射模型名称到API ID
    const modelMap: Record<number, string> = { 0: 'openai', 1: 'deepseek', 2: 'qiwens' };

    try {
      // 创建游戏
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/game/create`,
        method: 'POST',
        data: {
          redPlayer: { type: 'ai', model: modelMap[this.data.redModelIndex] },
          blackPlayer: { type: 'ai', model: modelMap[this.data.blackModelIndex] }
        }
      });

      if (res.statusCode === 200 && res.data) {
        this.setData({
          gameId: res.data.id,
          gameState: res.data,
          gameStarted: true,
          moveCount: 0,
          isPaused: false
        });

        // 开始自动对弈
        this.startAutoPlay();
      } else {
        wx.showToast({ title: '创建游戏失败', icon: 'error' });
      }
    } catch (error) {
      console.error('创建游戏失败:', error);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ isStarting: false });
    }
  },

  /**
   * 开始自动对弈
   */
  startAutoPlay() {
    this.clearMoveTimer();

    const updateTurn = async () => {
      if (this.data.isPaused) {
        this.scheduleNextMove();
        return;
      }

      const { gameState, gameId } = this.data;
      if (gameState.status !== 'playing' || !gameId) {
        this.clearMoveTimer();
        return;
      }

      // 更新当前回合的模型名称
      const currentTurnModel = gameState.turn === 'red'
        ? this.data.aiModels[this.data.redModelIndex]
        : this.data.aiModels[this.data.blackModelIndex];
      this.setData({ isThinking: true, currentTurnModel });

      try {
        // 等待指定时间（模拟AI思考）
        await this.sleep(SPEED_CONFIG[this.data.speed as keyof typeof SPEED_CONFIG]);

        // 获取游戏状态（检查是否有AI已经走棋）
        const stateRes = await wx.request({
          url: `${app.globalData.serverUrl}/api/game/${gameId}`,
          method: 'GET'
        });

        if (stateRes.statusCode === 200 && stateRes.data) {
          const newGameState = stateRes.data;
          const moveCount = newGameState.moves.length;

          this.setData({
            gameState: newGameState,
            moveCount,
            isThinking: false
          });

          // 检查游戏是否结束
          if (newGameState.status !== 'playing') {
            this.clearMoveTimer();
            this.showGameEnd(newGameState.status);
            return;
          }

          // 继续下一步
          this.scheduleNextMove();
        }
      } catch (error) {
        console.error('获取游戏状态失败:', error);
        this.setData({ isThinking: false });
        this.scheduleNextMove();
      }
    };

    // 立即开始第一步
    updateTurn();
  },

  /**
   * 安排下一步走棋
   */
  scheduleNextMove() {
    this.clearMoveTimer();
    this.setData({
      moveTimer: setTimeout(() => {
        this.startAutoPlay();
      }, SPEED_CONFIG[this.data.speed as keyof typeof SPEED_CONFIG]) as unknown as number
    });
  },

  /**
   * 清除走棋定时器
   */
  clearMoveTimer() {
    if (this.data.moveTimer) {
      clearTimeout(this.data.moveTimer);
      this.setData({ moveTimer: null });
    }
  },

  /**
   * 切换暂停状态
   */
  onTogglePause() {
    const isPaused = !this.data.isPaused;
    this.setData({ isPaused });

    wx.showToast({
      title: isPaused ? '已暂停' : '继续观战',
      icon: 'none'
    });
  },

  /**
   * 重新开始
   */
  onRestart() {
    wx.showModal({
      title: '重新开始',
      content: '确定要重新开始观战吗？',
      success: (res) => {
        if (res.confirm) {
          this.clearMoveTimer();
          this.setData({
            gameStarted: false,
            gameState: {
              board: [],
              turn: 'red',
              status: 'playing',
              moves: [],
              lastMove: null
            },
            moveCount: 0,
            isPaused: false,
            isThinking: false
          });
        }
      }
    });
  },

  /**
   * 退出观战
   */
  onExit() {
    this.clearMoveTimer();
    wx.navigateBack();
  },

  /**
   * 显示游戏结束
   */
  showGameEnd(status: string) {
    const redModel = this.data.aiModels[this.data.redModelIndex];
    const blackModel = this.data.aiModels[this.data.blackModelIndex];

    const messages: Record<string, string> = {
      'red_win': `${redModel} 获胜！`,
      'black_win': `${blackModel} 获胜！`,
      'draw': '双方和棋！'
    };

    wx.showModal({
      title: '对弈结束',
      content: messages[status] || '对弈结束',
      showCancel: false,
      confirmText: '重新观战',
      success: () => {
        this.clearMoveTimer();
        this.setData({
          gameStarted: false,
          gameState: {
            board: [],
            turn: 'red',
            status: 'playing',
            moves: [],
            lastMove: null
          },
          moveCount: 0
        });
      }
    });
  },

  /**
   * 延迟函数
   */
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
