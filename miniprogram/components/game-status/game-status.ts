// 游戏状态类型
type GameStatusType = 'playing' | 'red_win' | 'black_win' | 'draw';
type TurnType = 'red' | 'black';

interface LastMove {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

Component({
  properties: {
    // 当前回合
    turn: {
      type: String,
      value: 'red' as TurnType
    },
    // 游戏状态
    status: {
      type: String,
      value: 'playing' as GameStatusType
    },
    // 最后一走
    lastMove: {
      type: Object,
      value: null as LastMove | null
    },
    // 步数
    moveCount: {
      type: Number,
      value: 0
    }
  },

  data: {
    statusText: ''
  },

  observers: {
    'status': function(status: GameStatusType) {
      this.updateStatusText(status);
    }
  },

  methods: {
    /**
     * 更新状态文本
     */
    updateStatusText(status: GameStatusType) {
      const statusMap: Record<GameStatusType, string> = {
        'playing': '',
        'red_win': '🎉 红方获胜！',
        'black_win': '🎉 黑方获胜！',
        'draw': '🤝 和棋'
      };

      this.setData({
        statusText: statusMap[status] || ''
      });
    }
  }
});
