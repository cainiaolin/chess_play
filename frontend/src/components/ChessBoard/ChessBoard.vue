<template>
  <div class="chess-board">
    <!-- 棋盘容器 -->
    <div class="board">
      <!-- Canvas绘制棋盘线条 -->
      <div class="board-lines">
        <canvas ref="linesCanvas"></canvas>
      </div>

      <!-- 棋盘格子（点击区域） -->
      <div
        v-for="(row, y) in board"
        :key="'row-'+y"
        class="board-rows"
      >
        <div
          v-for="(cell, x) in row"
          :key="'cell-'+x+'-'+y"
          class="square"
          :class="getSquareClass(x, y, cell)"
          :style="getSquareStyle(x, y)"
          @click="handleCellClick(x, y, cell)"
        >
          <!-- 棋子 -->
          <div v-if="cell" class="piece" :class="cell.color">
            <span class="piece-char">{{ getPieceChar(cell) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'

const props = defineProps({
  board: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false },
  selectedPiece: { type: Object, default: null },
  validMoves: { type: Array, default: () => [] },
  lastMove: { type: Object, default: null }
})

const emit = defineEmits(['cell-click'])

const linesCanvas = ref(null)

// 棋子字符映射
const pieceChars = {
  red: { r: '俥', n: '傌', b: '相', a: '仕', k: '帅', c: '炮', p: '兵' },
  black: { r: '車', n: '馬', b: '象', a: '士', k: '将', c: '砲', p: '卒' }
}

function getPieceChar(piece) {
  return pieceChars[piece.color]?.[piece.type] || ''
}

function getSquareClass(x, y, cell) {
  const classes = []

  if (props.selectedPiece?.x === x && props.selectedPiece?.y === y) {
    classes.push('selected')
  }

  if (showLegalMove(x, y)) {
    classes.push('legal-move')
  }

  if (props.lastMove) {
    if ((props.lastMove.from?.x === x && props.lastMove.from?.y === y) ||
        (props.lastMove.to?.x === x && props.lastMove.to?.y === y)) {
      classes.push('last-move')
    }
  }

  return classes.join(' ')
}

function showLegalMove(x, y) {
  return props.validMoves.some(m => m.to?.x === x && m.to?.y === y)
}

function getSquareStyle(x, y) {
  // 计算每个格子的位置（9列x10行）
  const colWidth = 100 / 8  // 8个间隔（9列）
  const rowHeight = 100 / 9 // 9个间隔（10行）

  return {
    left: `${x * colWidth}%`,
    top: `${y * rowHeight}%`
  }
}

function handleCellClick(x, y, cell) {
  if (!props.readonly) {
    emit('cell-click', { x, y, piece: cell })
  }
}

// 绘制棋盘线条
function drawBoardLines() {
  const canvas = linesCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const rect = canvas.getBoundingClientRect()

  // 设置canvas实际尺寸
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

  const padding = 32
  const width = rect.width - padding * 2
  const height = rect.height - padding * 2

  const colWidth = width / 8
  const rowHeight = height / 9

  ctx.strokeStyle = '#8b6914'
  ctx.lineWidth = 1.5

  // 绘制横线（10条）
  for (let i = 0; i < 10; i++) {
    ctx.beginPath()
    ctx.moveTo(padding, padding + i * rowHeight)
    ctx.lineTo(padding + width, padding + i * rowHeight)
    ctx.stroke()
  }

  // 绘制竖线（注意河界处断开）
  for (let i = 0; i < 9; i++) {
    const x = padding + i * colWidth

    // 上半部分
    ctx.beginPath()
    ctx.moveTo(x, padding)
    ctx.lineTo(x, padding + 4 * rowHeight)
    ctx.stroke()

    // 下半部分
    ctx.beginPath()
    ctx.moveTo(x, padding + 5 * rowHeight)
    ctx.lineTo(x, padding + 9 * rowHeight)
    ctx.stroke()
  }

  // 绘制两侧竖线贯穿河界
  ctx.beginPath()
  ctx.moveTo(padding, padding + 4 * rowHeight)
  ctx.lineTo(padding, padding + 5 * rowHeight)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(padding + 8 * colWidth, padding + 4 * rowHeight)
  ctx.lineTo(padding + 8 * colWidth, padding + 5 * rowHeight)
  ctx.stroke()

  // 绘制九宫格斜线
  // 上方九宫
  ctx.beginPath()
  ctx.moveTo(padding + 3 * colWidth, padding)
  ctx.lineTo(padding + 5 * colWidth, padding + 2 * rowHeight)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(padding + 5 * colWidth, padding)
  ctx.lineTo(padding + 3 * colWidth, padding + 2 * rowHeight)
  ctx.stroke()

  // 下方九宫
  ctx.beginPath()
  ctx.moveTo(padding + 3 * colWidth, padding + 7 * rowHeight)
  ctx.lineTo(padding + 5 * colWidth, padding + 9 * rowHeight)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(padding + 5 * colWidth, padding + 7 * rowHeight)
  ctx.lineTo(padding + 3 * colWidth, padding + 9 * rowHeight)
  ctx.stroke()

  // 绘制楚河汉界文字
  ctx.font = 'bold 18px "KaiTi", "STKaiti", serif'
  ctx.fillStyle = '#8b6914'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const riverY = padding + 4.5 * rowHeight
  ctx.fillText('楚 河', padding + width * 0.25, riverY)
  ctx.fillText('汉 界', padding + width * 0.75, riverY)
}

onMounted(() => {
  nextTick(() => {
    drawBoardLines()
    window.addEventListener('resize', drawBoardLines)
  })
})
</script>

<style scoped src="./ChessBoard.scss"></style>
