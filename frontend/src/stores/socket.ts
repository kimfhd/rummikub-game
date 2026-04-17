import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { io, Socket } from 'socket.io-client';
import { ClientEvents, ServerEvents } from '../shared/types';

export const useSocketStore = defineStore('socket', () => {
  const socket = ref<Socket | null>(null);
  const isConnected = ref(false);
  const connectionError = ref<string | null>(null);

  const initialize = () => {
    const socketUrl = 'http://110.40.136.217:3000';
    
    console.log('Connecting to:', socketUrl); // 调试用
    
    socket.value = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    setupListeners();
  };

  const setupListeners = () => {
    if (!socket.value) return;

    socket.value.on('connect', () => {
      isConnected.value = true;
      connectionError.value = null;
      console.log('✅ Socket connected');
    });

    socket.value.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      connectionError.value = error.message;
    });

    socket.value.on('disconnect', (reason) => {
      isConnected.value = false;
      console.log('🔴 Disconnected:', reason);
    });

    socket.value.on('connected', (data) => {
      console.log('Server acknowledged:', data);
    });
  };

  const emit = async <T>(event: ClientEvents, data?: any): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!socket.value?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.value.emit(event, data, (response: any) => {
        if (response?.success) {
          resolve(response.data);
        } else {
          reject(response?.error || new Error('Request failed'));
        }
      });
    });
  };

  const on = (event: ServerEvents, callback: Function) => {
    socket.value?.on(event, callback as any);
  };

  const off = (event: ServerEvents, callback?: Function) => {
    socket.value?.off(event, callback as any);
  };

  return {
    socket: computed(() => socket.value),
    isConnected,
    connectionError,
    initialize,
    emit,
    on,
    off
  };
});