import 'dotenv/config';
import { Board, Move, AIRequest, AIResponse, AIModel, PieceType } from '../types/chess';
import { ChessEngine } from './chess-engine';
import * as fs from 'fs';
import * as path from 'path';

// ── 模块级工具函数 ──────────────────────────────────────────────────────

let cachedChessRules: string | null = null;

function getChessRules(): string {
  if (cachedChessRules) return cachedChessRules;
  try {
    cachedChessRules = fs.readFileSync(path.join(__dirname, '../prompts/chess-rules.md'), 'utf-8');
  } catch {
    cachedChessRules = getBuiltInRules();
  }
  return cachedChessRules;
}

function getBuiltInRules(): string {
  return `# 中国象棋规则

## 棋子走法
- 帅/将(k): 九宫格内，横竖移动一格，不能对面
- 仕/士(a): 九宫格内，斜线移动一格
- 相/象(b): 走"田"字对角，不能过河，中心有子则塞象眼
- 马(n): 走"日"字形，第一步有子则蹩马腿
- 车(r): 横竖直线移动任意格，不能越子
- 炮(c): 移动同车，吃子必须隔一子（炮架）
- 兵/卒(p): 过河前只能前进，过河后可前进或横走，每次一格

## 坐标系统
- x: 列(0-8), y: 行(0-9)
- 红方在底部(y=5-9)，黑方在顶部(y=0-4)

## 输出格式
必须返回JSON: {"from":{"x":0-8,"y":0-9},"to":{"x":0-8,"y":0-9},"thinking":"思考过程"}`;
}

const PIECE_NAMES_RED: Record<PieceType, string> = {
  k: '将', a: '士', b: '象', n: '马', r: '车', c: '炮', p: '兵'
};
const PIECE_NAMES_BLACK: Record<PieceType, string> = {
  k: '帅', a: '仕', b: '相', n: '马', r: '车', c: '炮', p: '卒'
};

function boardToString(board: Board): string {
  let str = '   0 1 2 3 4 5 6 7 8\n';
  for (let y = 0; y < 10; y++) {
    str += y + ' ';
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];
      if (piece) {
        str += (piece.color === 'red' ? PIECE_NAMES_RED[piece.type] : PIECE_NAMES_BLACK[piece.type]) + ' ';
      } else {
        str += '· ';
      }
    }
    str += '\n';
  }
  return str;
}

function historyToString(history: Move[]): string {
  return history.map((m, i) => `${i + 1}. (${m.from.x},${m.from.y}) -> (${m.to.x},${m.to.y})`).join('\n');
}

function buildPrompt(request: AIRequest): string {
  const roleStr = request.role === 'red' ? '红方' : '黑方';
  return `当前棋盘状态：
${boardToString(request.board)}

当前执子：${roleStr}

历史走法：
${historyToString(request.history) || '无'}

请分析当前棋局，给出最佳走法。必须返回JSON格式：
{
  "from": {"x": 列号0-8, "y": 行号0-9},
  "to": {"x": 列号0-8, "y": 行号0-9},
  "thinking": "简要说明你的思考过程"
}`;
}

function parseResponse(content: string): AIResponse {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('无法解析AI响应');
  const parsed = JSON.parse(jsonMatch[0]);
  return { from: parsed.from, to: parsed.to, thinking: parsed.thinking };
}

// ── LLM Provider（通用 OpenAI 兼容接口） ─────────────────────────────

class LLMProvider {
  readonly id: string;
  readonly name: string;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(id: string, name: string, baseUrl: string, apiKey: string, model: string) {
    this.id = id;
    this.name = name;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.model = model;
  }

  async getMove(request: AIRequest): Promise<AIResponse> {
    const prompt = buildPrompt(request);
    const chessRules = getChessRules();
    const systemPrompt = `你是一个中国象棋专家。请严格遵循以下规则进行对弈。

${chessRules}

**重要提醒**：
1. 你必须严格遵守上述所有棋子走法规则
2. 只能返回合法的走法，不能返回非法走法
3. 输出必须是严格的JSON格式`;

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`LLM API 错误 ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content
      || data.result
      || data.response;
    if (!content) throw new Error('LLM 响应内容为空');

    return parseResponse(content);
  }
}

// ── AI 适配器 ─────────────────────────────────────────────────────────

export class AIAdapter {
  private provider: LLMProvider;
  private timeout: number;

  constructor() {
    this.timeout = parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);

    const provider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
    const baseUrl = process.env.AI_BASE_URL || '';
    const apiKey = process.env.AI_API_KEY || '';
    const model = process.env.AI_MODEL || '';

    if (!baseUrl || !apiKey || !model) {
      throw new Error('未配置 LLM 环境变量 (AI_BASE_URL, AI_API_KEY, AI_MODEL)');
    }

    this.provider = new LLMProvider(provider, `LLM (${provider}/${model})`, baseUrl, apiKey, model);
    console.log(`AI 已配置: provider=${provider}, model=${model}, baseUrl=${baseUrl}`);
  }

  getAvailableModels(): AIModel[] {
    return [{
      id: this.provider.id,
      name: this.provider.name,
      provider: this.provider.id as any,
      requiresApiKey: false
    }];
  }

  async getMove(providerId?: string, request?: AIRequest, _apiKey?: string, _baseUrl?: string): Promise<AIResponse> {
    if (!request) throw new Error('AI 请求参数为空');

    const response = await Promise.race([
      this.provider.getMove(request),
      this.timeoutPromise()
    ]);

    const engine = new ChessEngine();
    engine.loadBoard(request.board, request.role);
    const validation = engine.validateMove(response.from, response.to);
    if (!validation.valid) {
      throw new Error(`AI 返回非法走法: ${validation.reason}`);
    }

    return response;
  }

  private timeoutPromise(): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI 请求超时 (${this.timeout}ms)`)), this.timeout)
    );
  }
}
