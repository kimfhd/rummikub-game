export enum ClientEvents {
  PING = 'ping',
  CREATE_ROOM = 'room:create',
  JOIN_ROOM = 'room:join',
  LEAVE_ROOM = 'room:leave',
  GET_ROOM_INFO = 'room:info',
  UPDATE_SETTINGS = 'room:settings',
  START_GAME = 'room:start',
  PLAY_TILES = 'game:play',
  MOVE_TILE = 'game:move',
  DRAW_TILE = 'game:draw',
  END_TURN = 'game:endTurn',
}

export enum ServerEvents {
  CONNECTED = 'connected',
  PONG = 'pong',
  ERROR = 'error',
  ROOM_CREATED = 'room:created',
  ROOM_UPDATED = 'room:updated',
  ROOM_JOINED = 'room:joined',
  PLAYER_JOINED = 'player:joined',
  PLAYER_LEFT = 'player:left',
  SETTINGS_UPDATED = 'settings:updated',
  GAME_STARTED = 'game:started',
  GAME_STATE = 'game:state',
  TURN_STARTED = 'turn:started',
  TILE_PLAYED = 'tile:played',
  INVALID_MOVE = 'game:invalid',
  GAME_OVER = 'game:over',
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_FULL = 'ROOM_FULL',
  ROOM_ALREADY_STARTED = 'ROOM_ALREADY_STARTED',
  INVALID_ROOM_CODE = 'INVALID_ROOM_CODE',
  NOT_HOST = 'NOT_HOST',
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  INVALID_MOVE = 'INVALID_MOVE',
  NOT_BROKEN_ICE = 'NOT_BROKEN_ICE',
  INVALID_MELD = 'INVALID_MELD',
  GAME_NOT_STARTED = 'GAME_NOT_STARTED',
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  NAME_TOO_SHORT = 'NAME_TOO_SHORT',
}

export interface SocketResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
  };
}