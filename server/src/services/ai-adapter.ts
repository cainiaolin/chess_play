import { Board, Piece, Position, Move, AIRequest, AIResponse, AIModel, PieceType, PieceColor } from '../types/chess';
import { ChessEngine } from './chess-engine';

/**
 * AI提供商接口
 */
interface AIProvider {
  id: string;
  name: string;
  getMove(request: AIRequest, apiKey?: string): Promise<AIResponse>;
}

/**
 * OpenAI提供商
 */
class OpenAIProvider implements AIProvider {
  id = 'openai';
  name = 'OpenAI (GPT-4)';

  async getMove(request: AIRequest, apiKey?: string): Promise<AIResponse> {
    const prompt = this.buildPrompt(request);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey || process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '你是一个中国象棋专家。请分析棋局并返回最佳走法。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 错误: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data.choices[0].message.content;

    return this.parseResponse(content);
  }

  private buildPrompt(request: AIRequest): string {
    const boardStr = this.boardToString(request.board);
    const historyStr = this.historyToString(request.history);
    const roleStr = request.role === 'red' ? '红方' : '黑方';

    return `当前棋盘状态：
${boardStr}

当前执子：${roleStr}

历史走法：
${historyStr || '无'}

请分析当前棋局，给出最佳走法。必须返回JSON格式：
{
  "from": {"x": 列号0-8, "y": 行号0-9},
  "to": {"x": 列号0-8, "y": 行号0-9},
  "thinking": "简要说明你的思考过程"
}

注意：
- 坐标系统：x是列(0-8)，y是行(0-9)
- 红方在底部(y=5-9)，黑方在顶部(y=0-4)
- 必须返回合法的走法`;
  }

  private boardToString(board: Board): string {
    const pieceNames: Record<PieceType, string> = {
      'k': '将',
      'a': '士',
      'b': '象',
      'n': '马',
      'r': '车',
      'c': '炮',
      'p': '兵'
    };

    const pieceNamesBlack: Record<PieceType, string> = {
      'k': '帅',
      'a': '仕',
      'b': '相',
      'n': '马',
      'r': '车',
      'c': '炮',
      'p': '卒'
    };

    let str = '   0 1 2 3 4 5 6 7 8\n';
    for (let y = 0; y < 10; y++) {
      str += y + ' ';
      for (let x = 0; x < 9; x++) {
        const piece = board[y][x];
        if (piece) {
          const name = piece.color === 'red' ? pieceNames[piece.type] : pieceNamesBlack[piece.type];
          str += name + ' ';
        } else {
          str += '· ';
        }
      }
      str += '\n';
    }
    return str;
  }

  private historyToString(history: Move[]): string {
    return history.map((move, index) => {
      return `${index + 1}. (${move.from.x},${move.from.y}) -> (${move.to.x},${move.to.y})`;
    }).join('\n');
  }

  private parseResponse(content: string): AIResponse {
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析AI响应');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        from: parsed.from,
        to: parsed.to,
        thinking: parsed.thinking
      };
    } catch (error) {
      throw new Error(`解析AI响应失败: ${error}`);
    }
  }
}

/**
 * 百度文心一言提供商
 */
class QianFanProvider implements AIProvider {
  id = 'qiwens';
  name = '百度文心一言';

  async getMove(request: AIRequest, apiKey?: string): Promise<AIResponse> {
    const prompt = this.buildPrompt(request);

    // 文心一言使用 access_token
    const accessToken = apiKey || process.env.QIANFAN_ACCESS_TOKEN;

    const response = await fetch(
      `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`文心一言 API 错误: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data.result;

    return this.parseResponse(content);
  }

  private buildPrompt(request: AIRequest): string {
    const boardStr = this.boardToString(request.board);
    const historyStr = this.historyToString(request.history);
    const roleStr = request.role === 'red' ? '红方' : '黑方';

    return `你是一个中国象棋专家。当前棋盘状态：
${boardStr}

当前执子：${roleStr}

历史走法：
${historyStr || '无'}

请分析当前棋局，给出最佳走法。必须返回JSON格式：
{
  "from": {"x": 列号0-8, "y": 行号0-9},
  "to": {"x": 列号0-8, "y": 行号0-9},
  "thinking": "简要说明你的思考过程"
}`;
  }

  private boardToString(board: Board): string {
    const pieceNames: Record<PieceType, string> = {
      'k': '将',
      'a': '士',
      'b': '象',
      'n': '马',
      'r': '车',
      'c': '炮',
      'p': '兵'
    };

    const pieceNamesBlack: Record<PieceType, string> = {
      'k': '帅',
      'a': '仕',
      'b': '相',
      'n': '马',
      'r': '车',
      'c': '炮',
      'p': '卒'
    };

    let str = '   0 1 2 3 4 5 6 7 8\n';
    for (let y = 0; y < 10; y++) {
      str += y + ' ';
      for (let x = 0; x < 9; x++) {
        const piece = board[y][x];
        if (piece) {
          const name = piece.color === 'red' ? pieceNames[piece.type] : pieceNamesBlack[piece.type];
          str += name + ' ';
        } else {
          str += '· ';
        }
      }
      str += '\n';
    }
    return str;
  }

  private historyToString(history: Move[]): string {
    return history.map((move, index) => {
      return `${index + 1}. (${move.from.x},${move.from.y}) -> (${move.to.x},${move.to.y})`;
    }).join('\n');
  }

  private parseResponse(content: string): AIResponse {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析AI响应');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        from: parsed.from,
        to: parsed.to,
        thinking: parsed.thinking
      };
    } catch (error) {
      throw new Error(`解析AI响应失败: ${error}`);
    }
  }
}

