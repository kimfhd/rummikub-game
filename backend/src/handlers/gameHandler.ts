import { ServerEvents, ClientEvents } from '../shared/types';
import { GameService } from '../services/GameService';
import { logger } from '../config/redis';
import { AuthenticatedSocket } from '../types';

export function registerGameHandlers(io: any, socket: AuthenticatedSocket): void {
  // 开始游戏
  socket.on(ClientEvents.START_GAME, async (callback: (res: any) => void) => {
    try {
      const roomId = socket.data.currentRoom;
      const playerId = socket.data.playerId;
      
      if (!roomId || !playerId) {
        return callback?.({ success: false, error: { message: '不在房间中' } });
      }

      const room = await GameService.startGame(roomId, playerId);
      
      // 广播游戏开始
      io.to(roomId).emit(ServerEvents.GAME_STARTED, {
        gameState: room.gameState
      });
      
      // 发送完整游戏状态给房间内所有人
      io.to(roomId).emit(ServerEvents.GAME_STATE, room.gameState);

      callback?.({ success: true, data: room.gameState });
      logger.info(`Game started in room ${roomId}`);
    } catch (error: any) {
      callback?.({ success: false, error: { code: error.code, message: error.message } });
    }
  });
}