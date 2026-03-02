# AI适配器 (AI Adapter)

## 概述

AI适配器是一个统一的接口，用于集成多个AI模型提供商来获取中国象棋走法。它支持多种AI提供商，并提供了超时控制、重试机制和备用走法等健壮性功能。

## 支持的AI提供商

1. **OpenAI (GPT-4)** - 使用GPT-4模型
2. **百度文心一言** - 使用百度千帆平台
3. **DeepSeek** - 使用DeepSeek模型
4. **自定义端点** - 支持任何兼容OpenAI API格式的端点

## 核心功能

### 1. 统一的AI接口

```typescript
import { AIAdapter } from './services/ai-adapter';
import { ChessEngine } from './services/chess-engine';

const engine = new ChessEngine();
const aiAdapter = new AIAdapter(engine);

// 获取可用模型
const models = aiAdapter.getAvailableModels();
console.log(models);
// 输出:
// [
//   { id: 'openai', name: 'OpenAI (GPT-4)', provider: 'openai', requiresApiKey: true },
//   { id: 'qiwens', name: '百度文心一言', provider: 'qiwens', requiresApiKey: true },
//   { id: 'deepseek', name: 'DeepSeek', provider: 'deepseek', requiresApiKey: true }
// ]
```

### 2. 获取AI走法

```typescript
const request: AIRequest = {
  board: engine.getBoard(),
  role: engine.getTurn(),
  history: engine.getMoves()
};

const response = await aiAdapter.getMove('openai', request);
console.log(response);
// 输出:
// {
//   from: { x: 1, y: 7 },
//   to: { x: 2, y: 7 },
//   thinking: '前进马，控制中心'
// }
```

### 3. 超时控制

默认超时时间为30秒，可以在构造函数中自定义：

```typescript
const aiAdapter = new AIAdapter(engine, 60000); // 60秒超时
```

### 4. 重试机制

默认最多重试3次，可以在构造函数中自定义：

```typescript
const aiAdapter = new AIAdapter(engine, 30000, 5); // 最多重试5次
```

### 5. 备用走法

当AI调用失败或返回非法走法时，系统会自动生成随机合法走法作为备用方案，确保游戏能够继续进行。

## 配置

### 环境变量

在 `.env` 文件中配置API密钥：

```bash
# OpenAI配置
OPENAI_API_KEY=sk-your-openai-key

# 百度文心一言配置
QIANFAN_ACCESS_TOKEN=your-qianfan-token

# DeepSeek配置
DEEPSEEK_API_KEY=sk-your-deepseek-key

# 自定义端点（可选）
CUSTOM_AI_ENDPOINT=https://your-endpoint.com
CUSTOM_API_KEY=your-custom-key
```

### 自定义端点

可以注册自定义的AI端点：

```typescript
aiAdapter.registerCustomEndpoint(
  'my-ai',
  'https://my-ai-endpoint.com/v1/chat/completions'
);

// 使用自定义端点
const response = await aiAdapter.getMove('my-ai', request, 'api-key');
```

## AI请求/响应格式

### AIRequest

```typescript
interface AIRequest {
  board: Board;        // 当前棋盘状态 (10x9二维数组)
  role: 'red' | 'black';  // 当前执子方
  history: Move[];     // 历史走法
}
```

### AIResponse

```typescript
interface AIResponse {
  from: Position;      // 起始位置 {x, y}
  to: Position;        // 目标位置 {x, y}
  thinking?: string;   // AI思考过程（可选）
}
```

## 棋盘可视化

AI适配器会将棋盘状态转换为中文可视化格式发送给AI：

```
   0 1 2 3 4 5 6 7 8
0  车 马 象 士 将 士 象 马 车
1  · · · · · · · · ·
2  · 炮 · · · · · 炮 ·
3  卒 · 卒 · 卒 · 卒 · 卒
4  · · · · · · · · ·
5  · · · · · · · · ·
6  兵 · 兵 · 兵 · 兵 · 兵
7  · 炮 · · · · · 炮 ·
8  · · · · · · · · ·
9  车 马 相 仕 帅 仕 相 马 车
```

## 错误处理

AI适配器提供了多层错误处理：

1. **API调用失败** - 自动重试最多3次
2. **返回非法走法** - 通知AI重新生成
3. **所有尝试失败** - 返回随机合法走法
4. **超时控制** - 30秒后自动取消请求

## 示例代码

详细的示例代码请参考 `ai-adapter.example.ts` 文件，包含：

- 基本使用示例
- 多提供商示例
- 自定义API密钥示例
- 自定义端点示例
- Express服务器集成示例
- 错误处理示例
- 游戏循环示例

## 扩展新的AI提供商

要添加新的AI提供商，需要实现 `AIProvider` 接口：

```typescript
interface AIProvider {
  id: string;
  name: string;
  getMove(request: AIRequest, apiKey?: string): Promise<AIResponse>;
}
```

示例：

```typescript
class MyCustomProvider implements AIProvider {
  id = 'my-custom';
  name = '我的自定义AI';

  async getMove(request: AIRequest, apiKey?: string): Promise<AIResponse> {
    // 实现你的AI调用逻辑
    // 1. 构建提示词
    // 2. 调用AI API
    // 3. 解析响应
    // 4. 返回AIResponse
  }
}

// 注册提供商
aiAdapter.registerProvider(new MyCustomProvider());
```

## 性能优化建议

1. **缓存模型列表** - `getAvailableModels()` 结果可以缓存
2. **并发控制** - 对于多个AI请求，考虑使用队列限流
3. **响应缓存** - 对于相同的棋盘状态，可以缓存AI响应
4. **超时调整** - 根据实际情况调整超时时间

## 安全建议

1. **API密钥保护** - 不要在代码中硬编码API密钥
2. **输入验证** - 始终验证AI返回的走法是否合法
3. **速率限制** - 实现API调用速率限制，避免超配额
4. **日志记录** - 记录所有AI调用，便于调试和监控

## 故障排查

### 问题：AI调用失败

**可能原因：**
- API密钥未设置或无效
- 网络连接问题
- API服务暂时不可用
- 超时时间过短

**解决方案：**
- 检查 `.env` 文件中的API密钥
- 增加超时时间
- 检查网络连接
- 查看错误日志

### 问题：AI返回非法走法

**可能原因：**
- AI理解错误坐标系统
- AI不了解象棋规则

**解决方案：**
- AI适配器会自动重试
- 如果多次失败，会返回随机合法走法

### 问题：响应时间过长

**可能原因：**
- AI服务响应慢
- 网络延迟

**解决方案：**
- 减少超时时间
- 使用更快的AI模型
- 实现异步处理

## 许可证

MIT
