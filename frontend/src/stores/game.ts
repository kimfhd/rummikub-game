import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Tile, Meld, GameState } from '../shared/types';

const COLOR_ORDER: Record<string, number> = {
  'black': 1,
  'red': 2,
  'blue': 3,
  'orange': 4
};

const MAX_PER_ROW = 16;

export const useGameStore = defineStore('game', () => {
  // 本地可操作状态
  const localHand = ref<Tile[][]>([[], []]);
  const localBoard = ref<Meld[]>([]);
  const initialHand = ref<Tile[][]>([[], []]);
  const initialBoard = ref<Meld[]>([]);
  const isBrokenIce = ref(false);
  const sortMode = ref<'manual' | 'runs' | 'groups'>('manual');

  // 是否是自己回合（由 GameView 设置）
  const isMyTurn = ref(false);

  const totalHandCount = computed(() =>
    localHand.value[0].length + localHand.value[1].length
  );

  // ============ 回合管理 ============

  const startTurn = (gameState: GameState, playerId: string) => {
    const me = gameState.players.find(p => p.id === playerId);
    if (!me) return;

    // 深拷贝手牌
    localHand.value = JSON.parse(JSON.stringify(me.hand));
    // 深拷贝桌面
    localBoard.value = JSON.parse(JSON.stringify(gameState.board));
    // 保存初始状态用于重置
    initialHand.value = JSON.parse(JSON.stringify(me.hand));
    initialBoard.value = JSON.parse(JSON.stringify(gameState.board));
    // 破冰状态
    isBrokenIce.value = me.hasBrokenIce;
    // 清除 justDrawn 标记
    localHand.value.forEach(row => row.forEach(t => t.isJustDrawn = false));
  };

  const resetTurn = () => {
    localHand.value = JSON.parse(JSON.stringify(initialHand.value));
    localBoard.value = JSON.parse(JSON.stringify(initialBoard.value));
  };

  const syncRemote = (gameState: GameState, playerId: string) => {
    const me = gameState.players.find(p => p.id === playerId);
    if (!me) return;
    localHand.value = JSON.parse(JSON.stringify(me.hand));
    localBoard.value = JSON.parse(JSON.stringify(gameState.board));
    isBrokenIce.value = me.hasBrokenIce;
  };

  // ============ 排序 ============

  const setSortMode = (mode: 'runs' | 'groups') => {
    if (sortMode.value === mode) {
      sortMode.value = 'manual';
    } else {
      sortMode.value = mode;
      applySort();
    }
  };

  const applySort = () => {
    let all = [...localHand.value[0], ...localHand.value[1]];

    if (sortMode.value === 'runs') {
      all.sort((a, b) =>
        (a.type === 'joker' ? -1 : 0) - (b.type === 'joker' ? -1 : 0) ||
        COLOR_ORDER[a.color] - COLOR_ORDER[b.color] ||
        a.value - b.value
      );
    } else if (sortMode.value === 'groups') {
      all.sort((a, b) =>
        (a.type === 'joker' ? -1 : 0) - (b.type === 'joker' ? -1 : 0) ||
        a.value - b.value ||
        COLOR_ORDER[a.color] - COLOR_ORDER[b.color]
      );
    }

    localHand.value[0] = all.slice(0, Math.min(all.length, MAX_PER_ROW));
    localHand.value[1] = all.slice(localHand.value[0].length);
  };

  // ============ 桌面操作 ============

  const addMeld = () => {
    localBoard.value.push({
      id: `meld-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      tiles: []
    });
  };

  const removeEmptyMelds = () => {
    localBoard.value = localBoard.value.filter(m => m.tiles.length > 0);
  };

  // ============ 牌组合法性验证 ============

  const validateMeld = (tiles: Tile[]): boolean => {
    if (tiles.length < 3) return false;

    const numbers = tiles.filter(t => t.type === 'number');
    const jokers = tiles.filter(t => t.type === 'joker');

    // 刻子：相同数字，不同颜色
    if (numbers.length > 0 && numbers.every(t => t.value === numbers[0].value)) {
      const colors = new Set(numbers.map(t => t.color));
      if (colors.size === numbers.length && numbers.length + jokers.length >= 3) {
        return true;
      }
    }

    // 顺子：相同颜色，连续数字
    if (numbers.length > 0) {
      const color = numbers[0].color;
      if (numbers.every(t => t.color === color)) {
        const sorted = [...numbers].sort((a, b) => a.value - b.value);
        const uniqueValues = new Set(sorted.map(t => t.value));
        if (uniqueValues.size !== sorted.length) return false;

        let gaps = 0;
        for (let i = 1; i < sorted.length; i++) {
          gaps += sorted[i].value - sorted[i - 1].value - 1;
        }
        if (gaps <= jokers.length && sorted.length + jokers.length >= 3) {
          return true;
        }
      }
    }

    return false;
  };

  const validateBoard = (): boolean => {
    return localBoard.value.every(m => m.tiles.length === 0 || validateMeld(m.tiles));
  };

  const getInvalidMelds = (): string[] => {
    return localBoard.value
      .filter(m => m.tiles.length > 0 && !validateMeld(m.tiles))
      .map(m => m.id);
  };

  // ============ 分数计算 ============

  const calculateNewScore = (): number => {
    let score = 0;
    for (const meld of localBoard.value) {
      for (const tile of meld.tiles) {
        if (tile.isNew) {
          score += tile.type === 'joker' ? 10 : tile.value;
        }
      }
    }
    return score;
  };

  const hasNewTileOnBoard = (): boolean => {
    return localBoard.value.some(m => m.tiles.some(t => t.isNew));
  };

  // ============ 结束回合检查 ============

  const canEndTurn = (): { can: boolean; reason?: string } => {
    // 1. 所有牌组合法
    if (!validateBoard()) {
      return { can: false, reason: '桌上有非法牌组' };
    }

    // 2. 必须出了至少一张新牌才能结束回合（或者桌面没有任何变化？参考文件允许重组后结束）
    // 参考文件逻辑：结束回合必须有新牌，否则应该点"摸牌"
    const newScore = calculateNewScore();
    if (newScore === 0) {
      return { can: false, reason: '请先出牌或点击摸牌' };
    }

    // 3. 破冰检查
    if (!isBrokenIce.value && newScore < 30) {
      return { can: false, reason: '未破冰，首次出牌需要至少30分' };
    }

    return { can: true };
  };

  // ============ 排序牌组（用于放入桌面后自动排序） ============

  const sortMeld = (tiles: Tile[]): Tile[] => {
    const nums = tiles.filter(t => t.type === 'number');
    const jokers = tiles.filter(t => t.type === 'joker');
    if (nums.length === 0) return jokers;

    if (nums.every(n => n.value === nums[0].value)) {
      nums.sort((a, b) => COLOR_ORDER[a.color] - COLOR_ORDER[b.color]);
    } else {
      nums.sort((a, b) => a.value - b.value);
    }
    return [...nums, ...jokers];
  };

  return {
    localHand,
    localBoard,
    initialHand,
    initialBoard,
    isBrokenIce,
    sortMode,
    isMyTurn,
    totalHandCount,
    startTurn,
    resetTurn,
    syncRemote,
    setSortMode,
    applySort,
    addMeld,
    removeEmptyMelds,
    validateMeld,
    validateBoard,
    getInvalidMelds,
    calculateNewScore,
    hasNewTileOnBoard,
    canEndTurn,
    sortMeld
  };
});
