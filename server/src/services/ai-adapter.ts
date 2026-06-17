import 'dotenv/config';
import { Board, Move, AIRequest, AIResponse, AIModel } from '../types/chess';
import { ChessEngine } from './chess-engine';
import { buildMessages } from './chess-prompt-builder';

/**
 * AI 适配器（强化版）
 *
 * 设计理念：纯 LLM 多步推理。
 * - 通过结构化五段式 CoT（思维链）prompt 引导 LLM 深度推理
 * - 战略知识库 + 局面上下文（FEN/棋谱/子力/阶段）多维度输入
 * - 单次深度调用（temperature=0.3 提升确定性，max_tokens=4000 给足推理空间）
 * - LLM 输出非法走法时纯重试（最多 N 次），不向 LLM 暴露合法走法
 *
 * 调用链：AIRequest → buildMessages → LLMProvider.getMove → parseCoTResponse → 合法性校验
 */

// ── CoT 响应解析 ──────────────────────────────────────────────────────

/**
 * 从 LLM 原始输出中提取 JSON 对象字符串。
 * 优先匹配 ```json ``` 代码块，回退到裸 JSON。
 */
function extractJsonString(content: string): string | undefined {
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const bareMatch = content.match(/\{[\s\S]*\}/);
  return bareMatch?.[0];
}

/**
 * 清理 JSON 字符串中常见的格式问题（注释、尾逗号、CRLF）。
 */
function sanitizeJson(jsonStr: string): string {
  return jsonStr
    .replace(/\/\/.*$/gm, '')        // 移除单行注释
    .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
    .replace(/,(\s*[}\]])/g, '$1')   // 移除尾部逗号
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * 从任意位置提取坐标对象（兼容 from/source/start 与 to/target/end）。
 */
function extractCoordinate(obj: any, keys: string[]): { x: number; y: number } | null {
  for (const key of keys) {
    const v = obj[key];
    if (v && typeof v.x !== 'undefined' && typeof v.y !== 'undefined') {
      return { x: Number(v.x), y: Number(v.y) };
    }
  }
  return null;
}

interface ParsedCoT {
  decision: { from: { x: number; y: number }; to: { x: number; y: number } };
  thinking: string;
}

/**
 * 解析五段式 CoT 响应，提取最终决策与推理摘要。
 *
 * 优先取 step5_decision；缺失时回退到 step4_evaluation.best_candidate_index
 * 指向的候选；再缺失时回退到顶层 from/to（兼容非标准输出）。
 */
function parseCoTResponse(content: string): ParsedCoT {
  const jsonStr = extractJsonString(content);
  if (!jsonStr) throw new Error('无法解析 AI 响应: 未找到 JSON');

  let parsed: any;
  try {
    parsed = JSON.parse(sanitizeJson(jsonStr));
  } catch {
    throw new Error(`无法解析 AI 响应: JSON 格式错误 (${jsonStr.slice(0, 120)})`);
  }

  // 路径1：标准 step5_decision
  let from: { x: number; y: number } | null = null;
  let to: { x: number; y: number } | null = null;

  const decision = parsed.step5_decision;
  if (decision) {
    from = extractCoordinate(decision, ['from', 'source', 'start']);
    to = extractCoordinate(decision, ['to', 'target', 'end']);
  }

  // 路径2：通过 best_candidate_index 取候选
  if ((!from || !to) && Array.isArray(parsed.step3_candidates)) {
    const idx = parsed.step4_evaluation?.best_candidate_index;
    if (typeof idx === 'number' && parsed.step3_candidates[idx]) {
      const cand = parsed.step3_candidates[idx];
      from = from || extractCoordinate(cand, ['from', 'source', 'start']);
      to = to || extractCoordinate(cand, ['to', 'target', 'end']);
    }
  }

  // 路径3：顶层 from/to 兼容
  if (!from) from = extractCoordinate(parsed, ['from', 'source', 'start']);
  if (!to) to = extractCoordinate(parsed, ['to', 'target', 'end']);

  if (!from || !to) {
    throw new Error('AI 响应缺少合法的 from/to 决策字段');
  }

  // 校验坐标为有限数字
  if (!Number.isFinite(from.x) || !Number.isFinite(from.y) ||
      !Number.isFinite(to.x) || !Number.isFinite(to.y)) {
    throw new Error('AI 响应坐标非法');
  }

  // 组装 thinking 摘要（截断防止过长）
  const reasoning = parsed.step4_evaluation?.reasoning || '';
  const thinking = typeof reasoning === 'string' && reasoning.length > 0
    ? reasoning.slice(0, 500)
    : '';

  return { decision: { from, to }, thinking };
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

  /**
   * 调用 LLM 获取走法决策。
   * 单次深度 CoT 推理。attempt 控制采样温度：
   * 首次低温保稳定；重试时递增温度引入多样性，避免重复犯同一坐标错误。
   */
  async getMove(request: AIRequest, attempt: number = 0): Promise<AIResponse> {
    const messages = buildMessages(request);
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    // 温度阶梯：0.15 → 0.40 → 0.65 → 0.90，重试时跳出错误采样模式
    const temperature = Math.min(0.15 + attempt * 0.25, 0.9);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        top_p: 0.9,
        max_tokens: 4000,     // 留足五段式 CoT 推理空间
      }),
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

    const parsed = parseCoTResponse(content);
    return {
      from: parsed.decision.from,
      to: parsed.decision.to,
      thinking: parsed.thinking,
    };
  }
}

// ── AI 适配器 ─────────────────────────────────────────────────────────

export class AIAdapter {
  private provider: LLMProvider;
  private timeout: number;

  constructor() {
    this.timeout = parseInt(process.env.AI_TIMEOUT_MS || '60000', 10);

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
      requiresApiKey: false,
    }];
  }

  /**
   * 获取 AI 走法。
   * 由 game-service 控制重试循环（默认 3 次），此处仅做合法性校验。
   * @param attempt 重试次数（0=首次），透传给 provider 用于温度递增
   */
  async getMove(
    providerId?: string,
    request?: AIRequest,
    _apiKey?: string,
    _baseUrl?: string,
    attempt: number = 0,
  ): Promise<AIResponse> {
    if (!request) throw new Error('AI 请求参数为空');

    const response = await Promise.race([
      this.provider.getMove(request, attempt),
      this.timeoutPromise(),
    ]);

    // 合法性校验：拦截非法走法，触发上层重试
    const engine = new ChessEngine();
    engine.loadBoard(request.board, request.role);
    const validation = engine.validateMove(response.from, response.to);
    if (!validation.valid) {
      const coord = `from=(${response.from.x},${response.from.y}) to=(${response.to.x},${response.to.y})`;
      throw new Error(`AI 返回非法走法: ${validation.reason} [${coord}]`);
    }

    return response;
  }

  private timeoutPromise(): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI 请求超时 (${this.timeout}ms)`)), this.timeout)
    );
  }
}
