import { Room, GameState, Player, Meld, Tile } from '../shared/types';
import { RoomStore } from '../config/redis';
import { Deck } from '../models/Deck';
import { GameValidator } from '../utils/validators';
import { v4 as uuidv4 } from 'uuid';

export class GameService {
  static async startGame(roomId: string, hostId: string): Promise<Room> {
    const room = await RoomStore.get(roomId);
    if (!room) throw { code: 'ROOM_NOT_FOUND', message: '房间不存在' };
    if (room.hostId !== hostId) throw { code: 'NOT_HOST', message: '只有房主可以开始' };
    if (room.players.length < 2) throw { code: 'NOT_ENOUGH', message: '至少需要2人' };
    if (room.status !== 'waiting') throw { code: 'ALREADY_STARTED', message: '游戏已开始' };

    const deck = new Deck();

    const players = room.players.map((p: Player) => ({
      ...p,
      hand: [deck.draw(7), deck.draw(7)],
      hasBrokenIce: false,
      score: 0
    }));

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

  static async drawTile(roomId: string, playerId: string): Promise<Room> {
    const room = await RoomStore.get(roomId);
    if (!room) throw { code: 'ROOM_NOT_FOUND', message: '房间不存在' };
    if (!room.gameState) throw { code: 'GAME_NOT_STARTED', message: '游戏未开始' };
    if (room.gameState.currentTurn !== playerId) throw { code: 'NOT_YOUR_TURN', message: '不是你的回合' };

    const player = room.gameState.players.find((p: Player) => p.id === playerId);
    if (!player) throw { code: 'PLAYER_NOT_FOUND', message: '玩家不存在' };

    // 从牌堆抽一张牌
    if (room.gameState.deck.length === 0) {
      throw { code: 'DECK_EMPTY', message: '牌堆已空' };
    }
    const tile = room.gameState.deck.pop()!;
    tile.isNew = false;
    tile.isJustDrawn = true;
    player.hand[1].push(tile);

    // 切换到下一位玩家
    const currentIndex = room.gameState.players.findIndex((p: Player) => p.id === playerId);
    const nextIndex = (currentIndex + 1) % room.gameState.players.length;
    room.gameState.currentTurn = room.gameState.players[nextIndex].id;
    room.gameState.turnStartTime = Date.now();
    room.gameState.round += 1;
    room.updatedAt = Date.now();

    await RoomStore.set(roomId, room);
    return room;
  }

  static async endTurn(
    roomId: string,
    playerId: string,
    board: Meld[],
    hand: Tile[][],
    hasBrokenIce: boolean
  ): Promise<Room> {
    const room = await RoomStore.get(roomId);
    if (!room) throw { code: 'ROOM_NOT_FOUND', message: '房间不存在' };
    if (!room.gameState) throw { code: 'GAME_NOT_STARTED', message: '游戏未开始' };
    if (room.gameState.currentTurn !== playerId) throw { code: 'NOT_YOUR_TURN', message: '不是你的回合' };

    const player = room.gameState.players.find((p: Player) => p.id === playerId);
    if (!player) throw { code: 'PLAYER_NOT_FOUND', message: '玩家不存在' };

    // 1. 验证所有牌组合法
    const boardValidation = GameValidator.validateBoard(board);
    if (!boardValidation.valid) {
      throw { code: 'INVALID_MELD', message: '桌上有非法牌组' };
    }

    // 2. 计算本回合新出牌分数
    const newScore = GameValidator.calculateNewTileScore(board);
    const hasNewTile = newScore > 0;

    // 3. 破冰检查
    if (hasNewTile && !player.hasBrokenIce) {
      if (newScore < 30) {
        throw { code: 'NOT_BROKEN_ICE', message: '未破冰，首次出牌需要至少30分' };
      }
      player.hasBrokenIce = true;
    }

    // 4. 清除所有 isNew 标记
    board.forEach(meld => {
      meld.tiles.forEach(tile => {
        tile.isNew = false;
        tile.isJustDrawn = false;
      });
    });
    hand.forEach(row => {
      row.forEach(tile => {
        tile.isNew = false;
        tile.isJustDrawn = false;
      });
    });

    // 5. 更新玩家手牌和破冰状态
    player.hand = hand;
    if (hasNewTile && !player.hasBrokenIce && newScore >= 30) {
      player.hasBrokenIce = true;
    }

    // 6. 更新桌面
    room.gameState.board = board;

    // 7. 检查手牌是否清空（胜利）
    const handCount = hand[0].length + hand[1].length;
    if (handCount === 0) {
      room.gameState.status = 'finished';
      room.gameState.winner = playerId;
      room.status = 'finished';
    } else {
      // 8. 切换到下一位玩家
      const currentIndex = room.gameState.players.findIndex((p: Player) => p.id === playerId);
      const nextIndex = (currentIndex + 1) % room.gameState.players.length;
      room.gameState.currentTurn = room.gameState.players[nextIndex].id;
      room.gameState.turnStartTime = Date.now();
      room.gameState.round += 1;
    }

    room.updatedAt = Date.now();
    await RoomStore.set(roomId, room);
    return room;
  }
}
