/**
 * AI适配器使用示例
 *
 * 此文件展示如何使用AIAdapter类来获取AI走法
 */

import { AIAdapter } from './ai-adapter';
import { ChessEngine } from './chess-engine';
import { AIRequest } from '../types/chess';

// 示例1：基本使用
async function basicExample() {
  // 创建象棋引擎实例
  const engine = new ChessEngine();

  // 创建AI适配器
  const aiAdapter = new AIAdapter(engine, 30000, 3);

  // 获取可用模型列表
  const models = aiAdapter.getAvailableModels();
  console.log('可用的AI模型:', models);

  // 构建AI请求
  const request: AIRequest = {
    board: engine.getBoard(),
    role: engine.getTurn(),
    history: engine.getMoves()
  };

  try {
    // 使用OpenAI获取走法
    const response = await aiAdapter.getMove('openai', request);
    console.log('AI走法:', response);
    console.log('从', response.from, '移动到', response.to);
    if (response.thinking) {
      console.log('思考过程:', response.thinking);
    }
  } catch (error) {
    console.error('获取AI走法失败:', error);
  }
}

// 示例2：使用不同的AI提供商
async function multipleProvidersExample() {
  const engine = new ChessEngine();
  const aiAdapter = new AIAdapter(engine);

  const request: AIRequest = {
    board: engine.getBoard(),
    role: engine.getTurn(),
    history: engine.getMoves()
  };

  // 使用OpenAI
  try {
    const openaiMove = await aiAdapter.getMove('openai', request);
    console.log('OpenAI走法:', openaiMove);
  } catch (error) {
    console.error('OpenAI调用失败:', error);
  }

  // 使用DeepSeek
  try {
    const deepseekMove = await aiAdapter.getMove('deepseek', request);
    console.log('DeepSeek走法:', deepseekMove);
  } catch (error) {
    console.error('DeepSeek调用失败:', error);
  }

  // 使用百度文心一言
  try {
    const qianfanMove = await aiAdapter.getMove('qiwens', request);
    console.log('文心一言走法:', qianfanMove);
  } catch (error) {
    console.error('文心一言调用失败:', error);
  }
}

// 示例3：使用自定义API密钥
async function customApiKeyExample() {
  const engine = new ChessEngine();
  const aiAdapter = new AIAdapter(engine);

  const request: AIRequest = {
    board: engine.getBoard(),
    role: engine.getTurn(),
    history: engine.getMoves()
  };

  // 使用自定义API密钥（不使用环境变量）
  const customApiKey = 'sk-your-custom-api-key';
  try {
    const response = await aiAdapter.getMove('openai', request, customApiKey);
    console.log('使用自定义密钥的AI走法:', response);
  } catch (error) {
    console.error('调用失败:', error);
  }
}

// 示例4：注册自定义端点
async function customEndpointExample() {
  const engine = new ChessEngine();
  const aiAdapter = new AIAdapter(engine);

  // 注册自定义端点
  aiAdapter.registerCustomEndpoint(
    'my-custom-ai',
    'https://my-ai-endpoint.com/v1/chat/completions'
  );

  const request: AIRequest = {
    board: engine.getBoard(),
    role: engine.getTurn(),
    history: engine.getMoves()
  };

  try {
    const response = await aiAdapter.getMove('my-custom-ai', request, 'my-api-key');
    console.log('自定义端点AI走法:', response);
  } catch (error) {
    console.error('自定义端点调用失败:', error);
  }
}

// 示例5：在Express服务器中使用
// 注意：实际使用时需要安装 express 和 cors
// import express from 'express';
// import cors from 'cors';

function serverExample() {
  const app = express();
  const engine = new ChessEngine();
  const aiAdapter = new AIAdapter(engine);

  app.use(cors());
  app.use(express.json());

  // 获取AI走法的API端点
  app.post('/api/ai/move', async (req, res) => {
    try {
      const { providerId, apiKey } = req.body;

      const request: AIRequest = {
        board: engine.getBoard(),
        role: engine.getTurn(),
        history: engine.getMoves()
      };

      const response = await aiAdapter.getMove(providerId, request, apiKey);

      res.json({
        success: true,
        move: response
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 获取可用模型列表的API端点
  app.get('/api/ai/models', (req, res) => {
    const models = aiAdapter.getAvailableModels();
    res.json({
      success: true,
      models
    });
  });

  app.listen(3000, () => {
    console.log('服务器运行在 http://localhost:3000');
  });
}

// 示例6：处理AI失败的情况
async function errorHandlingExample() {
  const engine = new ChessEngine();
  const aiAdapter = new AIAdapter(engine, 10000, 2); // 10秒超时，最多重试2次

  const request: AIRequest = {
    board: engine.getBoard(),
    role: engine.getTurn(),
    history: engine.getMoves()
  };

  try {
    // 使用不存在的提供商
    const response = await aiAdapter.getMove('non-existent', request);
    console.log('走法:', response);
  } catch (error) {
    console.error('错误:', error);

    // AIAdapter会自动返回备用走法（随机合法走法）
    // 所以这里不太可能抛出异常，除非没有任何合法走法
  }
}

// 示例7：在游戏循环中使用
async function gameLoopExample() {
  const engine = new ChessEngine();
  const aiAdapter = new AIAdapter(engine);

  // 模拟AI对局
  while (engine.getStatus() === 'playing') {
    const request: AIRequest = {
      board: engine.getBoard(),
      role: engine.getTurn(),
      history: engine.getMoves()
    };

    try {
      // 红方使用OpenAI
      if (engine.getTurn() === 'red') {
        const redMove = await aiAdapter.getMove('openai', request);
        engine.makeMove(redMove.from, redMove.to);
        console.log('红方走法:', redMove);
      }
      // 黑方使用DeepSeek
      else {
        const blackMove = await aiAdapter.getMove('deepseek', request);
        engine.makeMove(blackMove.from, blackMove.to);
        console.log('黑方走法:', blackMove);
      }

      // 检查游戏状态
      console.log('游戏状态:', engine.getStatus());

      // 避免无限循环，实际应用中应该有其他终止条件
      if (engine.getMoves().length >= 10) {
        console.log('演示结束，已走10步');
        break;
      }
    } catch (error) {
      console.error('游戏出错:', error);
      break;
    }
  }
}

// 导出示例函数
export {
  basicExample,
  multipleProvidersExample,
  customApiKeyExample,
  customEndpointExample,
  serverExample,
  errorHandlingExample,
  gameLoopExample
};

// 如果直接运行此文件，执行基本示例
if (require.main === module) {
  basicExample().catch(console.error);
}
