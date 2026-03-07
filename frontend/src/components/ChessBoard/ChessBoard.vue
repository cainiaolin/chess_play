<template>
  <div class="chess-board">
    <div class="board-grid">
      <div
        v-for="(row, y) in board"
        :key="y"
        class="board-row"
      >
        <div
          v-for="(cell, x) in row"
          :key="x"
          class="board-cell"
          :class="getCellClass(x, y, cell)"
          @click="handleCellClick(x, y, cell)"
        >
          <span v-if="cell" class="piece">{{ getPieceText(cell) }}</span>
          <span
            v-if="isValidMove(x, y)"
            class="move-indicator"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  board: {
    type: Array,
    default: () => []
  },
  readonly: {
    type: Boolean,
    default: false
  },
  selectedPiece: {
    type: Object,
    default: null
  },
  validMoves: {
    type: Array,
    default: () => []
  },
  lastMove: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['cell-click'])

// 棋子字符映射
const pieceChars = {
  'R': '俥', 'N': '傌', 'B': '相', 'A': '仕', 'K': '帅', 'C': '炮', 'P': '兵',
  'r': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '将', 'c': '砲', 'p': '卒'
}

function getPieceText(piece) {
  if (!piece) return ''
  return pieceChars[piece.type] || ''
}

function getPieceColor(piece) {
  if (!piece) return ''
  return piece.color === 'red' ? 'red' : 'black'
}

function getCellClass(x, y, cell) {
  const classes = []

  if (cell) {
    classes.push('has-piece', getPieceColor(cell))
  }

  if (props.selectedPiece && props.selectedPiece.x === x && props.selectedPiece.y === y) {
    classes.push('selected')
  }

  if (props.lastMove) {
    if ((props.lastMove.from?.x === x && props.lastMove.from?.y === y) ||
        (props.lastMove.to?.x === x && props.lastMove.to?.y === y)) {
      classes.push('last-move')
    }
  }

  return classes.join(' ')
}

function isValidMove(x, y) {
  return props.validMoves.some(move => move.to?.x === x && move.to?.y === y)
}

function handleCellClick(x, y, cell) {
  if (props.readonly) return
  emit('cell-click', { x, y, piece: cell })
}
</script>

<style scoped src="./ChessBoard.scss"></style>
