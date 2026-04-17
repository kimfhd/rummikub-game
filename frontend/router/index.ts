import { createRouter, createWebHistory } from 'vue-router';
import { useRoomStore } from '../stores/room';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue')
    },
    {
      path: '/room/:id',
      name: 'room',
      component: () => import('../views/RoomView.vue'),
      beforeEnter: (to, from, next) => {
        const roomStore = useRoomStore();
        // 如果没有当前房间状态，尝试获取房间信息
        if (!roomStore.currentRoom && to.params.id) {
          // 这里可以实现重连逻辑
          next();
        } else {
          next();
        }
      }
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('../views/GameView.vue'),
      beforeEnter: (to, from, next) => {
        const roomStore = useRoomStore();
        if (!roomStore.currentRoom) {
          next({ name: 'home' });
        } else {
          next();
        }
      }
    }
  ]
});

export default router;