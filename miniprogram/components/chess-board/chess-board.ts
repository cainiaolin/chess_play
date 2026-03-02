// 棋盘组件逻辑
interface ChessPiece {
  id: string
  type: 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p'
  color: 'red' | 'black'
  x: number
  y: number
  selected?: boolean
}

interface Position {
  x: number
  y: number
}

interface ValidMove {
  from: Position
  to: Position
}

// 棋子类型映射
const PIECE_NAMES: Record<string, string> = {
  'k': '帅', // 将/帅
  'a': '仕', // 士/仕
  'b': '相', // 象/相
  'n': '马', // 马
  'r': '车', // 车
  'c': '炮', // 炮
  'p': '兵'  // 卒/兵
}

Component({
  properties: {
    // 棋盘状态
    fen: {
      type: String,
      value: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'
    },
    // 当前玩家
    currentPlayer: {
      type: String,
      value: 'red'
    },
    // 选中的棋子
    selectedPiece: {
      type: Object,
      value: null
    },
    // 有效走法
    validMoves: {
      type: Array,
      value: []
    },
    // 最后一步走法
    lastMove: {
      type: Object,
      value: null
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    canvasWidth: 0,
    canvasHeight: 0,
    cellSize: 0,
    offsetX: 0,
    offsetY: 0,
    pieces: [] as ChessPiece[],
    scale: 1
  },

  lifetimes: {
    attached() {
      this.initCanvas()
    },

    detached() {
      // 清理
    }
  },

  observers: {
    'fen': function(fen: string) {
      if (fen) {
        this.parseFEN(fen)
        this.drawBoard()
      }
    }
  },

  methods: {
    /**
     * 初始化Canvas
     */
    initCanvas() {
      const query = this.createSelectorQuery()
      query.select('#chessCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) {
            console.error('Canvas节点未找到')
            return
          }

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          // 设置canvas尺寸
          const dpr = wx.getSystemInfoSync().pixelRatio
          const width = res[0].width
          const height = res[0].height

          canvas.width = width * dpr
          canvas.height = height * dpr
          ctx.scale(dpr, dpr)

          this.setData({
            canvasWidth: width,
            canvasHeight: height
          })

          // 计算格子大小
          const padding = 20
          const boardWidth = width - padding * 2
          const cellSize = boardWidth / 8
          const offsetX = padding
          const offsetY = (height - boardWidth - cellSize) / 2

          this.setData({
            cellSize,
            offsetX,
            offsetY
          })

          this.canvas = canvas
          this.ctx = ctx

          this.drawBoard()
        })
    },

    /**
     * 解析FEN字符串
     */
    parseFEN(fen: string) {
      const pieces: ChessPiece[] = []
      const [position] = fen.split(' ')
      const rows = position.split('/')

      let idCounter = 0
      rows.forEach((row, rowIndex) => {
        let colIndex = 0
        for (const char of row) {
          if (/\d/.test(char)) {
            // 数字表示空格
            colIndex += parseInt(char)
          } else {
            // 字母表示棋子
            const isRed = char === char.toUpperCase()
            const type = char.toLowerCase() as ChessPiece['type']
            pieces.push({
              id: `piece-${idCounter++}`,
              type,
              color: isRed ? 'red' : 'black',
              x: colIndex,
              y: rowIndex
            })
            colIndex++
          }
        }
      })

      this.setData({ pieces })
    },

    /**
     * 绘制棋盘
     */
    drawBoard() {
      if (!this.ctx) return

      const { canvasWidth, canvasHeight, cellSize, offsetX, offsetY, pieces, selectedPiece, validMoves, lastMove } = this.data

      // 清空画布
      this.ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // 绘制背景
      this.drawBackground()

      // 绘制棋盘线
      this.drawGrid()

      // 绘制楚河汉界
      this.drawRiver()

      // 绘制九宫
      this.drawPalace()

      // 绘制有效走法
      this.drawValidMoves()

      // 绘制最后一步
      this.drawLastMove()

      // 绘制棋子
      pieces.forEach(piece => {
        this.drawPiece(piece)
      })
    },

    /**
     * 绘制背景
     */
    drawBackground() {
      const { canvasWidth, canvasHeight } = this.data

      // 木纹色背景
      this.ctx.fillStyle = '#f0d9b5'
      this.ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // 外边框
      this.ctx.strokeStyle = '#8b4513'
      this.ctx.lineWidth = 3
      const { offsetX, offsetY, cellSize } = this.data
      this.ctx.strokeRect(offsetX - 10, offsetY - 10, cellSize * 8 + 20, cellSize * 9 + 20)
    },

    /**
     * 绘制网格线
     */
    drawGrid() {
      const { cellSize, offsetX, offsetY } = this.data

      this.ctx.strokeStyle = '#000'
      this.ctx.lineWidth = 1

      // 横线 (10条)
      for (let i = 0; i < 10; i++) {
        const y = offsetY + i * cellSize
        this.ctx.beginPath()
        this.ctx.moveTo(offsetX, y)
        this.ctx.lineTo(offsetX + cellSize * 8, y)
        this.ctx.stroke()
      }

      // 竖线 (9条，中间断开)
      for (let i = 0; i < 9; i++) {
        const x = offsetX + i * cellSize

        // 上半部分
        this.ctx.beginPath()
        this.ctx.moveTo(x, offsetY)
        this.ctx.lineTo(x, offsetY + cellSize * 4)
        this.ctx.stroke()

        // 下半部分
        this.ctx.beginPath()
        this.ctx.moveTo(x, offsetY + cellSize * 5)
        this.ctx.lineTo(x, offsetY + cellSize * 9)
        this.ctx.stroke()
      }

      // 左右边框贯通
      this.ctx.beginPath()
      this.ctx.moveTo(offsetX, offsetY + cellSize * 4)
      this.ctx.lineTo(offsetX, offsetY + cellSize * 5)
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.moveTo(offsetX + cellSize * 8, offsetY + cellSize * 4)
      this.ctx.lineTo(offsetX + cellSize * 8, offsetY + cellSize * 5)
      this.ctx.stroke()
    },

    /**
     * 绘制楚河汉界
     */
    drawRiver() {
      const { cellSize, offsetX, offsetY } = this.data

      this.ctx.save()
      this.ctx.font = `${cellSize * 0.6}px STKaiti, KaiTi, serif`
      this.ctx.fillStyle = '#000'
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'

      const riverY = offsetY + cellSize * 4.5

      // 楚河
      this.ctx.fillText('楚河', offsetX + cellSize * 2, riverY)

      // 汉界
      this.ctx.fillText('汉界', offsetX + cellSize * 6, riverY)

      this.ctx.restore()
    },

    /**
     * 绘制九宫格斜线
     */
    drawPalace() {
      const { cellSize, offsetX, offsetY } = this.data

      this.ctx.strokeStyle = '#000'
      this.ctx.lineWidth = 1

      // 上方九宫
      this.ctx.beginPath()
      this.ctx.moveTo(offsetX + cellSize * 3, offsetY)
      this.ctx.lineTo(offsetX + cellSize * 5, offsetY + cellSize * 2)
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.moveTo(offsetX + cellSize * 5, offsetY)
      this.ctx.lineTo(offsetX + cellSize * 3, offsetY + cellSize * 2)
      this.ctx.stroke()

      // 下方九宫
      this.ctx.beginPath()
      this.ctx.moveTo(offsetX + cellSize * 3, offsetY + cellSize * 7)
      this.ctx.lineTo(offsetX + cellSize * 5, offsetY + cellSize * 9)
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.moveTo(offsetX + cellSize * 5, offsetY + cellSize * 7)
      this.ctx.lineTo(offsetX + cellSize * 3, offsetY + cellSize * 9)
      this.ctx.stroke()
    },

    /**
     * 绘制有效走法
     */
    drawValidMoves() {
      const { validMoves, cellSize, offsetX, offsetY } = this.data

      if (!validMoves || validMoves.length === 0) return

      this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'

      validMoves.forEach((move: ValidMove) => {
        const x = offsetX + move.to.x * cellSize
        const y = offsetY + move.to.y * cellSize

        this.ctx.beginPath()
        this.ctx.arc(x, y, cellSize * 0.2, 0, Math.PI * 2)
        this.ctx.fill()
      })
    },

    /**
     * 绘制最后一步
     */
    drawLastMove() {
      const { lastMove, cellSize, offsetX, offsetY } = this.data

      if (!lastMove) return

      this.ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)'
      this.ctx.lineWidth = 3

      // 起点
      const fromX = offsetX + lastMove.from.x * cellSize
      const fromY = offsetY + lastMove.from.y * cellSize
      this.ctx.strokeRect(fromX - cellSize * 0.4, fromY - cellSize * 0.4, cellSize * 0.8, cellSize * 0.8)

      // 终点
      const toX = offsetX + lastMove.to.x * cellSize
      const toY = offsetY + lastMove.to.y * cellSize
      this.ctx.strokeRect(toX - cellSize * 0.4, toY - cellSize * 0.4, cellSize * 0.8, cellSize * 0.8)
    },

    /**
     * 绘制棋子
     */
    drawPiece(piece: ChessPiece) {
      const { cellSize, offsetX, offsetY, selectedPiece } = this.data

      const x = offsetX + piece.x * cellSize
      const y = offsetY + piece.y * cellSize
      const radius = cellSize * 0.42

      // 绘制棋子底座
      this.ctx.beginPath()
      this.ctx.arc(x, y, radius, 0, Math.PI * 2)

      // 渐变效果
      const gradient = this.ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius)
      gradient.addColorStop(0, '#fff8dc')
      gradient.addColorStop(1, piece.color === 'red' ? '#ffe4e1' : '#f0e68c')

      this.ctx.fillStyle = gradient
      this.ctx.fill()

      // 边框
      this.ctx.strokeStyle = piece.color === 'red' ? '#dc143c' : '#000'
      this.ctx.lineWidth = 2

      // 选中状态
      if (selectedPiece && selectedPiece.id === piece.id) {
        this.ctx.strokeStyle = '#00ff00'
        this.ctx.lineWidth = 4
      }

      this.ctx.stroke()

      // 绘制棋子文字
      this.ctx.save()
      this.ctx.font = `bold ${cellSize * 0.5}px STKaiti, KaiTi, serif`
      this.ctx.fillStyle = piece.color === 'red' ? '#dc143c' : '#000'
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillText(PIECE_NAMES[piece.type], x, y + cellSize * 0.05)
      this.ctx.restore()
    },

    /**
     * 处理触摸事件
     */
    onTouchStart(e: WechatMiniprogram.TouchEvent) {
      if (this.data.disabled) return

      const touch = e.touches[0]
      const { cellSize, offsetX, offsetY } = this.data

      // 计算点击的格子位置
      const x = Math.round((touch.x - offsetX) / cellSize)
      const y = Math.round((touch.y - offsetY) / cellSize)

      // 边界检查
      if (x < 0 || x > 8 || y < 0 || y > 9) return

      // 查找点击的棋子
      const clickedPiece = this.data.pieces.find(p => p.x === x && p.y === y)

      this.triggerEvent('boardclick', {
        x,
        y,
        piece: clickedPiece
      })
    }
  }
})
