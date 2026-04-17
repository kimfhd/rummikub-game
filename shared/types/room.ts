import { GameState, Player } from './game';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface RoomSettings {
  maxPlayers: 2 | 3 | 4;
  isPrivate: boolean;
  timeLimit: number;
  allowSpectators: boolean;
}

export interface Room {
  id: string;
  hostId: string;
  status: RoomStatus;
  players: Player[];
  spectators?: Player[];
  settings: RoomSettings;
  gameState?: GameState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRoomDTO {
  playerName: string;
  maxPlayers?: 2 | 3 | 4;
  isPrivate?: boolean;
  timeLimit?: number;
}

export interface JoinRoomDTO {
  roomId: string;
  playerName: string;
}

export interface RoomSummary {
  id: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
  createdAt: number;
}