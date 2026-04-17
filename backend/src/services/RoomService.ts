import { Room, CreateRoomDTO, JoinRoomDTO, Player, RoomSettings, ErrorCode } from '../shared/types';
import { RoomStore, generateRoomCode, logger } from '../config/redis';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 4,
  isPrivate: false,
  timeLimit: 120,
  allowSpectators: false
};

export class RoomService {
  // 创建房间
  static async createRoom(dto: CreateRoomDTO): Promise<{ room: Room; playerId: string }> {
    if (!dto.playerName || dto.playerName.length < 2) {
      throw { code: ErrorCode.NAME_TOO_SHORT, message: '昵称至少需要2个字符' };
    }

    const roomId = generateRoomCode();
    const playerId = uuidv4();

    // 确保房间码唯一
    let attempts = 0;
    while (await RoomStore.exists(roomId) && attempts < 10) {
      attempts++;
    }
    if (attempts >= 10) {
      throw { code: ErrorCode.NETWORK_ERROR, message: '生成房间失败，请重试' };
    }

    const player: Player = {
      id: playerId,
      name: dto.playerName.trim().substring(0, 20), // 限制长度
      hand: [[], []],
      hasBrokenIce: false,
      isOnline: true,
      joinedAt: Date.now(),
      score: 0
    };

    const room: Room = {
      id: roomId,
      hostId: playerId,
      status: 'waiting',
      players: [player],
      settings: {
        ...DEFAULT_SETTINGS,
        maxPlayers: dto.maxPlayers || 4,
        isPrivate: dto.isPrivate || false,
        timeLimit: dto.timeLimit || 120
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await RoomStore.set(roomId, room);
    logger.info(`Room created: ${roomId} by ${player.name}`);

    return { room, playerId };
  }

  // 加入房间
static async joinRoom(dto: JoinRoomDTO): Promise<{ room: Room; playerId: string; isRejoin: boolean }> {
    const { roomId, playerName } = dto;
    
    if (!playerName || playerName.length < 2) {
      throw { code: ErrorCode.NAME_TOO_SHORT, message: '昵称至少需要2个字符' };
    }

    const room = await RoomStore.get(roomId);
    if (!room) {
      throw { code: ErrorCode.ROOM_NOT_FOUND, message: '房间不存在' };
    }

    // 关键修复：检查是否已存在同名玩家（断线重连）
    const existingPlayer = room.players.find((p: Player) => p.name === playerName);
    
    if (existingPlayer) {
      // 更新在线状态，不重复添加
      existingPlayer.isOnline = true;
      await RoomStore.set(roomId, room);
      
      return { 
        room, 
        playerId: existingPlayer.id, 
        isRejoin: true 
      };
    }

    if (room.status === 'playing') {
      throw { code: ErrorCode.ROOM_ALREADY_STARTED, message: '游戏已开始，无法加入' };
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw { code: ErrorCode.ROOM_FULL, message: '房间已满' };
    }

    const playerId = uuidv4();
    const player: Player = {
      id: playerId,
      name: playerName.trim().substring(0, 20),
      hand: [[], []],
      hasBrokenIce: false,
      isOnline: true,
      joinedAt: Date.now(),
      score: 0
    };

    room.players.push(player);
    room.updatedAt = Date.now();
    
    await RoomStore.set(roomId, room);
    logger.info(`Player ${player.name} joined room ${roomId}`);

    return { room, playerId, isRejoin: false };
  }

  // 离开房间
  static async leaveRoom(roomId: string, playerId: string): Promise<{ room?: Room; deleted: boolean }> {
    const room = await RoomStore.get(roomId);
    if (!room) return { deleted: false };

    const playerIndex = room.players.findIndex((p: Player) => p.id === playerId);
    if (playerIndex === -1) return { deleted: false };

    const player = room.players[playerIndex];
    player.isOnline = false;

    // 如果游戏未开始，直接移除玩家
    if (room.status === 'waiting') {
      room.players.splice(playerIndex, 1);
      
      // 如果房主离开，转移房主
      if (room.hostId === playerId && room.players.length > 0) {
        room.hostId = room.players[0].id;
      }
    }

    // 如果房间空了，删除房间
    if (room.players.length === 0 || room.players.every((p: Player) => !p.isOnline)) {
      await RoomStore.delete(roomId);
      logger.info(`Room ${roomId} deleted (empty)`);
      return { deleted: true };
    }

    room.updatedAt = Date.now();
    await RoomStore.set(roomId, room);
    
    return { room, deleted: false };
  }

  // 获取房间信息
  static async getRoom(roomId: string): Promise<Room | null> {
    return await RoomStore.get(roomId);
  }

  // 更新设置（仅房主）
  static async updateSettings(
    roomId: string, 
    playerId: string, 
    settings: Partial<RoomSettings>
  ): Promise<Room> {
    const room = await RoomStore.get(roomId);
    if (!room) throw { code: ErrorCode.ROOM_NOT_FOUND, message: '房间不存在' };
    if (room.hostId !== playerId) {
      throw { code: ErrorCode.NOT_HOST, message: '只有房主可以修改设置' };
    }
    if (room.status !== 'waiting') {
      throw { code: ErrorCode.ROOM_ALREADY_STARTED, message: '游戏已开始' };
    }

    room.settings = { ...room.settings, ...settings };
    room.updatedAt = Date.now();
    
    await RoomStore.set(roomId, room);
    return room;
  }

  // 踢出玩家
  static async kickPlayer(roomId: string, hostId: string, targetPlayerId: string): Promise<Room> {
    const room = await RoomStore.get(roomId);
    if (!room) throw { code: ErrorCode.ROOM_NOT_FOUND, message: '房间不存在' };
    if (room.hostId !== hostId) {
      throw { code: ErrorCode.NOT_HOST, message: '只有房主可以踢人' };
    }

    const playerIndex = room.players.findIndex((p: Player) => p.id === targetPlayerId);
    if (playerIndex === -1) throw { code: ErrorCode.PLAYER_NOT_FOUND, message: '玩家不存在' };

    room.players.splice(playerIndex, 1);
    room.updatedAt = Date.now();
    
    await RoomStore.set(roomId, room);
    return room;
  }
}