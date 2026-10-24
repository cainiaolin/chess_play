// engine-thinking 单元测试：中文解说文本生成
import { describe, it, expect } from '@jest/globals';
import { ChessEngine } from '../src/services/chess-engine';
import { formatEngineThinking } from '../src/services/engine-thinking';
import { EngineSearchInfo } from '../src/services/pikafish-engine';

function makeInfo(overrides: Partial<EngineSearchInfo>): EngineSearchInfo {
  return {
    bestmove: { from: { x: 7, y: 7 }, to: { x: 4, y: 7 } },
    bestmoveUci: 'h2e2',
    pv: [],
    ...overrides
  };
}

describe('formatEngineThinking', () => {
  const initial = new ChessEngine().getBoard();

  it('should_include_depth_and_score_when_basic_info', () => {
    const text = formatEngineThinking(initial, 'red', makeInfo({ depth: 24, scoreCp: 236, pv: [] }));
    expect(text).toContain('深度 24 层');
    expect(text).toContain('红方占优');
    expect(text).toContain('+2.36');
  });

  it('should_describe_mate_when_mate_score', () => {
    const text = formatEngineThinking(initial, 'red', makeInfo({ depth: 245, scoreMate: 1, pv: ['b4b9'] }));
    expect(text).toContain('红方 1 步内绝杀');
  });

  it('should_notate_pv_in_chinese_when_initial_position', () => {
    // PV: 炮二平五 (h2e2) -> 马8进7 (h9g7)
    const text = formatEngineThinking(initial, 'red', makeInfo({ depth: 10, scoreCp: 20, pv: ['h2e2', 'h9g7'] }));
    expect(text).toContain('炮二平五');
    expect(text).toContain('马8进7');
  });

  it('should_truncate_pv_when_longer_than_limit', () => {
    const pv = ['h2e2', 'h9g7', 'h0g2', 'b0c2', 'e3e4', 'i0h0', 'a0a1', 'a3a4'];
    const text = formatEngineThinking(initial, 'red', makeInfo({ depth: 10, pv }));
    expect(text).toContain('…');
    expect(text).not.toContain('a0a1');
  });

  it('should_switch_perspective_when_mover_is_black', () => {
    // cp 为行棋方视角：黑方行棋 cp=+200 表示黑方优势 200，转红方视角后应为黑优
    const text = formatEngineThinking(initial, 'black', makeInfo({ depth: 10, scoreCp: 200 }));
    expect(text).toContain('黑方占优');
    expect(text).toContain('-2.00');
  });

  it('should_return_empty_text_when_no_data', () => {
    expect(formatEngineThinking(initial, 'red', makeInfo({}))).toBe('');
  });
});
