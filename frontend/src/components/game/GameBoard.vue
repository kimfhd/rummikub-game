<template>
  <div class="game-board">
    <div v-if="melds.length === 0" class="empty-board">
      桌面上还没有牌组
    </div>
    <div v-for="meld in melds" :key="meld.id" class="meld-group">
      <Tile v-for="tile in meld.tiles" :key="tile.id" :tile="tile" :on-board="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Meld } from '../../../shared/types';
import Tile from './Tile.vue';

defineProps<{
  melds: Meld[];
}>();
</script>

<style scoped>
.game-board {
  min-height: 300px;
}

.empty-board {
  text-align: center;
  color: #64748b;
  padding: 40px;
  border: 2px dashed rgba(255,255,255,0.1);
  border-radius: 12px;
}

.meld-group {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: rgba(255,255,255,0.03);
  border: 2px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  margin-bottom: 12px;
  min-height: 70px;
  flex-wrap: wrap;
}
</style>