/**
 * DeepSeek提供商
 */
class DeepSeekProvider implements AIProvider {
  id = 'deepseek';
  name = 'DeepSeek';

  async getMove(request: AIRequest, apiKey?: string): Promise<AIResponse> {
    const prompt = this.buildPrompt(request);

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey || process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个中国象棋专家。请分析棋局并返回最佳走法。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API 错误: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data.choices[0].message.content;

    return this.parseResponse(content);
  }

  private buildPrompt(request: AIRequest): string {
    const boardStr = this.boardToString(request.board);
    const historyStr = this.historyToString(request.history);
    const roleStr = request.role === 'red' ? '红方' : '黑方';

    return `当前棋盘状态：
${boardStr}

当前执子：${roleStr}

历史走法：
${historyStr || '无'}

请分析当前棋局，给出最佳走法。必须返回JSON格式：
{
  "from": {"x": 列号0-8, "y": 行号0-9},
  "to": {"x": 列号0-8, "y": 行号0-9},
  "thinking": "简要说明你的思考过程"
}`;
  }

  private boardToString(board: Board): string {
    const pieceNames: Record<PieceType, string> = {
      'k': '将',
      'a': '士',
      'b': '象',
      'n': '马',
      'r': '车',
      'c': '炮',
      'p': '兵'
    };

    const pieceNamesBlack: Record<PieceType, string> = {
      'k': '帅',
      'a': '仕',
      'b': '相',
      'n': '马',
      'r': '车',
      'c': '炮',
      'p': '卒'
    };

    let str = '   0 1 2 3 4 5 6 7 8\n';
    for (let y = 0; y < 10; y++) {
      str += y + ' ';
      for (let x = 0; x < 9; x++) {
        const piece = board[y][x];
        if (piece) {
          const name = piece.color === 'red' ? pieceNames[piece.type] : pieceNamesBlack[piece.type];
          str += name + ' ';
        } else {
          str += '· ';
        }
      }
      str += '\n';
    }
    return str;
  }

  private historyToString(history: Move[]): string {
    return history.map((move, index) => {
      return `${index + 1}. (${move.from.x},${move.from.y}) -> (${move.to.x},${move.to.y})`;
    }).join('\n');
  }

  private parseResponse(content: string): AIResponse {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析AI响应');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        from: parsed.from,
        to: parsed.to,
        thinking: parsed.thinking
      };
    } catch (error) {
      throw new Error(`解析AI响应失败: ${error}`);
    }
  }
}

/**
 * 自定义端点提供商
 */
