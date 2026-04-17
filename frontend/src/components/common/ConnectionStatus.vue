<template>
  <div v-if="!socketStore.isConnected" class="connection-status">
    <span class="indicator"></span>
    连接中...
  </div>
</template>

<script setup lang="ts">
import { useSocketStore } from '../../stores/socket';

const socketStore = useSocketStore();
</script>

<style scoped>
.connection-status {
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 9999;
  animation: pulse 2s infinite;
}

.indicator {
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
}
</style>