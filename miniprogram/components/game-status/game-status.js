// 游戏状态组件
Component({
  properties: {
    turn: {
      type: String,
      value: 'red'
    },
    status: {
      type: String,
      value: 'playing'
    },
    lastMove: {
      type: Object,
      value: null
    },
    moveCount: {
      type: Number,
      value: 0
    }
  },

  data: {
    statusText: ''
  },

  observers: {
    'status': function(status) {
      this.updateStatusText(status)
    }
  },

  methods: {
    updateStatusText(status) {
      const statusMap = {
        'playing': '',
        'red_win': '🎉 红方获胜！',
        'black_win': '🎉 黑方获胜！',
        'draw': '🤝 和棋'
      }

      this.setData({
        statusText: statusMap[status] || ''
      })
    }
  }
})
