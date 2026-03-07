import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { gameRouter } from './routes/game';
import { GameHandler } from './socket/game-handler';
import { gameService } from './services/game-service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Express应用配置
 */
export class App {
  public app: Application;
  public server: HttpServer;
  public io: SocketIOServer;
  public port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // 设置Socket.IO实例到游戏服务
    gameService.setIO(this.io);

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSocket();
    this.initializeErrorHandling();
  }

  /**
   * 初始化中间件
   */
  private initializeMiddlewares(): void {
    // CORS配置
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // JSON解析
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // 请求日志
    this.app.use((req: Request, res: Response, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * 初始化路由
   */
  private initializeRoutes(): void {
    // 静态文件服务（前端构建产物）
    this.app.use(express.static(path.join(__dirname, '../public')));

    // 健康检查端点
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // 游戏API路由
    this.app.use('/api/game', gameRouter);

    // SPA fallback
    this.app.get('*', (req: Request, res: Response) => {
      if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
      } else {
        res.status(404).json({
          error: 'Not Found',
          message: `Route ${req.method} ${req.path} not found`,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * 初始化Socket.IO
   */
  private initializeSocket(): void {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // 注册游戏事件处理器
      const gameHandler = new GameHandler(socket);
      gameHandler.registerHandlers();

      // 断开连接
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * 初始化错误处理
   */
  private initializeErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: any) => {
      console.error('Error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * 启动服务器
   */
  public listen(): void {
    this.server.listen(this.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║           中国象棋游戏服务器                            ║
╠═══════════════════════════════════════════════════════╣
║  服务器地址: http://localhost:${this.port}                    ║
║  健康检查:   http://localhost:${this.port}/health              ║
║  API端点:   http://localhost:${this.port}/api/game             ║
╠═══════════════════════════════════════════════════════╣
║  服务器正在运行...                                    ║
║  按 Ctrl+C 停止服务器                                 ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  }

  /**
   * 获取Socket.IO实例
   */
  public getIO(): SocketIOServer {
    return this.io;
  }
}
