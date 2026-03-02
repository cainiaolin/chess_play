# AI适配器快速参考指南

## 快速开始

### 1. 创建AI适配器实例

```typescript
import { AIAdapter } from './services/ai-adapter';
import { ChessEngine } from './services/chess-engine';

const engine = new ChessEngine();
const aiAdapter = new AIAdapter(engine);
```

### 2. 获取可用模型

```typescript
const models = aiAdapter.getAvailableModels();
// 返回: AIModel[]
```

### 3. 获取AI走法

```typescript
const request: AIRequest = {
  board: engine.getBoard(),
  role: engine.getTurn(),
  history: engine.getMoves()
};

const response = await aiAdapter.getMove('openai', request);
// 返回: AIResponse { from, to, thinking? }
```

## 支持的提供商

| ID | 名称 | 需要API密钥 |
|---|---|---|
| `openai` | OpenAI (GPT-4) | 是 |
| `qiwens` | 百度文心一言 | 是 |
| `deepseek` | DeepSeek | 是 |

## 环境变量配置

```bash
OPENAI_API_KEY=sk-xxx
QIANFAN_ACCESS_TOKEN=xxx
DEEPSEEK_API_KEY=sk-xxx
```

## 自定义配置

```typescript
// 自定义超时和重试次数
const adapter = new AIAdapter(engine, 60000, 5);

// 注册自定义端点
adapter.registerCustomEndpoint('my-ai', 'https://api.example.com/v1/chat');

// 使用自定义API密钥
const response = await adapter.getMove('openai', request, 'custom-key');
```

## 错误处理

AI适配器自动处理：
- API调用失败 → 重试（最多3次）
- 返回非法走法 → 重试
- 所有尝试失败 → 返回随机合法走法

## 类型定义

```typescript
interface AIRequest {
  board: Board;          // 10x9棋盘数组
  role: 'red' | 'black';
  history: Move[];
}

interface AIResponse {
  from: Position;        // { x: 0-8, y: 0-9 }
  to: Position;          // { x: 0-8, y: 0-9 }
  thinking?: string;
}

interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'qiwens' | 'deepseek' | 'custom';
  requiresApiKey: boolean;
}
```

## 常见用法

### Express服务器集成

```typescript
app.post('/api/ai/move', async (req, res) => {
  const { providerId, apiKey } = req.body;
  const request = {
    board: engine.getBoard(),
    role: engine.getTurn(),
    history: engine.getMoves()
  };

  try {
    const move = await aiAdapter.getMove(providerId, request, apiKey);
    res.json({ success: true, move });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### AI对局

```typescript
while (engine.getStatus() === 'playing') {
  const request = {
    board: engine.getBoard(),
    role: engine.getTurn(),
    history: engine.getMoves()
  };

  const move = await aiAdapter.getMove(
    engine.getTurn() === 'red' ? 'openai' : 'deepseek',
    request
  );

  engine.makeMove(move.from, move.to);
}
```

## 调试技巧

1. **启用日志**：检查console输出
2. **验证走法**：使用 `engine.validateMove()`
3. **测试API**：先用简单请求测试API密钥
4. **调整超时**：增加超时时间观察行为

## 性能提示

- 缓存 `getAvailableModels()` 结果
- 实现请求队列避免并发过多
- 对相同棋盘状态缓存AI响应
- 根据需求调整超时时间

## 故障排查

| 问题 | 解决方案 |
|---|---|
| API调用失败 | 检查API密钥和网络 |
| 返回非法走法 | AI会自动重试 |
| 响应慢 | 增加超时时间 |
| 无可用走法 | 检查棋盘状态是否正确 |

## 更多信息

详细文档：`ai-adapter.README.md`
示例代码：`ai-adapter.example.ts`
测试文件：`ai-adapter.test.ts`
