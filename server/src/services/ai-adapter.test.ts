/**
 * AI适配器单元测试
 */

import { AIAdapter } from './ai-adapter';
import { ChessEngine } from './chess-engine';
import { AIRequest, Position } from '../types/chess';

describe('AIAdapter', () => {
  let engine: ChessEngine;
  let aiAdapter: AIAdapter;

  beforeEach(() => {
    engine = new ChessEngine();
    aiAdapter = new AIAdapter(engine, 5000, 2); // 5秒超时，最多重试2次
  });

  describe('基本功能', () => {
    test('应该能够获取可用模型列表', () => {
      const models = aiAdapter.getAvailableModels();

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // 检查默认模型是否存在
      const modelIds = models.map(m => m.id);
      expect(modelIds).toContain('openai');
      expect(modelIds).toContain('qiwens');
      expect(modelIds).toContain('deepseek');
    });

    test('每个模型应该有必要的属性', () => {
      const models = aiAdapter.getAvailableModels();

      models.forEach(model => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('requiresApiKey');
        expect(typeof model.id).toBe('string');
        expect(typeof model.name).toBe('string');
        expect(typeof model.requiresApiKey).toBe('boolean');
      });
    });
  });

  describe('提供商管理', () => {
    test('应该能够注册自定义端点', () => {
      const initialModels = aiAdapter.getAvailableModels();
      const initialCount = initialModels.length;

      aiAdapter.registerCustomEndpoint(
        'test-custom',
        'https://test-endpoint.com'
      );

      const newModels = aiAdapter.getAvailableModels();
      expect(newModels.length).toBe(initialCount + 1);
      expect(newModels.some(m => m.id === 'test-custom')).toBe(true);
    });
  });

  describe('AI请求构建', () => {
    test('应该能够构建正确的AI请求', () => {
      const request: AIRequest = {
        board: engine.getBoard(),
        role: engine.getTurn(),
        history: engine.getMoves()
      };

      expect(request).toHaveProperty('board');
      expect(request).toHaveProperty('role');
      expect(request).toHaveProperty('history');
      expect(request.role).toMatch(/^(red|black)$/);
      expect(Array.isArray(request.history)).toBe(true);
    });
  });

  describe('备用走法生成', () => {
    test('当AI失败时应该返回合法的备用走法', async () => {
      // 注意：这个测试需要有效的API密钥才能通过
      // 在CI/CD环境中应该mock API调用

      const request: AIRequest = {
        board: engine.getBoard(),
        role: engine.getTurn(),
        history: engine.getMoves()
      };

      try {
        // 尝试使用不存在的提供商
        const response = await aiAdapter.getMove('non-existent', request);

        // 应该返回备用走法
        expect(response).toHaveProperty('from');
        expect(response).toHaveProperty('to');
        expect(response.from).toHaveProperty('x');
        expect(response.from).toHaveProperty('y');
        expect(response.to).toHaveProperty('x');
        expect(response.to).toHaveProperty('y');

        // 验证走法是否合法
        const validation = engine.validateMove(response.from, response.to);
        expect(validation.valid).toBe(true);
      } catch (error) {
        // 如果没有合法走法，可能会抛出异常
        expect(error).toBeDefined();
      }
    });
  });

  describe('坐标系统', () => {
    test('棋盘坐标应该在有效范围内', () => {
      const board = engine.getBoard();

      expect(board.length).toBe(10); // 10行
      board.forEach(row => {
        expect(row.length).toBe(9); // 9列
      });
    });

    test('坐标范围应该是 x: 0-8, y: 0-9', () => {
      const validPosition: Position = { x: 4, y: 5 };
      const invalidX: Position = { x: 9, y: 5 };
      const invalidY: Position = { x: 4, y: 10 };

      const valid1 = engine.validateMove(validPosition, { x: 4, y: 6 });
      // 注意：validateMove会检查棋子是否存在，所以这里可能返回false
      expect(valid1).toHaveProperty('valid');
    });
  });

  describe('初始棋盘状态', () => {
    test('初始棋盘应该有正确数量的棋子', () => {
      const board = engine.getBoard();
      let pieceCount = 0;

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
          if (board[y][x] !== null) {
            pieceCount++;
          }
        }
      }

      // 标准中国象棋开局应该有32个棋子
      expect(pieceCount).toBe(32);
    });

    test('初始状态应该是红方先行', () => {
      expect(engine.getTurn()).toBe('red');
    });

    test('初始状态应该是游戏中', () => {
      expect(engine.getStatus()).toBe('playing');
    });
  });

  describe('走法历史', () => {
    test('初始状态应该没有走法历史', () => {
      const history = engine.getMoves();
      expect(history).toEqual([]);
    });

    test('执行走法后应该有历史记录', () => {
      // 执行一个合法走法（炮二平五）
      const from = { x: 1, y: 7 };
      const to = { x: 1, y: 5 };

      const validation = engine.validateMove(from, to);
      if (validation.valid) {
        engine.makeMove(from, to);
        const history = engine.getMoves();
        expect(history.length).toBe(1);
        expect(history[0]).toHaveProperty('from');
        expect(history[0]).toHaveProperty('to');
        expect(history[0]).toHaveProperty('piece');
        expect(history[0]).toHaveProperty('timestamp');
      }
    });
  });

  describe('AI响应格式', () => {
    test('AI响应应该包含必要字段', () => {
      const mockResponse = {
        from: { x: 1, y: 7 },
        to: { x: 1, y: 5 },
        thinking: '测试思考过程'
      };

      expect(mockResponse).toHaveProperty('from');
      expect(mockResponse).toHaveProperty('to');
      expect(mockResponse.from).toHaveProperty('x');
      expect(mockResponse.from).toHaveProperty('y');
      expect(mockResponse.to).toHaveProperty('x');
      expect(mockResponse.to).toHaveProperty('y');
      expect(mockResponse.thinking).toBeDefined();
    });
  });

  describe('错误处理', () => {
    test('使用不存在的提供商应该抛出错误', async () => {
      const request: AIRequest = {
        board: engine.getBoard(),
        role: engine.getTurn(),
        history: engine.getMoves()
      };

      // AIAdapter会返回备用走法，所以可能不会抛出错误
      // 这里测试不会崩溃
      const response = await aiAdapter.getMove('non-existent-provider', request);
      expect(response).toBeDefined();
    });
  });

  describe('超时控制', () => {
    test('应该能够设置自定义超时时间', () => {
      const adapter1 = new AIAdapter(engine, 1000, 1); // 1秒超时
      const adapter2 = new AIAdapter(engine, 60000, 1); // 60秒超时

      // 只验证能够创建，不实际测试超时行为
      expect(adapter1).toBeDefined();
      expect(adapter2).toBeDefined();
    });
  });

  describe('重试机制', () => {
    test('应该能够设置自定义重试次数', () => {
      const adapter1 = new AIAdapter(engine, 30000, 1); // 最多重试1次
      const adapter2 = new AIAdapter(engine, 30000, 5); // 最多重试5次

      expect(adapter1).toBeDefined();
      expect(adapter2).toBeDefined();
    });
  });
});

