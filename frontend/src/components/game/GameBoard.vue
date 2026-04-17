<template>
  <div class="game-board">
    <div v-if="melds.length === 0 && !isMyTurn" class="empty-board">
      桌面上还没有牌组
    </div>

    <div
      v-for="(meld, mIdx) in melds"
      :key="meld.id"
      :class="[
        'meld-group',
        { 'invalid': invalidMeldIds.includes(meld.id), 'drag-over': dragOverMeldId === meld.id }
      ]"
      @dragover="onMeldDragOver($event, meld.id)"
      @dragleave="onMeldDragLeave"
      @drop="onMeldDrop($event, mIdx)"
    >
      <Tile
        v-for="(tile, tIdx) in meld.tiles"
        :key="tile.id"
        :tile="tile"
        :on-board="true"
        :draggable="isMyTurn"
        :is-locked="!tile.isNew && !isBrokenIce"
        @dragstart="$emit('tileDragStart', { source: 'board', mIdx, tIdx, tile })"
        @click="$emit('tileClick', { source: 'board', mIdx, tIdx, tile })"
      />
    </div>

    <!-- 新牌组占位区 -->
    <div
      v-if="isMyTurn"
      :class="['meld-group', 'new-meld-placeholder', { 'drag-over': dragOverMeldId === 'new' }]"
      @dragover="onNewMeldDragOver($event)"
      @dragleave="onMeldDragLeave"
      @drop="onNewMeldDrop($event)"
      @click="$emit('addMeld')"
    >
      <span>+ 新牌组</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Meld, Tile as TileType } from '../../../shared/types';
import Tile from './Tile.vue';

defineProps<{
  melds: Meld[];
  isMyTurn: boolean;
  isBrokenIce: boolean;
  invalidMeldIds: string[];
  dragOverMeldId: string | null;
}>();

const emit = defineEmits<{
  tileDragStart: [item: { source: 'board'; mIdx: number; tIdx: number; tile: Tile }];
  tileClick: [item: { source: 'board'; mIdx: number; tIdx: number; tile: TileType }];
  addMeld: [];
  dropOnMeld: [mIdx: number];
  dropOnNewMeld: [];
  setDragOverMeld: [meldId: string | null];
}>();

const onMeldDragOver = (e: DragEvent, meldId: string) => {
  e.preventDefault();
  emit('setDragOverMeld', meldId);
};

const onNewMeldDragOver = (e: DragEvent) => {
  e.preventDefault();
  emit('setDragOverMeld', 'new');
};

const onMeldDragLeave = () => {
  emit('setDragOverMeld', null);
};

const onMeldDrop = (e: DragEvent, mIdx: number) => {
  e.preventDefault();
  emit('setDragOverMeld', null);
  emit('dropOnMeld', mIdx);
};

const onNewMeldDrop = (e: DragEvent) => {
  e.preventDefault();
  emit('setDragOverMeld', null);
  emit('dropOnNewMeld');
};
</script>

<style scoped>
.game-board {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-board {
  text-align: center;
  color: #64748b;
  padding: 40px;
  border: 2px dashed rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.meld-group {
  background: rgba(255, 255, 255, 0.03);
  border: 2px solid rgba(255, 255, 255, 0.06);
  padding: 10px;
  border-radius: 12px;
  display: flex;
  gap: 6px;
  min-height: 80px;
  flex-wrap: wrap;
  align-items: center;
  transition: background 0.2s, border-color 0.2s;
}

.meld-group.invalid {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.meld-group.drag-over {
  background: rgba(56, 189, 248, 0.1);
  border-color: rgba(56, 189, 248, 0.3);
}

.new-meld-placeholder {
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.1);
  justify-content: center;
  align-items: center;
  color: rgba(255, 255, 255, 0.2);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  min-height: 80px;
}

.new-meld-placeholder:hover {
  background: rgba(255, 255, 255, 0.05);
}
</style>
