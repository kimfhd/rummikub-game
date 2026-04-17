<template>
  <div class="player-rack">
    <div class="rack-controls">
      <button @click="emit('sort', 'runs')" class="btn-sort">按颜色</button>
      <button @click="emit('sort', 'groups')" class="btn-sort">按数字</button>
    </div>
    
    <div class="rack-rows">
      <div v-for="(row, rIdx) in rows" :key="rIdx" class="rack-row">
        <Tile 
          v-for="tile in row" 
          :key="tile.id" 
          :tile="tile"
          draggable
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tile as TileType } from '../../../shared/types';
import Tile from './Tile.vue';

defineProps<{
  rows: TileType[][];
}>();

const emit = defineEmits<{
  play: [melds: any[]];
  sort: [mode: 'runs' | 'groups'];
}>();
</script>

<style scoped>
.player-rack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rack-controls {
  display: flex;
  gap: 8px;
}

.btn-sort {
  background: rgba(255,255,255,0.1);
  border: none;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.rack-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rack-row {
  display: flex;
  gap: 6px;
  min-height: 70px;
  background: rgba(0,0,0,0.2);
  border-radius: 10px;
  padding: 8px;
  overflow-x: auto;
}
</style>