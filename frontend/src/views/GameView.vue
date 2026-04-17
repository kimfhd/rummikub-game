<template>
  <div class="game-view">
    <!-- 顶部栏 -->
    <div class="game-header">
      <button class="btn-leave" @click="leaveGame">退出</button>
      <div class="turn-info">
        <span v-if="isMyTurn" class="my-turn">你的回合</span>
        <span v-else class="waiting">等待 {{ currentPlayerName }}...</span>
      </div>
      <div class="deck-info">牌堆: {{ deckCount }}</div>
    </div>

    <!-- 桌面区域 -->
    <div class="board-area">
      <GameBoard :melds="boardMelds" />
    </div>

    <!-- 玩家牌架 -->
    <div class="rack-area" :class="{ 'not-my-turn': !isMyTurn }">
      <PlayerRack 
        :rows="myHand" 
        @play="handlePlay"
        @sort="sortHand"
      />
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar" v-if="isMyTurn">
      <button @click="drawTile" class="btn-action">摸牌</button>
      <button @click="endTurn" class="btn-action primary">结束回合</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room';
import { useSocketStore } from '../stores/socket';
import { ClientEvents, ServerEvents, GameState, Meld, Tile } from '../shared/types';
import GameBoard from '../components/game/GameBoard.vue';
import PlayerRack from '../components/game/PlayerRack.vue';

const router = useRouter();
const roomStore = useRoomStore();
const socketStore = useSocketStore();

// 游戏状态
const gameState = computed(() => roomStore.currentRoom?.gameState);
const boardMelds = computed(() => gameState.value?.board || []);
const deckCount = computed(() => gameState.value?.deck?.length || 0);

// 当前玩家
const myId = computed(() => roomStore.myPlayerId);
const myPlayer = computed(() => gameState.value?.players?.find(p => p.id === myId.value));
const myHand = computed(() => myPlayer.value?.hand || [[], []]);

// 回合信息
const currentTurn = computed(() => gameState.value?.currentTurn);
const isMyTurn = computed(() => currentTurn.value === myId.value);
const currentPlayerName = computed(() => {
  const player = gameState.value?.players?.find(p => p.id === currentTurn.value);
  return player?.name || '...';
});

onMounted(() => {
  // 监听游戏状态更新
  socketStore.on(ServerEvents.GAME_STATE, (state: GameState) => {
    if (roomStore.currentRoom) {
      roomStore.currentRoom.gameState = state;
    }
  });

  // 如果游戏还没开始，返回房间
  if (!gameState.value) {
    router.push(`/room/${roomStore.currentRoom?.id}`);
  }
});

onUnmounted(() => {
  socketStore.off(ServerEvents.GAME_STATE);
});

const leaveGame = async () => {
  await roomStore.leaveRoom();
  router.push('/');
};

const handlePlay = (melds: Meld[]) => {
  // Phase 3: 实现出牌逻辑
  console.log('Play melds:', melds);
};

const sortHand = (mode: 'runs' | 'groups') => {
  // Phase 3: 实现排序
  console.log('Sort by:', mode);
};

const drawTile = async () => {
  try {
    await socketStore.emit(ClientEvents.DRAW_TILE);
  } catch (err: any) {
    alert(err.message);
  }
};

const endTurn = async () => {
  try {
    await socketStore.emit(ClientEvents.END_TURN);
  } catch (err: any) {
    alert(err.message);
  }
};
</script>

<style scoped>
.game-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: white;
  display: flex;
  flex-direction: column;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(0,0,0,0.3);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.btn-leave {
  background: rgba(239, 68, 68, 0.2);
  border: none;
  color: #ef4444;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}

.turn-info {
  font-weight: 700;
}

.my-turn {
  color: #38bdf8;
  animation: pulse 2s infinite;
}

.waiting {
  color: #94a3b8;
}

.deck-info {
  background: rgba(255,255,255,0.1);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
}

.board-area {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.rack-area {
  background: rgba(0,0,0,0.4);
  border-top: 1px solid rgba(255,255,255,0.1);
  padding: 16px;
}

.rack-area.not-my-turn {
  opacity: 0.6;
  pointer-events: none;
}

.action-bar {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: rgba(0,0,0,0.5);
}

.btn-action {
  flex: 1;
  padding: 14px;
  border-radius: 10px;
  border: none;
  background: rgba(255,255,255,0.1);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.btn-action.primary {
  background: linear-gradient(135deg, #38bdf8, #818cf8);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>