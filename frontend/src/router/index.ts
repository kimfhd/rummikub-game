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
      component: () => import('../views/RoomView.vue')
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('../views/GameView.vue')
    }
  ]
});

export default router;