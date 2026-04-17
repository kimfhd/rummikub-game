<template>
  <div class="home-view">
    <div class="hero-section">
      <h1 class="title">RUMMIKUB</h1>
      <p class="subtitle">以色列麻将 · 多人联机版</p>
      <div v-if="!isConnected" class="connection-status">
        <span class="spinner"></span>
        正在连接服务器...
      </div>
    </div>

    <div class="actions-container">
      <!-- 创建房间 -->
      <div class="panel create-panel">
        <h2>创建房间</h2>
        <input 
          v-model="createForm.name" 
          placeholder="你的昵称" 
          maxlength="20"
          @keyup.enter="handleCreate"
        />
        <select v-model="createForm.maxPlayers">
          <option :value="2">2人</option>
          <option :value="3">3人</option>
          <option :value="4">4人</option>
        </select>
        <button 
          @click="handleCreate" 
          :disabled="!canCreate || isLoading || !isConnected"
          class="btn-primary"
        >
          {{ isLoading ? '创建中...' : '创建房间' }}
        </button>
      </div>

      <!-- 加入房间 -->
      <div class="panel join-panel">
        <h2>加入房间</h2>
        <input 
          v-model="joinForm.name" 
          placeholder="你的昵称" 
          maxlength="20"
        />
        <input 
          v-model="joinForm.roomId" 
          placeholder="房间码 (如: A3B7K9)" 
          maxlength="6"
          style="text-transform: uppercase;"
        />
        <button 
          @click="handleJoin" 
          :disabled="!canJoin || isLoading || !isConnected"
          class="btn-secondary"
        >
          {{ isLoading ? '加入中...' : '加入房间' }}
        </button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-toast">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room';
import { useSocketStore } from '../stores/socket';

const router = useRouter();
const roomStore = useRoomStore();
const socketStore = useSocketStore();

// 关键：获取连接状态
const isConnected = computed(() => socketStore.isConnected);

const isLoading = ref(false);
const error = ref<string | null>(null);

const createForm = reactive({
  name: localStorage.getItem('playerName') || '',
  maxPlayers: 4 as 2 | 3 | 4
});

const joinForm = reactive({
  name: localStorage.getItem('playerName') || '',
  roomId: ''
});

const canCreate = computed(() => createForm.name.trim().length >= 2);
const canJoin = computed(() => joinForm.name.trim().length >= 2 && joinForm.roomId.trim().length === 6);

const handleCreate = async () => {
  if (!canCreate.value || !isConnected.value) return;
  
  isLoading.value = true;
  error.value = null;
  
  try {
    localStorage.setItem('playerName', createForm.name.trim());
    const result = await roomStore.createRoom({
      playerName: createForm.name.trim(),
      maxPlayers: createForm.maxPlayers
    });
    router.push(`/room/${result.room.id}`);
  } catch (err: any) {
    error.value = err.message || '创建房间失败，请重试';
    setTimeout(() => error.value = null, 3000);
  } finally {
    isLoading.value = false;
  }
};

const handleJoin = async () => {
  if (!canJoin.value || !isConnected.value) return;
  
  isLoading.value = true;
  error.value = null;
  
  try {
    localStorage.setItem('playerName', joinForm.name.trim());
    const result = await roomStore.joinRoom({
      playerName: joinForm.name.trim(),
      roomId: joinForm.roomId.trim().toUpperCase()
    });
    router.push(`/room/${result.room.id}`);
  } catch (err: any) {
    error.value = err.message || '加入房间失败，请检查房间码';
    setTimeout(() => error.value = null, 3000);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.home-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.hero-section {
  text-align: center;
  margin-bottom: 60px;
}

.title {
  font-size: 48px;
  font-weight: 900;
  background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
  letter-spacing: 4px;
}

.subtitle {
  color: #94a3b8;
  font-size: 16px;
  margin-bottom: 16px;
}

.connection-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fbbf24;
  font-size: 14px;
  font-weight: 600;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #fbbf24;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.actions-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  width: 100%;
  max-width: 600px;
}

.panel {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel h2 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #e2e8f0;
}

.panel input,
.panel select {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px 16px;
  color: white;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.panel input:focus,
.panel select:focus {
  border-color: #38bdf8;
}

.btn-primary,
.btn-secondary {
  padding: 14px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  margin-top: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(56, 189, 248, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #ef4444;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  animation: slideDown 0.3s ease;
  z-index: 1000;
}

@media (max-width: 640px) {
  .actions-container {
    grid-template-columns: 1fr;
  }
  
  .title {
    font-size: 36px;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translate(-50%, -20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>