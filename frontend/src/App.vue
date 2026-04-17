<template>
  <div class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    
    <!-- 全局通知组件 -->
    <ToastContainer />
    
    <!-- 连接状态指示器 -->
    <ConnectionStatus />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useSocketStore } from './stores/socket';
import ToastContainer from './components/common/ToastContainer.vue';
import ConnectionStatus from './components/common/ConnectionStatus.vue';

const socketStore = useSocketStore();

onMounted(() => {
  // 初始化Socket连接
  socketStore.initialize();
});
</script>

<style>
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: white;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>