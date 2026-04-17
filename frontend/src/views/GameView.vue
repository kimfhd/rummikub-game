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

    <!-- 玩家状态栏 -->
    <div class="player-status-bar">
      <div
        v-for="p in gamePlayers"
        :key="p.id"
        :class="['player-avatar-small', { 'active-turn': p.id === currentTurn }]"
      >
        <span class="player-name-small">{{ p.id === myId ? '你' : p.name }}</span>
        <span class="hand-badge">{{ p.handCount }}</span>
      </div>
    </div>

    <!-- 桌面区域 -->
    <div class="board-area">
      <GameBoard
        :melds="localBoard"
        :is-my-turn="isMyTurn"
        :is-broken-ice="gameStore.isBrokenIce"
        :invalid-meld-ids="invalidMeldIds"
        :drag-over-meld-id="dragDrop.dragOverMeldId.value"
        @tile-drag-start="dragDrop.startDrag"
        @tile-click="handleBoardTileClick"
        @add-meld="gameStore.addMeld"
        @drop-on-meld="dragDrop.dropOnMeld"
        @drop-on-new-meld="dragDrop.dropOnNewMeld"
        @set-drag-over-meld="dragDrop.setDragOverMeld"
      />
    </div>

    <!-- 玩家牌架 -->
    <div class="rack-area" :class="{ 'not-my-turn': !isMyTurn }">
      <PlayerRack
        :rows="localHand"
        :is-my-turn="isMyTurn"
        :is-broken-ice="gameStore.isBrokenIce"
        :sort-mode="gameStore.sortMode"
        :total-count="gameStore.totalHandCount"
        :drag-over-row-idx="dragDrop.dragOverRowIdx.value"
        @sort="gameStore.setSortMode"
        @tile-drag-start="dragDrop.startDrag"
        @drop-on-rack="dragDrop.dropOnRack"
        @set-drag-over-row="dragDrop.setDragOverRow"
      />
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar" v-if="isMyTurn">
      <button @click="resetTurn" class="btn-action">重置本地盘面</button>
      <button @click="drawTile" class="btn-action" :disabled="isLoading">
        摸牌
      </button>
      <button
        @click="endTurn"
        :class="['btn-action', 'primary', { disabled: !canEndTurn }]"
        :disabled="isLoading || !canEndTurn"
      >
        <span>结束回合</span>
        <span v-if="newScore > 0" class="score-hint">出分: {{ newScore }}</span>
      </button>
    </div>

    <!-- 消息提示 -->
    <div v-if="toastMessage" class="game-toast" @animationend="toastMessage = ''">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room';
import { useSocketStore } from '../stores/socket';
import { useGameStore } from '../stores/game';
import { useDragDrop } from '../composables/useDragDrop';
import { ClientEvents, ServerEvents, GameState, Player, Tile } from '../shared/types';
import GameBoard from '../components/game/GameBoard.vue';
import PlayerRack from '../components/game/PlayerRack.vue';

const router = useRouter();
const roomStore = useRoomStore();
const socketStore = useSocketStore();
const gameStore = useGameStore();
const dragDrop = useDragDrop();

const isLoading = ref(false);
const toastMessage = ref('');

// 游戏状态
const gameState = computed(() => roomStore.currentRoom?.gameState);
const boardMelds = computed(() => gameState.value?.board || []);
const deckCount = computed(() => gameState.value?.deck?.length || 0);
const localBoard = computed(() => gameStore.localBoard);
const localHand = computed(() => gameStore.localHand);

// 当前玩家
const myId = computed(() => roomStore.myPlayerId);
const myPlayer = computed(() => gameState.value?.players?.find(p => p.id === myId.value));
const gamePlayers = computed(() => {
  return (gameState.value?.players || []).map(p => ({
    ...p,
    handCount: p.hand[0].length + p.hand[1].length
  }));
});

// 回合信息
const currentTurn = computed(() => gameState.value?.currentTurn);
const isMyTurn = computed(() => currentTurn.value === myId.value);
const currentPlayerName = computed(() => {
  const player = gameState.value?.players?.find(p => p.id === currentTurn.value);
  return player?.name || '...';
});

// 桌面合法性
const invalidMeldIds = computed(() => gameStore.getInvalidMelds());
const newScore = computed(() => gameStore.calculateNewScore());
const canEndTurn = computed(() => {
  const result = gameStore.canEndTurn();
  return result.can;
});

// 追踪上一个回合玩家ID，用于检测回合切换
const lastTurnPlayerId = ref<string | null>(null);

const showToast = (msg: string, type: 'error' | 'success' | 'info' = 'error') => {
  toastMessage.value = msg;
  setTimeout(() => { if (toastMessage.value === msg) toastMessage.value = ''; }, 2500);
};

// 点击桌面上的牌（取回手牌）
const handleBoardTileClick = (item: { source: 'board'; mIdx: number; tIdx: number; tile: Tile }) => {
  if (!isMyTurn.value) return;

  const tile = item.tile;
  // 未破冰时只能取回 isNew 的牌
  if (!tile.isNew && !gameStore.isBrokenIce) {
    showToast('未破冰不可取回旧牌', 'info');
    return;
  }

  // 从桌面移除
  const removed = gameStore.localBoard[item.mIdx].tiles.splice(item.tIdx, 1)[0];
  removed.isNew = false;
  gameStore.removeEmptyMelds();

  // 加入手牌
  removed.isJustDrawn = true;
  gameStore.localHand[1].push(removed);
  if (gameStore.sortMode !== 'manual') {
    gameStore.applySort();
  }
};

