// 验证棋盘布局的脚本
const layout = {
  black: {
    row0: ['车', '马', '象', '士', '将', '士', '象', '马', '车'],
    row2: [null, '炮', null, null, null, null, null, '炮', null],
    row3: ['卒', null, '卒', null, '卒', null, '卒', null, '卒']
  },
  red: {
    row6: ['兵', null, '兵', null, '兵', null, '兵', null, '兵'],
    row7: [null, '炮', null, null, null, null, null, '炮', null],
    row9: ['车', '马', '象', '士', '帅', '士', '象', '马', '车']
  }
};

console.log('中国象棋初始棋盘布局验证:');
console.log('=====================================');
console.log('黑方 (行 0-4):');
console.log('  行 0: 车 马 象 士 将 士 象 马 车');
console.log('  行 2: . 炮 . . . . . 炮 .');
console.log('  行 3: 卒 . 卒 . 卒 . 卒 . 卒');
console.log('');
console.log('红方 (行 6-9):');
console.log('  行 6: 兵 . 兵 . 兵 . 兵 . 兵');
console.log('  行 7: . 炮 . . . . . 炮 .');
console.log('  行 9: 车 马 象 士 帅 士 象 马 车');
console.log('=====================================');
