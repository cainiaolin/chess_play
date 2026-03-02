import { Socket } from 'socket.io';
import { gameService } from '../services/game-service';

/**
 * 游戏WebSocket事件处理器
 * 处理游戏相关的实时事件
 */
export class GameHandler {
  constructor(private socket: Socket) {}

  /**
   * 注册所有游戏事件处理器
   */
  registerHandlers(): void {
    // 加入游戏房间
    this.socket.on('game:join', (data: { gameId: string }) => {
      this.handleJoinGame(data);
    });

    // 离开游戏房间
    this.socket.on('game:leave', (data: { gameId: string }) => {
      this.handleLeaveGame(data);
    });

    // 订阅游戏状态更新
    this.socket.on('game:subscribe', (data: { gameId: string }) => {
      this.handleSubscribe(data);
    });

    // 取消订阅游戏状态更新
    this.socket.on('game:unsubscribe', (data: { gameId: string }) => {
      this.handleUnsubscribe(data);
    });

    // 请求游戏状态
    this.socket.on('game:get-state', (data: { gameId: string }, callback) => {
      this.handleGetState(data, callback);
    });

    console.log(`Game handlers registered for socket: ${this.socket.id}`);
  }

  /**
   * 处理加入游戏房间
   */
  private handleJoinGame(data: { gameId: string }): void {
    const { gameId } = data;

    if (!gameId) {
      this.socket.emit('error', {
        code: 'MISSING_GAME_ID',
        message: '缺少游戏ID'
      });
      return;
    }

    const roomName = `game:${gameId}`;
    this.socket.join(roomName);

    // 获取游戏状态
    const gameState = gameService.getGameState(gameId);

    if (gameState) {
      // 通知客户端已加入游戏
      this.socket.emit('game:joined', {
        gameId,
        gameState
      });

      // 通知房间内其他玩家
      this.socket.to(roomName).emit('game:player-joined', {
        gameId,
        socketId: this.socket.id,
        timestamp: Date.now()
      });

      console.log(`Socket ${this.socket.id} joined game ${gameId}`);
    } else {
      this.socket.emit('error', {
        code: 'GAME_NOT_FOUND',
        message: `游戏不存在: ${gameId}`
      });
    }
  }

  /**
   * 处理离开游戏房间
   */
  private handleLeaveGame(data: { gameId: string }): void {
    const { gameId } = data;

    if (!gameId) {
      this.socket.emit('error', {
        code: 'MISSING_GAME_ID',
        message: '缺少游戏ID'
      });
      return;
    }

    const roomName = `game:${gameId}`;
    this.socket.leave(roomName);

    // 通知客户端已离开游戏
    this.socket.emit('game:left', {
      gameId,
      timestamp: Date.now()
    });

    // 通知房间内其他玩家
    this.socket.to(roomName).emit('game:player-left', {
      gameId,
      socketId: this.socket.id,
      timestamp: Date.now()
    });

    console.log(`Socket ${this.socket.id} left game ${gameId}`);
  }

  /**
   * 处理订阅游戏状态更新
   */
  private handleSubscribe(data: { gameId: string }): void {
    const { gameId } = data;

    if (!gameId) {
      this.socket.emit('error', {
        code: 'MISSING_GAME_ID',
        message: '缺少游戏ID'
      });
      return;
    }

    const roomName = `game:${gameId}`;
    this.socket.join(roomName);

    this.socket.emit('game:subscribed', {
      gameId,
      timestamp: Date.now()
    });

    console.log(`Socket ${this.socket.id} subscribed to game ${gameId}`);
  }

  /**
   * 处理取消订阅游戏状态更新
   */
  private handleUnsubscribe(data: { gameId: string }): void {
    const { gameId } = data;

    if (!gameId) {
      this.socket.emit('error', {
        code: 'MISSING_GAME_ID',
        message: '缺少游戏ID'
      });
      return;
    }

    const roomName = `game:${gameId}`;
    this.socket.leave(roomName);

    this.socket.emit('game:unsubscribed', {
      gameId,
      timestamp: Date.now()
    });

    console.log(`Socket ${this.socket.id} unsubscribed from game ${gameId}`);
  }

  /**
   * 处理获取游戏状态请求
   */
  private handleGetState(data: { gameId: string }, callback?: (response: any) => void): void {
    const { gameId } = data;

    if (!gameId) {
      const error = {
        code: 'MISSING_GAME_ID',
        message: '缺少游戏ID'
      };

      if (callback) {
        callback({ success: false, error });
      } else {
        this.socket.emit('error', error);
      }
      return;
    }

    const gameState = gameService.getGameState(gameId);

    if (gameState) {
      const response = {
        success: true,
        data: gameState
      };

      if (callback) {
        callback(response);
      } else {
        this.socket.emit('game:state', response);
      }
    } else {
      const error = {
        code: 'GAME_NOT_FOUND',
        message: `游戏不存在: ${gameId}`
      };

      if (callback) {
        callback({ success: false, error });
      } else {
        this.socket.emit('error', error);
      }
    }
  }
}

/**
 * 广播游戏状态更新到所有订阅者
 */
export function broadcastGameStateUpdate(
  io: any,
  gameId: string,
  gameState: any,
  move?: any,
  aiMove?: any
): void {
  const roomName = `game:${gameId}`;

  io.to(roomName).emit('game:state-update', {
    gameId,
    gameState,
    move,
    aiMove,
    timestamp: Date.now()
  });

  console.log(`Game state update broadcasted to room: ${roomName}`);
}

/**
 * 广播游戏结束事件
 */
export function broadcastGameEnd(
  io: any,
  gameId: string,
  status: string,
  winner?: string
): void {
  const roomName = `game:${gameId}`;

  io.to(roomName).emit('game:ended', {
    gameId,
    status,
    winner,
    timestamp: Date.now()
  });

  console.log(`Game end event broadcasted to room: ${roomName}`);
}
