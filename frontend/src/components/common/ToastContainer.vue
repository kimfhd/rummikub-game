<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div 
        v-for="toast in toasts" 
        :key="toast.id"
        :class="['toast', toast.type]"
      >
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

const toasts = ref<Toast[]>([]);
let id = 0;

const show = (message: string, type: Toast['type'] = 'info') => {
  const toast = { id: ++id, message, type };
  toasts.value.push(toast);
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== toast.id);
  }, 3000);
};

defineExpose({ show });
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  padding: 12px 24px;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  animation: slideDown 0.3s ease;
}

.toast.error { background: #ef4444; }
.toast.success { background: #22c55e; }
.toast.info { background: #3b82f6; }

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>