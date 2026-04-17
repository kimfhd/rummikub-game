<template>
  <div class="room-view">
    <div class="room-header">
      <button class="btn-back" @click="handleLeave">← 返回大厅</button>
      <div class="room-code" @click="copyRoomCode">
        <span class="label">房间号</span>
        <span class="code">{{ roomId }}</span>
        <span class="copy-hint">点击复制</span>
      </div>
    </div>

    <div class="room-content">
      <div class="players-panel">
        <h2>玩家列表 ({{ playerCount }}/{{ maxPlayers }})</h2>
        
        <div class="players-list">
          <div 
            v-for="player in players" 
            :key="player.id"
            :class="['player-item', { 'is-host': player.id === hostId, 'is-me': player.id === myId }]"
          >
            <div class="player-avatar">
              {{ player.name.charAt(0).toUpperCase() }}
            </div>
            <div class="player-info">
              <span class="player-name">{{ player.name }}</span>
              <span v-if="player.id === hostId" class="host-badge">房主</span>
              <span v-if="!player.isOnline" class="offline-badge">离线</span>
            </div>
          </div>

          <div 
            v-for="n in emptySlots" 
            :key="n"
            class="player-item empty"
          >
            <div class="player-avatar empty">?</div>
            <div class="player-info">等待加入...</div>
          </div>
        </div>
      </div>

      <div class="invite-panel">
        <h3>邀请好友</h3>
        <p>房间号：<strong>{{ roomId }}</strong></p>
        <button @click="copyRoomCode" class="btn-copy">复制房间号</button>
      </div>
    </div>

    <div class="room-actions">
      <button 
        v-if="isHost" 
        class="btn-start"
        :disabled="!canStart"
        @click="startGame"
      >
        开始游戏 ({{ playerCount }}/{{ maxPlayers }})
      </button>
      <div v-else class="waiting-text">
        等待房主开始游戏...
      </div>
    </div>

    <div v-if="message" class="message-toast">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room';
import { useSocketStore } from '../stores/socket';
import { ClientEvents, ServerEvents, Room, Player, GameState } from '../shared/types';

const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();
const socketStore = useSocketStore();

const roomId = computed(() => route.params.id as string);
const message = ref('');

const players = computed(() => roomStore.currentRoom?.players || []);
const hostId = computed(() => roomStore.currentRoom?.hostId || '');
const myId = computed(() => roomStore.myPlayerId);
const isHost = computed(() => roomStore.isHost);
const playerCount = computed(() => players.value.length);
const maxPlayers = computed(() => roomStore.currentRoom?.settings.maxPlayers || 4);
const emptySlots = computed(() => Math.max(0, maxPlayers.value - playerCount.value));
const canStart = computed(() => playerCount.value >= 2);

const showMessage = (msg: string, duration = 2000) => {
  message.value = msg;
  setTimeout(() => message.value = '', duration);
};

const cleanupListeners = () => {
  socketStore.off(ServerEvents.ROOM_UPDATED);
  socketStore.off(ServerEvents.PLAYER_JOINED);
  socketStore.off(ServerEvents.PLAYER_LEFT);
  socketStore.off(ServerEvents.GAME_STARTED);
};

const setupListeners = () => {
  socketStore.on(ServerEvents.ROOM_UPDATED, (room: Room) => {
    roomStore.currentRoom = room;
  });

  socketStore.on(ServerEvents.PLAYER_JOINED, ({ player }: { player: Player }) => {
    showMessage(`${player.name} 加入了房间`);
    refreshRoom();
  });

  socketStore.on(ServerEvents.PLAYER_LEFT, () => {
    refreshRoom();
  });

  socketStore.on(ServerEvents.GAME_STARTED, ({ gameState: gs }: { gameState: GameState }) => {
    if (roomStore.currentRoom) {
      roomStore.currentRoom.gameState = gs;
    }
    router.push('/game');
  });
};

const refreshRoom = async () => {
  try {
    const room = await socketStore.emit<Room>(ClientEvents.GET_ROOM_INFO, roomId.value);
    roomStore.currentRoom = room;
  } catch (err) {
    console.error('Failed to refresh room:', err);
  }
};

