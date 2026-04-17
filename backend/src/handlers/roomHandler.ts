import { RoomService } from '../services/RoomService';
import { 
  ServerEvents, 
  CreateRoomDTO, 
  JoinRoomDTO,
  Player
} from '../shared/types';
import { logger } from '../config/redis';
import { AuthenticatedSocket } from '../types';

// 本地定义事件名和错误码（避免导入问题）
const ClientEvents = {
  CREATE_ROOM: 'room:create',
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',
  GET_ROOM_INFO: 'room:info',
  UPDATE_SETTINGS: 'room:settings',
  START_GAME: 'room:start',
  PING: 'ping'
} as const;

const ErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_ALREADY_STARTED: 'ROOM_ALREADY_STARTED',
  INVALID_ROOM_CODE: 'INVALID_ROOM_CODE',
  NOT_HOST: 'NOT_HOST',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  INVALID_MOVE: 'INVALID_MOVE',
  NOT_BROKEN_ICE: 'NOT_BROKEN_ICE',
  INVALID_MELD: 'INVALID_MELD',
  GAME_NOT_STARTED: 'GAME_NOT_STARTED',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  NAME_TOO_SHORT: 'NAME_TOO_SHORT'
} as const;

export function registerRoomHandlers(io: any, socket: AuthenticatedSocket): void {
  // 创建房间
  socket.on(ClientEvents.CREATE_ROOM, async (data: CreateRoomDTO, callback: (res: any) => void) => {
    try {
      const { room, playerId } = await RoomService.createRoom(data);
      
      socket.data.playerId = playerId;
      socket.data.playerName = data.playerName;
      
      await socket.join(room.id);
      
      callback({
        success: true,
        data: { room, playerId }
      });

      io.to(room.id).emit(ServerEvents.PLAYER_JOINED, {
        player: room.players[0]
      });

      logger.info(`Room ${room.id} created by ${data.playerName}`);
    } catch (error: any) {
      callback({
        success: false,
        error: {
          code: error.code || ErrorCode.NETWORK_ERROR,
          message: error.message
        }
      });
    }
  });

  // 加入房间（关键修改在此）
  socket.on(ClientEvents.JOIN_ROOM, async (data: JoinRoomDTO, callback: (res: any) => void) => {
    try {
      const { room, playerId, isRejoin } = await RoomService.joinRoom(data);
      
      socket.data.playerId = playerId;
      socket.data.playerName = data.playerName;
      socket.data.currentRoom = room.id;
      
      await socket.join(room.id);
      
      callback({
        success: true,
        data: { room, playerId, isRejoin }
      });

      const player = room.players.find((p: Player) => p.id === playerId);
      
      // 关键修改 1：广播给房间内所有人（包括房主）
      io.to(room.id).emit(ServerEvents.PLAYER_JOINED, { player });
      
      // 关键修改 2：广播完整房间状态，确保所有人同步
      io.to(room.id).emit(ServerEvents.ROOM_UPDATED, room);

      logger.info(`Player ${data.playerName} joined room ${room.id}`);
    } catch (error: any) {
      callback({
        success: false,
        error: {
          code: error.code || ErrorCode.NETWORK_ERROR,
          message: error.message
        }
      });
    }
  });

  // 离开房间
  socket.on(ClientEvents.LEAVE_ROOM, async (callback?: (res: any) => void) => {
    const roomId = socket.data.currentRoom;
    const playerId = socket.data.playerId;
    
    if (!roomId || !playerId) {
      callback?.({ success: false });
      return;
    }

    try {
      const { room, deleted } = await RoomService.leaveRoom(roomId, playerId);
      
      socket.leave(roomId);
      socket.data.currentRoom = undefined;
      
      callback?.({ success: true });

      if (!deleted && room) {
        io.to(roomId).emit(ServerEvents.PLAYER_LEFT, {
          playerId,
          newHostId: room.hostId !== playerId ? room.hostId : undefined
        });
        io.to(roomId).emit(ServerEvents.ROOM_UPDATED, room);
      }

      logger.info(`Player left room ${roomId}`);
    } catch (error) {
      callback?.({ success: false });
    }
  });

  // 获取房间信息
  socket.on(ClientEvents.GET_ROOM_INFO, async (roomId: string, callback: (res: any) => void) => {
    try {
      const room = await RoomService.getRoom(roomId);
      if (!room) {
        callback({ success: false, error: { code: ErrorCode.ROOM_NOT_FOUND } });
        return;
      }
      callback({ success: true, data: room });
    } catch (error) {
      callback({ success: false });
    }
  });

  // 更新设置
  socket.on(ClientEvents.UPDATE_SETTINGS, async (settings: any, callback?: (res: any) => void) => {
    const roomId = socket.data.currentRoom;
    const playerId = socket.data.playerId;
    
    if (!roomId || !playerId) return;

    try {
      const room = await RoomService.updateSettings(roomId, playerId, settings);
      io.to(roomId).emit(ServerEvents.SETTINGS_UPDATED, room.settings);
      io.to(roomId).emit(ServerEvents.ROOM_UPDATED, room);
      callback?.({ success: true });
    } catch (error: any) {
      callback?.({
        success: false,
        error: { code: error.code, message: error.message }
      });
    }
  });

  // 开始游戏
  socket.on(ClientEvents.START_GAME, async (callback?: (res: any) => void) => {
    const roomId = socket.data.currentRoom;
    const playerId = socket.data.playerId;
    
    if (!roomId || !playerId) {
      callback?.({ success: false, error: { message: 'Not in room' } });
      return;
    }

    callback?.({ success: false, error: { message: 'Game start not implemented yet' } });
  });

  // Ping
  socket.on(ClientEvents.PING, () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
}