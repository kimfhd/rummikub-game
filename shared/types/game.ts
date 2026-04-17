export type Color = 'black' | 'red' | 'blue' | 'orange';
export type TileType = 'number' | 'joker';

export interface Tile {
  id: string;
  value: number;
  color: Color;
  type: TileType;
  isNew?: boolean;
  isJustDrawn?: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  hand: Tile[][];
  hasBrokenIce: boolean;
  isOnline: boolean;
  joinedAt: number;
  score: number;
}

export interface Meld {
  id: string;
  tiles: Tile[];
}

export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface GameState {
  roomId: string;
  status: GameStatus;
  players: Player[];
  board: Meld[];
  deck: Tile[];
  currentTurn: string;
  turnStartTime: number;
  turnDuration: number;
  winner?: string;
  round: number;
}