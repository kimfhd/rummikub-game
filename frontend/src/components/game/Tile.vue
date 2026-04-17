<template>
  <div
    :class="[
      'tile',
      `color-${tile.color}`,
      {
        'on-board': onBoard,
        'joker': tile.type === 'joker',
        'is-new': tile.isNew,
        'is-locked': isLocked,
        'is-just-drawn': tile.isJustDrawn
      }
    ]"
    :draggable="draggable && !isLocked"
    :data-index="dataIndex"
    @dragstart="onDragStart"
    @click="onClick"
  >
    <span v-if="tile.type === 'joker'">☻</span>
    <span v-else>{{ tile.value }}</span>
  </div>
</template>

<script setup lang="ts">
import { Tile as TileType } from '../../../shared/types';

const props = defineProps<{
  tile: TileType;
  onBoard?: boolean;
  draggable?: boolean;
  isLocked?: boolean;
  dataIndex?: number;
}>();

const emit = defineEmits<{
  dragstart: [event: DragEvent];
  click: [];
}>();

const onDragStart = (e: DragEvent) => {
  if (!props.draggable || props.isLocked) {
    e.preventDefault();
    return;
  }
  emit('dragstart', e);
};

const onClick = () => {
  emit('click');
};
</script>

<style scoped>
.tile {
  width: 42px;
  height: 58px;
  background: #ffffff;
  border-radius: 6px;
  box-shadow: 0 4px 0 #cbd5e1, 0 6px 10px rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 900;
  font-size: 22px;
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s;
  position: relative;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.tile:active {
  cursor: grabbing;
}

.tile.on-board {
  width: 38px;
  height: 52px;
  font-size: 18px;
}

.tile.joker {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
}

.tile.is-new {
  box-shadow: 0 0 0 2px #38bdf8, 0 4px 0 #0284c7;
  animation: highlight-pulse 2s infinite;
}

.tile.is-locked {
  background: #f1f5f9;
  box-shadow: 0 2px 0 #94a3b8, 0 4px 8px rgba(0, 0, 0, 0.2);
  filter: saturate(0.6);
  cursor: default;
}

.tile.is-just-drawn {
  animation: tile-pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes highlight-pulse {
  0% { box-shadow: 0 0 0 2px #38bdf8, 0 4px 0 #0284c7; }
  50% { box-shadow: 0 0 12px 4px #38bdf8, 0 4px 0 #0284c7; }
  100% { box-shadow: 0 0 0 2px #38bdf8, 0 4px 0 #0284c7; }
}

@keyframes tile-pop-in {
  0% { transform: scale(0) translateY(20px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

.color-black { color: #1e293b; }
.color-red { color: #ef4444; }
.color-blue { color: #3b82f6; }
.color-orange { color: #f97316; }
</style>
