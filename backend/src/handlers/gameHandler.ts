import { ServerEvents, ClientEvents, GameState, Meld, Tile } from '../shared/types';
import { GameService } from '../services/GameService';
import { logger } from '../config/redis';
import { AuthenticatedSocket } from '../types';

export function registerGameHandlers(io: any, socket: AuthenticatedSocket): void {
  socket.on(ClientEvents.START_GAME, async (callback: (res: any) => void) => {
    try {
      const roomId = socket.data.currentRoom;
      const playerId = socket.data.playerId;

      if (!roomId || !playerId) {
        return callback?.({ success: false, error: { message: '不在房间中' } });
      }

      const room = await GameService.startGame(roomId, playerId);

      io.to(roomId).emit(ServerEvents.GAME_STARTED, { gameState: room.gameState });
      io.to(roomId).emit(ServerEvents.GAME_STATE, room.gameState);

      callback?.({ success: true, data: room.gameState });
      logger.info(`Game started in room ${roomId}`);
    } catch (error: any) {
      callback?.({ success: false, error: { message: error.message } });
    }
  });

  socket.on(ClientEvents.DRAW_TILE, async (callback: (res: any) => void) => {
    try {
      const roomId = socket.data.currentRoom;
      const playerId = socket.data.playerId;

      if (!roomId || !playerId) {
        return callback?.({ success: false, error: { message: '不在房间中' } });
      }

      const room = await GameService.drawTile(roomId, playerId);

      io.to(roomId).emit(ServerEvents.GAME_STATE, room.gameState);

      callback?.({ success: true, data: room.gameState });
      logger.info(`Player ${playerId} drew tile in room ${roomId}`);
    } catch (error: any) {
      callback?.({ success: false, error: { message: error.message } });
    }
  });

  socket.on(ClientEvents.END_TURN, async (data: { board: Meld[]; hand: Tile[][]; hasBrokenIce: boolean }, callback: (res: any) => void) => {
    try {
      const roomId = socket.data.currentRoom;
      const playerId = socket.data.playerId;

      if (!roomId || !playerId) {
        return callback?.({ success: false, error: { message: '不在房间中' } });
      }

      const room = await GameService.endTurn(
        roomId,
        playerId,
        data.board,
        data.hand,
        data.hasBrokenIce
      );

      io.to(roomId).emit(ServerEvents.GAME_STATE, room.gameState);

      if (room.gameState?.status === 'finished') {
        io.to(roomId).emit(ServerEvents.GAME_OVER, { winnerId: room.gameState.winner });
      }

      callback?.({ success: true, data: room.gameState });
      logger.info(`Player ${playerId} ended turn in room ${roomId}`);
    } catch (error: any) {
      callback?.({ success: false, error: { message: error.message } });
    }
  });
}
