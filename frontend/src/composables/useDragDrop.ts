import { ref } from 'vue';
import { Tile, Meld } from '../shared/types';
import { useGameStore } from '../stores/game';

export interface DragSource {
  source: 'hand' | 'board';
  rowIdx?: number;
  mIdx?: number;
  tIdx: number;
  tile: Tile;
}

export function useDragDrop() {
  const gameStore = useGameStore();
  const draggedItem = ref<DragSource | null>(null);
  const dragOverMeldId = ref<string | null>(null);
  const dragOverRowIdx = ref<number | null>(null);

  const startDrag = (item: DragSource) => {
    draggedItem.value = item;
  };

  const endDrag = () => {
    draggedItem.value = null;
    dragOverMeldId.value = null;
    dragOverRowIdx.value = null;
  };

  const setDragOverMeld = (meldId: string | null) => {
    dragOverMeldId.value = meldId;
  };

  const setDragOverRow = (rowIdx: number | null) => {
    dragOverRowIdx.value = rowIdx;
  };

  // 把手牌中的牌放到桌面牌组
  const dropOnMeld = (targetMIdx: number) => {
    const item = draggedItem.value;
    if (!item) return;

    if (item.source === 'hand' && item.rowIdx !== undefined) {
      // 从手牌拖到桌面
      const tile = gameStore.localHand[item.rowIdx].splice(item.tIdx, 1)[0];
      tile.isNew = true;
      gameStore.localBoard[targetMIdx].tiles.push(tile);
      gameStore.localBoard[targetMIdx].tiles = gameStore.sortMeld(gameStore.localBoard[targetMIdx].tiles);
    } else if (item.source === 'board' && item.mIdx !== undefined) {
      // 从桌面牌组拖到另一个桌面牌组
      const tile = gameStore.localBoard[item.mIdx].tiles.splice(item.tIdx, 1)[0];
      gameStore.localBoard[targetMIdx].tiles.push(tile);
      gameStore.localBoard[targetMIdx].tiles = gameStore.sortMeld(gameStore.localBoard[targetMIdx].tiles);
      gameStore.removeEmptyMelds();
    }

    endDrag();
  };

  // 把手牌中的牌放到新牌组
  const dropOnNewMeld = () => {
    const item = draggedItem.value;
    if (!item || item.source !== 'hand' || item.rowIdx === undefined) return;

    const tile = gameStore.localHand[item.rowIdx].splice(item.tIdx, 1)[0];
    tile.isNew = true;
    gameStore.localBoard.push({
      id: `meld-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      tiles: [tile]
    });
    endDrag();
  };

  // 把牌放到手牌行
  const dropOnRack = (targetRowIdx: number, insertIdx?: number) => {
    const item = draggedItem.value;
    if (!item) return;

    let tile: Tile;

    if (item.source === 'hand' && item.rowIdx !== undefined) {
      // 手牌行之间移动
      tile = gameStore.localHand[item.rowIdx].splice(item.tIdx, 1)[0];
    } else if (item.source === 'board' && item.mIdx !== undefined) {
      // 从桌面拖回手牌
      // 检查权限：未破冰时只能拖回 isNew 的牌
      tile = gameStore.localBoard[item.mIdx].tiles[item.tIdx];
      if (!tile.isNew && !gameStore.isBrokenIce) {
        endDrag();
        return;
      }
      tile = gameStore.localBoard[item.mIdx].tiles.splice(item.tIdx, 1)[0];
      tile.isNew = false;
      gameStore.removeEmptyMelds();
    } else {
      endDrag();
      return;
    }

    // 插入到指定位置
    const idx = insertIdx !== undefined ? insertIdx : gameStore.localHand[targetRowIdx].length;
    gameStore.localHand[targetRowIdx].splice(idx, 0, tile);

    // 非手动排序模式下自动排序
    if (gameStore.sortMode !== 'manual') {
      gameStore.applySort();
    }

    endDrag();
  };

  return {
    draggedItem,
    dragOverMeldId,
    dragOverRowIdx,
    startDrag,
    endDrag,
    setDragOverMeld,
    setDragOverRow,
    dropOnMeld,
    dropOnNewMeld,
    dropOnRack
  };
}
