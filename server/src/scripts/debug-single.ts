/**
 * 单步调试脚本：打印 LLM 的完整 prompt 输入与原始响应，用于诊断走法错误根因。
 *
 * 用法：
 *   npx tsx src/scripts/debug-single.ts                 # 默认：红方走首步
 *   npx tsx src/scripts/debug-single.ts --color=black   # 黑方（需先生成红方首步）
 */

import 'dotenv/config';
import { ChessEngine } from '../services/chess-engine';
import { AIAdapter } from '../services/ai-adapter';
import { buildUserPrompt, buildSystemPrompt } from '../services/chess-prompt-builder';
import { AIRequest, PieceColor } from '../types/chess';

async function main(): Promise<void> {
  const engine = new ChessEngine();
  const color = (process.argv.find(a => a.startsWith('--color='))?.split('=')[1] as PieceColor) || 'red';

  // 黑方视角：红方走固定合法首步（炮二进二），避免 LocalAI 搜索噪音
  if (color === 'black') {
    engine.makeMove({ x: 1, y: 7 }, { x: 1, y: 5 });
    console.log(`红方已走（固定）: (1,7) -> (1,5) 炮进一步\n`);
  }

  const request: AIRequest = {
    board: engine.getBoard(),
    role: color,
    history: engine.getMoves(),
  };

  // 打印发给 LLM 的 user prompt
  console.log('='.repeat(60));
  console.log(`【调试】${color === 'red' ? '红方' : '黑方'}视角 - 发给 LLM 的 USER PROMPT`);
  console.log('='.repeat(60));
  console.log(buildUserPrompt(request));

  // 直接调用 LLM 原始 API（绕过解析，看原始输出）
  console.log('\n' + '='.repeat(60));
  console.log('【调试】等待 LLM 原始响应...');
  console.log('='.repeat(60));

  const baseUrl = (process.env.AI_BASE_URL || '').replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(request) },
  ];

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      messages,
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 4000,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error(`LLM API 错误 ${resp.status}:`, t.slice(0, 300));
    process.exit(1);
  }

  const data = await resp.json() as any;
  const content = data.choices?.[0]?.message?.content || '';
  console.log(content);

  // 验证解析出的走法
  console.log('\n' + '='.repeat(60));
  console.log('【调试】解析与合法性验证');
  console.log('='.repeat(60));

  // 通过 AIAdapter 走一次完整流程（含合法性校验）
  try {
    const adapter = new AIAdapter();
    const result = await adapter.getMove(undefined, request);
    console.log(`AIAdapter 返回: from(${result.from.x},${result.from.y}) -> to(${result.to.x},${result.to.y})`);
    const valid = engine.validateMove(result.from, result.to);
    console.log(`合法性: ${valid.valid} ${valid.reason || ''}`);
  } catch (err) {
    console.error(`AIAdapter 失败: ${err instanceof Error ? err.message : err}`);
  }
}

void main();
