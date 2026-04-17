import { Meld, Tile, Color, ErrorCode } from '../shared/types';

const COLOR_ORDER: Record<Color, number> = {
  'black': 1,
  'red': 2,
  'blue': 3,
  'orange': 4
};

export class GameValidator {
  // 验证牌组合法性
  static validateMeld(meld: Tile[]): { valid: boolean; type?: 'run' | 'group'; score: number } {
    if (meld.length < 3) {
      return { valid: false, score: 0 };
    }

    const numbers = meld.filter(t => t.type === 'number');
    const jokers = meld.filter(t => t.type === 'joker');
    const score = meld.reduce((sum, t) => sum + (t.type === 'joker' ? 10 : t.value), 0);

    // 检查刻子（Group）：相同数字，不同颜色
    if (numbers.length > 0 && numbers.every(t => t.value === numbers[0].value)) {
      const colors = new Set(numbers.map(t => t.color));
      // 颜色不能重复（除非有鬼牌替代）
      if (colors.size === numbers.length && numbers.length + jokers.length >= 3) {
        return { valid: true, type: 'group', score };
      }
    }

    // 检查顺子（Run）：相同颜色，连续数字
    if (numbers.length > 0) {
      const color = numbers[0].color;
      if (numbers.every(t => t.color === color)) {
        const sorted = [...numbers].sort((a, b) => a.value - b.value);
        const uniqueValues = new Set(sorted.map(t => t.value));
        
        if (uniqueValues.size !== sorted.length) {
          return { valid: false, score }; // 重复数字
        }

        // 检查连续性（允许鬼牌填补空缺）
        let gaps = 0;
        for (let i = 1; i < sorted.length; i++) {
          gaps += sorted[i].value - sorted[i-1].value - 1;
        }

        if (gaps <= jokers.length && sorted.length + jokers.length >= 3) {
          return { valid: true, type: 'run', score };
        }
      }
    }

    return { valid: false, score };
  }

  // 验证整个盘面
  static validateBoard(board: Meld[]): { valid: boolean; invalidMelds: string[] } {
    const invalidMelds: string[] = [];
    
    for (const meld of board) {
      if (meld.tiles.length === 0) continue;
      const result = this.validateMeld(meld.tiles);
      if (!result.valid) {
        invalidMelds.push(meld.id);
      }
    }

    return {
      valid: invalidMelds.length === 0,
      invalidMelds
    };
  }

  // 计算破冰所需分数
  static calculateBreakIceScore(board: Meld[], playerId: string): number {
    let score = 0;
    for (const meld of board) {
      // 只计算该玩家本回合放置的新牌
      const newTiles = meld.tiles.filter(t => t.isNew);
      if (newTiles.length > 0) {
        score += newTiles.reduce((sum, t) => sum + (t.type === 'joker' ? 10 : t.value), 0);
      }
    }
    return score;
  }

  // 检查玩家操作后的局面是否有效
  static validateTurn(
    initialBoard: Meld[],
    currentBoard: Meld[],
    playerHand: Tile[][],
    hasBrokenIce: boolean
  ): { valid: boolean; error?: ErrorCode; message?: string } {
    // 1. 验证所有牌组有效
    const boardValidation = this.validateBoard(currentBoard);
    if (!boardValidation.valid) {
      return { valid: false, error: ErrorCode.INVALID_MELD, message: '存在无效的牌组' };
    }

    // 2. 检查是否有新牌被放置（必须至少出一張牌或有其他操作）
    let hasNewTile = false;
    for (const meld of currentBoard) {
      if (meld.tiles.some(t => t.isNew)) {
        hasNewTile = true;
        break;
      }
    }

    // 3. 如果没出新牌，检查是否只进行了合法的重组（这个比较复杂，简化处理）
    // 实际上应该追踪每张牌的来源，这里先做简化验证

    return { valid: true };
  }
}