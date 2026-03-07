<template>
  <div class="control-panel">
    <button
      class="btn btn-secondary"
      :disabled="!canUndo || isAIThinking"
      @click="$emit('undo')"
    >
      悔棋
    </button>
    <button
      class="btn btn-primary"
      :disabled="!canHint || isAIThinking"
      @click="$emit('hint')"
    >
      提示
    </button>
    <button
      class="btn btn-secondary"
      :disabled="isAIThinking"
      @click="$emit('restart')"
    >
      重新开始
    </button>
  </div>
</template>

<script setup>
defineProps({
  canUndo: { type: Boolean, default: false },
  canHint: { type: Boolean, default: true },
  isAIThinking: { type: Boolean, default: false }
})

defineEmits(['undo', 'hint', 'restart'])
</script>

<style scoped src="./ControlPanel.scss"></style>
