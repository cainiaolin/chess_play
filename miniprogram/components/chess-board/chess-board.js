// 棋盘组件逻辑

// 棋子类型映射
const PIECE_NAMES = {
  'k': '帅',
  'a': '仕',
  'b': '相',
  'n': '马',
  'r': '车',
  'c': '炮',
  'p': '兵'
}

Component({
  properties: {
    fen: {
      type: String,
      value: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'
    },
    currentPlayer: {
      type: String,
      value: 'red'
    },
    selectedPiece: {
      type: Object,
      value: null
    },
    validMoves: {
      type: Array,
      value: []
    },
    lastMove: {
      type: Object,
      value: null
    },
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
    pieces: [],
    scale: 1
  },

  lifetimes: {
    attached() {
      this.initCanvas()
    },
    detached() {}
  },

  observers: {
    'fen': function(fen) {
      if (fen) {
        this.parseFEN(fen)
        this.drawBoard()
      }
    }
  },

  methods: {
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

    parseFEN(fen) {
      const pieces = []
      const [position] = fen.split(' ')
      const rows = position.split('/')

      let idCounter = 0
      rows.forEach((row, rowIndex) => {
        let colIndex = 0
        for (const char of row) {
          if (/\d/.test(char)) {
            colIndex += parseInt(char)
          } else {
            const isRed = char === char.toUpperCase()
            const type = char.toLowerCase()
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

    drawBoard() {
      if (!this.ctx) return

      const { canvasWidth, canvasHeight, cellSize, offsetX, offsetY, pieces, selectedPiece, validMoves, lastMove } = this.data

      this.ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      this.drawBackground()
      this.drawGrid()
      this.drawRiver()
      this.drawPalace()
      this.drawValidMoves()
      this.drawLastMove()

      pieces.forEach(piece => {
        this.drawPiece(piece)
      })
    },

    drawBackground() {
      const { canvasWidth, canvasHeight } = this.data

      this.ctx.fillStyle = '#f0d9b5'
      this.ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      this.ctx.strokeStyle = '#8b4513'
      this.ctx.lineWidth = 3
      const { offsetX, offsetY, cellSize } = this.data
      this.ctx.strokeRect(offsetX - 10, offsetY - 10, cellSize * 8 + 20, cellSize * 9 + 20)
    },

    drawGrid() {
      const { cellSize, offsetX, offsetY } = this.data

      this.ctx.strokeStyle = '#000'
      this.ctx.lineWidth = 1

      for (let i = 0; i < 10; i++) {
        const y = offsetY + i * cellSize
        this.ctx.beginPath()
        this.ctx.moveTo(offsetX, y)
        this.ctx.lineTo(offsetX + cellSize * 8, y)
        this.ctx.stroke()
      }

      for (let i = 0; i < 9; i++) {
        const x = offsetX + i * cellSize

        this.ctx.beginPath()
        this.ctx.moveTo(x, offsetY)
        this.ctx.lineTo(x, offsetY + cellSize * 4)
        this.ctx.stroke()

        this.ctx.beginPath()
        this.ctx.moveTo(x, offsetY + cellSize * 5)
        this.ctx.lineTo(x, offsetY + cellSize * 9)
        this.ctx.stroke()
      }

      this.ctx.beginPath()
      this.ctx.moveTo(offsetX, offsetY + cellSize * 4)
      this.ctx.lineTo(offsetX, offsetY + cellSize * 5)
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.moveTo(offsetX + cellSize * 8, offsetY + cellSize * 4)
      this.ctx.lineTo(offsetX + cellSize * 8, offsetY + cellSize * 5)
      this.ctx.stroke()
    },

    drawRiver() {
      const { cellSize, offsetX, offsetY } = this.data

      this.ctx.save()
      this.ctx.font = `${cellSize * 0.6}px STKaiti, KaiTi, serif`
      this.ctx.fillStyle = '#000'
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'

      const riverY = offsetY + cellSize * 4.5

      this.ctx.fillText('楚河', offsetX + cellSize * 2, riverY)
      this.ctx.fillText('汉界', offsetX + cellSize * 6, riverY)

      this.ctx.restore()
    },

    drawPalace() {
      const { cellSize, offsetX, offsetY } = this.data

      this.ctx.strokeStyle = '#000'
      this.ctx.lineWidth = 1

      this.ctx.beginPath()
      this.ctx.moveTo(offsetX + cellSize * 3, offsetY)
      this.ctx.lineTo(offsetX + cellSize * 5, offsetY + cellSize * 2)
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.moveTo(offsetX + cellSize * 5, offsetY)
      this.ctx.lineTo(offsetX + cellSize * 3, offsetY + cellSize * 2)
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.moveTo(offsetX + cellSize * 3, offsetY + cellSize * 7)
      this.ctx.lineTo(offsetX + cellSize * 5, offsetY + cellSize * 9)
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.moveTo(offsetX + cellSize * 5, offsetY + cellSize * 7)
      this.ctx.lineTo(offsetX + cellSize * 3, offsetY + cellSize * 9)
      this.ctx.stroke()
    },

    drawValidMoves() {
      const { validMoves, cellSize, offsetX, offsetY } = this.data

      if (!validMoves || validMoves.length === 0) return

      this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'

      validMoves.forEach((move) => {
        const x = offsetX + move.to.x * cellSize
        const y = offsetY + move.to.y * cellSize

        this.ctx.beginPath()
        this.ctx.arc(x, y, cellSize * 0.2, 0, Math.PI * 2)
        this.ctx.fill()
      })
    },

    drawLastMove() {
      const { lastMove, cellSize, offsetX, offsetY } = this.data

      if (!lastMove) return

      this.ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)'
      this.ctx.lineWidth = 3

      const fromX = offsetX + lastMove.from.x * cellSize
      const fromY = offsetY + lastMove.from.y * cellSize
      this.ctx.strokeRect(fromX - cellSize * 0.4, fromY - cellSize * 0.4, cellSize * 0.8, cellSize * 0.8)

      const toX = offsetX + lastMove.to.x * cellSize
      const toY = offsetY + lastMove.to.y * cellSize
      this.ctx.strokeRect(toX - cellSize * 0.4, toY - cellSize * 0.4, cellSize * 0.8, cellSize * 0.8)
    },

    drawPiece(piece) {
      const { cellSize, offsetX, offsetY, selectedPiece } = this.data

      const x = offsetX + piece.x * cellSize
      const y = offsetY + piece.y * cellSize
      const radius = cellSize * 0.42

      this.ctx.beginPath()
      this.ctx.arc(x, y, radius, 0, Math.PI * 2)

      const gradient = this.ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius)
      gradient.addColorStop(0, '#fff8dc')
      gradient.addColorStop(1, piece.color === 'red' ? '#ffe4e1' : '#f0e68c')

      this.ctx.fillStyle = gradient
      this.ctx.fill()

      this.ctx.strokeStyle = piece.color === 'red' ? '#dc143c' : '#000'
      this.ctx.lineWidth = 2

      if (selectedPiece && selectedPiece.id === piece.id) {
        this.ctx.strokeStyle = '#00ff00'
        this.ctx.lineWidth = 4
      }

      this.ctx.stroke()

      this.ctx.save()
      this.ctx.font = `bold ${cellSize * 0.5}px STKaiti, KaiTi, serif`
      this.ctx.fillStyle = piece.color === 'red' ? '#dc143c' : '#000'
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillText(PIECE_NAMES[piece.type], x, y + cellSize * 0.05)
      this.ctx.restore()
    },

    onTouchStart(e) {
      if (this.data.disabled) return

      const touch = e.touches[0]
      const { cellSize, offsetX, offsetY } = this.data

      const x = Math.round((touch.x - offsetX) / cellSize)
      const y = Math.round((touch.y - offsetY) / cellSize)

      if (x < 0 || x > 8 || y < 0 || y > 9) return

      const clickedPiece = this.data.pieces.find(p => p.x === x && p.y === y)

      this.triggerEvent('boardclick', {
        x,
        y,
        piece: clickedPiece
      })
    }
  }
})
