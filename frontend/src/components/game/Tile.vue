<template>
  <div 
    :class="['tile', tile.color, { 'on-board': onBoard, 'joker': tile.type === 'joker' }]"
    :draggable="draggable"
  >
    <span v-if="tile.type === 'joker'">☻</span>
    <span v-else>{{ tile.value }}</span>
  </div>
</template>

<script setup lang="ts">
import { Tile as TileType } from '../../../shared/types';

defineProps<{
  tile: TileType;
  onBoard?: boolean;
  draggable?: boolean;
}>();
</script>

<style scoped>
.tile {
  width: 42px;
  height: 58px;
  background: #ffffff;
  border-radius: 6px;
  box-shadow: 0 4px 0 #cbd5e1, 0 6px 10px rgba(0,0,0,0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 900;
  font-size: 22px;
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
}

.tile:active { cursor: grabbing; }

.tile.on-board {
  width: 38px;
  height: 52px;
  font-size: 18px;
}

.tile.joker {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
}

.color-black { color: #1e293b; }
.color-red { color: #ef4444; }
.color-blue { color: #3b82f6; }
.color-orange { color: #f97316; }
</style>