const resetTurn = () => {
  gameStore.resetTurn();
  showToast('已恢复本回合初始状态', 'info');
};

const drawTile = async () => {
  if (!isMyTurn.value) return;

  // 如果桌面有改动，先重置
  const hasNew = gameStore.hasNewTileOnBoard();
  if (hasNew || !gameStore.validateBoard()) {
    gameStore.resetTurn();
  }

  isLoading.value = true;
  try {
    await socketStore.emit(ClientEvents.DRAW_TILE);
  } catch (err: any) {
    showToast(err.message || '摸牌失败');
  } finally {
    isLoading.value = false;
  }
};

const endTurn = async () => {
  if (!isMyTurn.value) return;

  const check = gameStore.canEndTurn();
  if (!check.can) {
    showToast(check.reason || '无法结束回合');
    return;
  }

  isLoading.value = true;
  try {
    await socketStore.emit(ClientEvents.END_TURN, {
      board: JSON.parse(JSON.stringify(gameStore.localBoard)),
      hand: JSON.parse(JSON.stringify(gameStore.localHand)),
      hasBrokenIce: gameStore.isBrokenIce
    });
  } catch (err: any) {
    showToast(err.message || '结束回合失败');
  } finally {
    isLoading.value = false;
  }
};

const leaveGame = async () => {
  await roomStore.leaveRoom();
  router.push('/');
};

onMounted(async () => {
  // 如果刷新后 store 丢失，尝试从 localStorage 恢复并重新加入房间
  if (!roomStore.currentRoom) {
    // 等待 socket 连接就绪（最多等10秒）
    if (!socketStore.isConnected) {
      try {
        await new Promise<void>((resolve, reject) => {
          const unwatch = watch(() => socketStore.isConnected, (connected) => {
            if (connected) {
              unwatch();
              resolve();
            }
          });
          setTimeout(() => {
            unwatch();
            reject(new Error('Socket 连接超时'));
          }, 10000);
        });
      } catch {
        router.push('/');
        return;
      }
    }

    const rejoinedRoom = await roomStore.tryRejoinRoom();
    if (!rejoinedRoom) {
      router.push('/');
      return;
    }
  }

  // 监听游戏状态更新
  socketStore.on(ServerEvents.GAME_STATE, (state: GameState) => {
    // 更新 roomStore 中的游戏状态
    if (roomStore.currentRoom) {
      roomStore.currentRoom.gameState = state;
    }

    if (!myId.value) return;

    const isNowMyTurn = state.currentTurn === myId.value;
    const turnChanged = lastTurnPlayerId.value !== state.currentTurn;

    if (isNowMyTurn && turnChanged) {
      // 我的新回合开始了
      gameStore.startTurn(state, myId.value);
      showToast('你的回合！', 'success');
    } else if (!isNowMyTurn) {
      // 不是我的回合，同步远程状态
      gameStore.syncRemote(state, myId.value);
    }

    lastTurnPlayerId.value = state.currentTurn;
  });

  // 监听游戏结束
  socketStore.on(ServerEvents.GAME_OVER, ({ winnerId }: { winnerId: string }) => {
    const winner = gameState.value?.players.find(p => p.id === winnerId);
    showToast(`${winner?.name || '某玩家'} 赢得了比赛！`, 'success');
  });

  // 初始化本地状态
  if (gameState.value && myId.value) {
    lastTurnPlayerId.value = gameState.value.currentTurn;
    if (isMyTurn.value) {
      gameStore.startTurn(gameState.value, myId.value);
    } else {
      gameStore.syncRemote(gameState.value, myId.value);
    }
  }
});

onUnmounted(() => {
  socketStore.off(ServerEvents.GAME_STATE);
  socketStore.off(ServerEvents.GAME_OVER);
});
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
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-leave {
  background: rgba(239, 68, 68, 0.2);
  border: none;
  color: #ef4444;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
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
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
}

.player-status-bar {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.3);
  scrollbar-width: none;
}

.player-status-bar::-webkit-scrollbar {
  display: none;
}

.player-avatar-small {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  min-width: 70px;
  gap: 4px;
}

.player-avatar-small.active-turn {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
}

.player-name-small {
  font-size: 12px;
  font-weight: 600;
}

.hand-badge {
  font-size: 11px;
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 8px;
  border-radius: 999px;
}

.board-area {
  flex: 1;
  overflow-y: auto;
}

.rack-area {
  transition: opacity 0.3s;
}

.rack-area.not-my-turn {
  opacity: 0.6;
  pointer-events: none;
}

.action-bar {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
}

.btn-action {
  flex: 1;
  padding: 14px;
  border-radius: 10px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.btn-action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.btn-action.primary {
  background: linear-gradient(135deg, #38bdf8, #818cf8);
}

.btn-action.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(56, 189, 248, 0.3);
}

.btn-action:disabled,
.btn-action.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.score-hint {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.8;
}

.game-toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239, 68, 68, 0.9);
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 14px;
  z-index: 1000;
  animation: slideUp 0.3s ease;
  white-space: nowrap;
  pointer-events: none;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translate(-50%, 20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
</style>