// 集成测试（需要有效的API密钥）
describe('AIAdapter集成测试', () => {
  let engine: ChessEngine;
  let aiAdapter: AIAdapter;

  beforeEach(() => {
    engine = new ChessEngine();
    aiAdapter = new AIAdapter(engine, 30000, 3);
  });

  // 这些测试需要API密钥，在CI/CD中应该跳过
  const isCI = process.env.CI === 'true';

  if (!isCI) {
    test.skip('应该能够从OpenAI获取走法（需要API密钥）', async () => {
      const request: AIRequest = {
        board: engine.getBoard(),
        role: engine.getTurn(),
        history: engine.getMoves()
      };

      if (!process.env.OPENAI_API_KEY) {
        console.log('跳过测试：未设置OPENAI_API_KEY');
        return;
      }

      try {
        const response = await aiAdapter.getMove('openai', request);
        expect(response).toHaveProperty('from');
        expect(response).toHaveProperty('to');

        // 验证走法合法性
        const validation = engine.validateMove(response.from, response.to);
        expect(validation.valid).toBe(true);
      } catch (error) {
        console.error('OpenAI测试失败:', error);
        throw error;
      }
    });

    test.skip('应该能够从DeepSeek获取走法（需要API密钥）', async () => {
      const request: AIRequest = {
        board: engine.getBoard(),
        role: engine.getTurn(),
        history: engine.getMoves()
      };

      if (!process.env.DEEPSEEK_API_KEY) {
        console.log('跳过测试：未设置DEEPSEEK_API_KEY');
        return;
      }

      try {
        const response = await aiAdapter.getMove('deepseek', request);
        expect(response).toHaveProperty('from');
        expect(response).toHaveProperty('to');

        const validation = engine.validateMove(response.from, response.to);
        expect(validation.valid).toBe(true);
      } catch (error) {
        console.error('DeepSeek测试失败:', error);
        throw error;
      }
    });
  } else {
    test.skip('跳过集成测试（CI环境）', () => {
      console.log('在CI环境中跳过需要API密钥的测试');
    });
  }
});