class CustomProvider implements AIProvider {
  id = 'custom';
  name = '自定义端点';
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async getMove(request: AIRequest, apiKey?: string): Promise<AIResponse> {
    const prompt = this.buildPrompt(request);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`自定义端点 API 错误: ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || data.result || data.response;

    return this.parseResponse(content);
  }

  private buildPrompt(request: AIRequest): string {
    const boardStr = this.boardToString(request.board);
    const historyStr = this.historyToString(request.history);
    const roleStr = request.role === 'red' ? '红方' : '黑方';

    return `当前棋盘状态：
${boardStr}

当前执子：${roleStr}

历史走法：
${historyStr || '无'}

请分析当前棋局，给出最佳走法。必须返回JSON格式：
{
  "from": {"x": 列号0-8, "y": 行号0-9},
  "to": {"x": 列号0-8, "y": 行号0-9},
  "thinking": "简要说明你的思考过程"
}`;
  }

  private boardToString(board: Board): string {
    const pieceNames: Record<PieceType, string> = {
      'k': '将',
      'a': '士',
      'b': '象',
      'n': '马',
      'r': '车',
      'c': '炮',
      'p': '兵'
    };

    const pieceNamesBlack: Record<PieceType, string> = {
      'k': '帅',
      'a': '仕',
      'b': '相',
      'n': '马',
      'r': '车',
      'c': '炮',
      'p': '卒'
    };

    let str = '   0 1 2 3 4 5 6 7 8\n';
    for (let y = 0; y < 10; y++) {
      str += y + ' ';
      for (let x = 0; x < 9; x++) {
        const piece = board[y][x];
        if (piece) {
          const name = piece.color === 'red' ? pieceNames[piece.type] : pieceNamesBlack[piece.type];
          str += name + ' ';
        } else {
          str += '· ';
        }
      }
      str += '\n';
    }
    return str;
  }

  private historyToString(history: Move[]): string {
    return history.map((move, index) => {
      return `${index + 1}. (${move.from.x},${move.from.y}) -> (${move.to.x},${move.to.y})`;
    }).join('\n');
  }

  private parseResponse(content: string): AIResponse {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析AI响应');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        from: parsed.from,
        to: parsed.to,
        thinking: parsed.thinking
      };
    } catch (error) {
      throw new Error(`解析AI响应失败: ${error}`);
    }
  }
}

/**
 * AI适配器类
 * 管理多个AI提供商，提供统一的接口
 */
export class AIAdapter {
  private providers: Map<string, AIProvider>;
  private engine: ChessEngine;
  private timeout: number;
  private maxRetries: number;

  constructor(engine: ChessEngine, timeout: number = 30000, maxRetries: number = 3) {
    this.engine = engine;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.providers = new Map();

    // 注册默认提供商
    this.registerProvider(new OpenAIProvider());
    this.registerProvider(new QianFanProvider());
    this.registerProvider(new DeepSeekProvider());
  }

  /**
   * 注册AI提供商
   */
  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * 注册自定义端点
   */
  registerCustomEndpoint(id: string, endpoint: string): void {
    const provider = new CustomProvider(endpoint);
    (provider as any).id = id;
    (provider as any).name = `自定义 (${endpoint})`;
    this.providers.set(id, provider);
  }

  /**
   * 获取可用的模型列表
   */
  getAvailableModels(): AIModel[] {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
      provider: provider.id as any,
      requiresApiKey: provider.id !== 'custom'
    }));
  }

  /**
   * 获取AI走法
   * @param providerId AI提供商ID
   * @param request AI请求
   * @param apiKey API密钥（可选）
   * @returns AI响应
   */
  async getMove(providerId: string, request: AIRequest, apiKey?: string): Promise<AIResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`未找到AI提供商: ${providerId}`);
    }

    let lastError: Error | null = null;

    // 重试机制
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // 使用超时控制
        const response = await Promise.race([
          provider.getMove(request, apiKey),
          this.timeoutPromise(this.timeout)
        ]);

        // 验证AI返回的走法是否合法
        const validation = this.engine.validateMove(response.from, response.to);
        if (!validation.valid) {
          console.warn(`AI返回了非法走法: ${validation.reason}，尝试重试 (${attempt}/${this.maxRetries})`);
          if (attempt === this.maxRetries) {
            console.warn('AI多次返回非法走法，使用备用走法');
            return this.getFallbackMove(request);
          }
          continue;
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`AI调用失败 (尝试 ${attempt}/${this.maxRetries}):`, error);

        if (attempt === this.maxRetries) {
          console.warn('AI调用失败，使用备用走法');
          return this.getFallbackMove(request);
        }

        // 等待一段时间后重试
        await this.sleep(1000 * attempt);
      }
    }

    // 所有重试都失败，返回备用走法
    console.warn('所有AI调用尝试均失败，使用备用走法');
    return this.getFallbackMove(request);
  }

  /**
   * 获取备用走法（随机合法走法）
   * 当AI调用失败时使用
   */
  private getFallbackMove(request: AIRequest): AIResponse {
    console.log('生成备用走法...');

    // 创建临时引擎实例来查找合法走法
    const tempEngine = new ChessEngine();

    // 查找所有合法走法
    const legalMoves: Array<{ from: Position; to: Position }> = [];

    for (let fromY = 0; fromY < 10; fromY++) {
      for (let fromX = 0; fromX < 9; fromX++) {
        const piece = request.board[fromY][fromX];
        if (piece && piece.color === request.role) {
          const from = { x: fromX, y: fromY };

          // 尝试所有可能的目标位置
          for (let toY = 0; toY < 10; toY++) {
            for (let toX = 0; toX < 9; toX++) {
              const to = { x: toX, y: toY };
              const result = this.engine.validateMove(from, to);
              if (result.valid) {
                legalMoves.push({ from, to });
              }
            }
          }
        }
      }
    }

    if (legalMoves.length === 0) {
      throw new Error('没有可用的合法走法');
    }

    // 随机选择一个走法
    const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];

    return {
      from: randomMove.from,
      to: randomMove.to,
      thinking: 'AI调用失败，使用随机合法走法'
    };
  }

  /**
   * 超时Promise
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`请求超时 (${ms}ms)`)), ms);
    });
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
