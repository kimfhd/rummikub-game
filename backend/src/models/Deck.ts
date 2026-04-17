import { Tile, Color } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class Deck {
  private tiles: Tile[] = [];

  constructor() {
    this.initialize();
    this.shuffle();
  }

  private initialize(): void {
    const colors: Color[] = ['black', 'red', 'blue', 'orange'];
    
    // 每种颜色两份 1-13
    for (let deck = 0; deck < 2; deck++) {
      for (const color of colors) {
        for (let value = 1; value <= 13; value++) {
          this.tiles.push({
            id: uuidv4(),
            value,
            color,
            type: 'number'
          });
        }
      }
    }

    // 两张鬼牌
    for (let i = 0; i < 2; i++) {
      this.tiles.push({
        id: uuidv4(),
        value: 0,
        color: 'black',
        type: 'joker'
      });
    }
  }

  private shuffle(): void {
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
  }

  draw(count: number = 1): Tile[] {
    return this.tiles.splice(0, count);
  }

  drawOne(): Tile | null {
    return this.tiles.length > 0 ? this.tiles.shift()! : null;
  }

  remaining(): number {
    return this.tiles.length;
  }

  // 序列化用于存储
  toJSON(): Tile[] {
    return [...this.tiles];
  }

  // 从数据恢复
  static fromJSON(tiles: Tile[]): Deck {
    const deck = new Deck();
    deck.tiles = tiles;
    return deck;
  }
}