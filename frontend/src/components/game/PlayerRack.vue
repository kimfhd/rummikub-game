<template>
  <div class="player-rack">
    <div class="rack-header">
      <div class="rack-controls">
        <button
          :class="['btn-sort', { active: sortMode === 'runs' }]"
          @click="$emit('sort', 'runs')"
        >
          按颜色排序
        </button>
        <button
          :class="['btn-sort', { active: sortMode === 'groups' }]"
          @click="$emit('sort', 'groups')"
        >
          按数字排序
        </button>
      </div>
      <div class="rack-info">
        <span class="hand-count">我的手牌 {{ totalCount }}</span>
        <span :class="['ice-status', isBrokenIce ? 'broken' : 'not-broken']">
          {{ isBrokenIce ? '已破冰' : '未破冰 (需30分)' }}
        </span>
      </div>
    </div>

    <div class="rack-rows">
      <div
        v-for="(row, rIdx) in rows"
        :key="rIdx"
        :class="['rack-row', { 'drag-over': dragOverRowIdx === rIdx }]"
        @dragover="onRowDragOver($event, rIdx)"
        @dragleave="onRowDragLeave"
        @drop="onRowDrop($event, rIdx)"
      >
        <Tile
          v-for="(tile, tIdx) in row"
          :key="tile.id"
          :tile="tile"
          :draggable="isMyTurn"
          :data-index="tIdx"
          @dragstart="$emit('tileDragStart', { source: 'hand', rowIdx: rIdx, tIdx, tile })"
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
  isMyTurn: boolean;
  isBrokenIce: boolean;
  sortMode: 'manual' | 'runs' | 'groups';
  totalCount: number;
  dragOverRowIdx: number | null;
}>();

const emit = defineEmits<{
  sort: [mode: 'runs' | 'groups'];
  tileDragStart: [item: { source: 'hand'; rowIdx: number; tIdx: number; tile: TileType }];
  dropOnRack: [rowIdx: number, insertIdx?: number];
  setDragOverRow: [rowIdx: number | null];
}>();

const onRowDragOver = (e: DragEvent, rIdx: number) => {
  e.preventDefault();
  emit('setDragOverRow', rIdx);
};

const onRowDragLeave = () => {
  emit('setDragOverRow', null);
};

const onRowDrop = (e: DragEvent, rIdx: number) => {
  e.preventDefault();
  emit('setDragOverRow', null);

  // 计算插入位置
  let insertIdx: number | undefined;
  const targetEl = (e.target as HTMLElement).closest('.tile') as HTMLElement;
  if (targetEl && targetEl.parentElement?.classList.contains('rack-row')) {
    const rect = targetEl.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const idx = parseInt(targetEl.dataset.index || '0');
    insertIdx = e.clientX < midX ? idx : idx + 1;
  }

  emit('dropOnRack', rIdx, insertIdx);
};
</script>

<style scoped>
.player-rack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.rack-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.rack-controls {
  display: flex;
  gap: 8px;
}

.btn-sort {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-sort:hover {
  background: rgba(255, 255, 255, 0.1);
}

.btn-sort.active {
  background: #3b82f6;
  color: white;
  border-color: #60a5fa;
}

.rack-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hand-count {
  font-size: 14px;
  font-weight: 700;
  color: #e2e8f0;
}

.ice-status {
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid;
}

.ice-status.broken {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.2);
}

.ice-status.not-broken {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}

.rack-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rack-row {
  display: flex;
  gap: 6px;
  min-height: 74px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 8px;
  overflow-x: auto;
  align-items: center;
  scrollbar-width: none;
  white-space: nowrap;
  transition: background 0.2s;
}

.rack-row::-webkit-scrollbar {
  display: none;
}

.rack-row.drag-over {
  background: rgba(56, 189, 248, 0.1);
}
</style>