const rejoinRoom = async () => {
  const saved = roomStore.restoreRoom();
  const name = saved?.playerName || localStorage.getItem('playerName');
  
  if (!name || !roomId.value) {
    router.push('/');
    return;
  }

  // 等待 socket 连接就绪
  if (!socketStore.isConnected) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(() => socketStore.isConnected, (connected) => {
        if (connected) {
          unwatch();
          resolve();
        }
      });
    });
  }

  try {
    const result = await socketStore.emit<{ room: Room; playerId: string }>(
      ClientEvents.JOIN_ROOM, 
      { roomId: roomId.value, playerName: name }
    );
    
    roomStore.currentRoom = result.room;
    roomStore.myPlayerId = result.playerId;
    showMessage('已连接到房间');
  } catch (err: any) {
    showMessage(err.message || '房间已不存在');
    setTimeout(() => router.push('/'), 2000);
  }
};

const copyRoomCode = () => {
  const code = roomId.value;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(code).then(() => showMessage('房间号已复制')).catch(() => fallbackCopy(code));
  } else {
    fallbackCopy(code);
  }
};

const fallbackCopy = (text: string) => {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showMessage('房间号已复制');
  } catch {
    showMessage('复制失败: ' + text);
  }
  document.body.removeChild(ta);
};

const startGame = async () => {
  try {
    await socketStore.emit(ClientEvents.START_GAME);
  } catch (err: any) {
    showMessage(err.message || '开始游戏失败');
  }
};

const handleLeave = () => {
  try {
    socketStore.emit(ClientEvents.LEAVE_ROOM).catch(() => {});
  } catch {}
  
  roomStore.currentRoom = null;
  roomStore.myPlayerId.value = null;
  localStorage.removeItem('rummikub_current_room');
  router.push('/');
};

onMounted(() => {
  cleanupListeners();
  setupListeners();
  
  if (!roomStore.currentRoom || roomStore.currentRoom.id !== roomId.value) {
    rejoinRoom();
  } else {
    refreshRoom();
  }
});

onUnmounted(() => {
  cleanupListeners();
});
</script>

<style scoped>
.room-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: white;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-back {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.2);
}

.room-code {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.3);
  padding: 12px 24px;
  border-radius: 12px;
  border: 1px solid rgba(56, 189, 248, 0.3);
  cursor: pointer;
  transition: all 0.2s;
}

.room-code:hover {
  border-color: rgba(56, 189, 248, 0.6);
  background: rgba(56, 189, 248, 0.1);
}

.room-code .label {
  color: #94a3b8;
  font-size: 14px;
}

.room-code .code {
  font-size: 24px;
  font-weight: 900;
  color: #38bdf8;
  letter-spacing: 4px;
}

.copy-hint {
  font-size: 12px;
  color: #64748b;
  margin-left: 8px;
}

.room-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.players-panel {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.players-panel h2 {
  margin-bottom: 20px;
  font-size: 18px;
  color: #e2e8f0;
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.player-item.is-host {
  border-color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
}

.player-item.is-me {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
}

.player-item.empty {
  opacity: 0.5;
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.2);
}

.player-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
}

.player-avatar.empty {
  background: rgba(255, 255, 255, 0.1);
  color: #64748b;
}

.player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-name {
  font-weight: 600;
  font-size: 16px;
}

.host-badge {
  font-size: 11px;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
  width: fit-content;
}

.offline-badge {
  font-size: 11px;
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
  width: fit-content;
}

.invite-panel {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.invite-panel h3 {
  margin-bottom: 12px;
  color: #e2e8f0;
}

.invite-panel p {
  color: #94a3b8;
  margin-bottom: 16px;
}

.btn-copy {
  background: #38bdf8;
  border: none;
  color: #0f172a;
  padding: 10px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
}

.room-actions {
  margin-top: auto;
  padding-top: 30px;
  text-align: center;
}

.btn-start {
  width: 100%;
  max-width: 400px;
  padding: 18px;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(56, 189, 248, 0.3);
}

.btn-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

.waiting-text {
  color: #94a3b8;
  font-size: 16px;
  padding: 18px;
}

.message-toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(56, 189, 248, 0.9);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  animation: slideUp 0.3s ease;
  z-index: 1000;
}

@keyframes slideUp {
  from { opacity: 0; transform: translate(-50%, 20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

@media (max-width: 640px) {
  .room-code {
    padding: 8px 16px;
  }
  
  .room-code .code {
    font-size: 18px;
  }
  
  .copy-hint {
    display: none;
  }
}
</style>