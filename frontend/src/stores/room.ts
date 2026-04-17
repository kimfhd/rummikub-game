import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Room, Player, CreateRoomDTO, JoinRoomDTO } from '../shared/types';
import { useSocketStore } from './socket';
import { ClientEvents, ServerEvents } from '../shared/types';

const STORAGE_KEY = 'rummikub_current_room';

export const useRoomStore = defineStore('room', () => {
  const socketStore = useSocketStore();
  
  const currentRoom = ref<Room | null>(null);
  const myPlayerId = ref<string | null>(null);
  
  const isHost = computed(() => {
    if (!currentRoom.value || !myPlayerId.value) return false;
    return currentRoom.value.hostId === myPlayerId.value;
  });
  
  const myPlayer = computed(() => {
    if (!currentRoom.value || !myPlayerId.value) return null;
    return currentRoom.value.players.find(p => p.id === myPlayerId.value) || null;
  });

  // 保存到 localStorage
  const persistRoom = () => {
    if (currentRoom.value && myPlayerId.value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        roomId: currentRoom.value.id,
        playerId: myPlayerId.value,
        playerName: myPlayer.value?.name
      }));
    }
  };

  // 从 localStorage 恢复
  const restoreRoom = (): { roomId: string; playerId: string; playerName: string } | null => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  };

  // 清除持久化数据
  const clearPersist = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const createRoom = async (data: CreateRoomDTO) => {
    const result = await socketStore.emit<{ room: Room; playerId: string }>(
      ClientEvents.CREATE_ROOM,
      data
    );
    currentRoom.value = result.room;
    myPlayerId.value = result.playerId;
    persistRoom(); // 保存状态
    return result;
  };

  const joinRoom = async (data: JoinRoomDTO) => {
    const result = await socketStore.emit<{ room: Room; playerId: string }>(
      ClientEvents.JOIN_ROOM,
      data
    );
    currentRoom.value = result.room;
    myPlayerId.value = result.playerId;
    persistRoom(); // 保存状态
    return result;
  };

  const leaveRoom = async () => {
    try {
      await socketStore.emit(ClientEvents.LEAVE_ROOM);
    } catch (error) {
      console.error('Leave room error:', error);
    } finally {
      currentRoom.value = null;
      myPlayerId.value = null;
      clearPersist(); // 清除状态
    }
  };

  return {
    currentRoom,
    myPlayerId,
    myPlayer,
    isHost,
    createRoom,
    joinRoom,
    leaveRoom,
    restoreRoom,
    clearPersist
  };
});