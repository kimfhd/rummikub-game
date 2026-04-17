import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  data: {
    playerId?: string;
    playerName?: string;
    currentRoom?: string;
  };
}
