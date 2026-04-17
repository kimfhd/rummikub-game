import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { logger, redisClient } from './config/redis';
import { registerRoomHandlers } from './handlers/roomHandler';
import { registerGameHandlers } from './handlers/gameHandler';
import { AuthenticatedSocket } from './types';
import { ServerEvents } from './shared/types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://110.40.136.217:3000',
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// 中间件
app.use(cors());
app.use(express.json());

// 健康检查端点
app.get('/health', async (req, res) => {
  const redisHealthy = await redisClient.ping().then(() => true).catch(() => false);
  
  res.json({
    status: redisHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      redis: redisHealthy ? 'up' : 'down',
      socketio: io.engine.clientsCount >= 0 ? 'up' : 'down'
    }
  });
});

// Socket.io 连接处理
io.on('connection', (socket: AuthenticatedSocket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.emit('connected', { socketId: socket.id });

  // 注册各个处理器
  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);
  // 断开连接处理
  socket.on('disconnect', (reason: string) => {
    logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
    
    // 延迟处理断线重连
    if (socket.data.currentRoom && socket.data.playerId) {
      setTimeout(async () => {
        const { RoomService } = await import('./services/RoomService');
        const room = await RoomService.getRoom(socket.data.currentRoom!);
        if (room) {
          const player = room.players.find(p => p.id === socket.data.playerId);
          if (player && !player.isOnline) {
            if (room.status === 'waiting') {
              await RoomService.leaveRoom(socket.data.currentRoom!, socket.data.playerId!);
              io.to(socket.data.currentRoom!).emit(ServerEvents.ROOM_UPDATED, room);
            }
          }
        }
      }, 30000);
    }
  });

  // Ping-Pong 保活
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await redisClient.connect();
    logger.info('Connected to Redis');
    
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisClient.quit();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});