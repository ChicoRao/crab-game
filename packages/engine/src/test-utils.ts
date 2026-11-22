import { parseLevel, Tile, type GameState, type Level, type LevelJson } from './index';

export function levelJson(map: string[]): LevelJson {
  return {
    id: 'test',
    nameKey: 'levels.test.name',
    version: 1,
    map,
    entities: [],
    timeLimitSec: null,
  };
}

export function level(map: string[]): Level {
  return parseLevel(levelJson(map));
}

const TILE_CHAR: Record<Tile, string> = {
  [Tile.Floor]: '.',
  [Tile.Wall]: '#',
  [Tile.Goal]: 'G',
  [Tile.Lava]: 'L',
  [Tile.Ice]: 'I',
  [Tile.Water]: '~',
};

/** Crab on a floor tile = `C`, on a goal = `c`, on ice = `k`. */
const CRAB_CHAR: Partial<Record<Tile, string>> = {
  [Tile.Floor]: 'C',
  [Tile.Goal]: 'c',
  [Tile.Ice]: 'k',
};

/** Draws the board as map rows so tests can compare positions visually. */
export function render(lvl: Level, state: GameState): string[] {
  const rows: string[] = [];
  for (let y = 0; y < lvl.height; y++) {
    let row = '';
    for (let x = 0; x < lvl.width; x++) {
      const i = y * lvl.width + x;
      const tile = lvl.tiles[i] as Tile;
      row += state.crabs.includes(i) ? (CRAB_CHAR[tile] ?? '?') : TILE_CHAR[tile];
    }
    rows.push(row);
  }
  return rows;
}
