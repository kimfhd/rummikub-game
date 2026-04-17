import { Room, GameState, Player, Tile, Meld, GameStatus } from '../shared/types';
import { RoomStore } from '../config/redis';
import { Deck } from '../models/Deck';
import { v4 as uuidv4 } from 'uuid';

export class GameService {
  // 开始游戏
  static async startGame(roomId: string, hostId: string): Promise<Room> {
    const room = await RoomStore.get(roomId);
    if (!room) throw { code: 'ROOM_NOT_FOUND', message: '房间不存在' };
    if (room.hostId !== hostId) throw { code: 'NOT_HOST', message: '只有房主可以开始' };
    if (room.players.length < 2) throw { code: 'NOT_ENOUGH_PLAYERS', message: '至少需要2人' };
    if (room.status !== 'waiting') throw { code: 'ALREADY_STARTED', message: '游戏已开始' };

    // 初始化牌堆
    const deck = new Deck();
    
    // 发14张牌给每个玩家
    const players = room.players.map(p => ({
      ...p,
      hand: [deck.draw(7), deck.draw(7)],
      hasBrokenIce: false,
      score: 0
    }));

    // 构建初始游戏状态
    const gameState: GameState = {
      roomId,
      status: 'playing',
      players,
      board: [],
      deck: deck.toJSON(),
      currentTurn: players[0].id,
      turnStartTime: Date.now(),
      turnDuration: room.settings.timeLimit || 120,
      round: 1
    };

    room.status = 'playing';
    room.gameState = gameState;
    room.updatedAt = Date.now();

    await RoomStore.set(roomId, room);
    return room;
  }

  // 获取当前游戏状态（同步给玩家）
  static async getGameState(roomId: string): Promise<GameState | null> {
    const room = await RoomStore.get(roomId);
    return room?.gameState || null;
  }
}