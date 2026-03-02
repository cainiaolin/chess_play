import dotenv from 'dotenv';
import { App } from './app';

// 加载环境变量
dotenv.config();

// 从环境变量获取端口，默认3000
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// 创建并启动应用
const app = new App(PORT);
app.listen();

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM信号接收，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT信号接收，正在关闭服务器...');
  process.exit(0);
});

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});
