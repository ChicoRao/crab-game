import { Tile, type Level, type LevelJson } from './types';

const CHAR_TILE: Readonly<Record<string, Tile>> = {
  '.': Tile.Floor,
  '#': Tile.Wall,
  G: Tile.Goal,
  L: Tile.Lava,
  I: Tile.Ice,
  '~': Tile.Water,
  C: Tile.Floor,
};

/** Map rows are ASCII (anything else is reported as an unknown character). */
function eachChar(row: string, fn: (c: string, x: number) => void): void {
  for (let x = 0; x < row.length; x++) fn(row.charAt(x), x);
}

export class LevelValidationError extends Error {
  constructor(
    readonly levelId: string,
    readonly issues: readonly string[],
  ) {
    super(`Level "${levelId}" is invalid:\n- ${issues.join('\n- ')}`);
    this.name = 'LevelValidationError';
  }
}

/** Every problem with a level file (spec §3.2). An empty list means it is valid. */
export function validateLevel(json: LevelJson): string[] {
  const issues: string[] = [];
  const { map } = json;
  const width = map[0]?.length ?? 0;

  if (width === 0) return ['Map is empty.'];
  if (map.some((row) => row.length !== width)) {
    issues.push('Map is not rectangular: every row must have the same length.');
  }
  if (json.entities.length > 0) {
    issues.push('Level entities are not supported yet.');
  }

  let crabs = 0;
  let goals = 0;
  map.forEach((row, y) => {
    eachChar(row, (c, x) => {
      if (!(c in CHAR_TILE))
        issues.push(`Unknown map character "${c}" at (${String(x)}, ${String(y)}).`);
      if (c === 'C') crabs++;
      if (c === 'G') goals++;
    });
  });
  if (crabs === 0) issues.push('A level needs at least one crab.');
  if (crabs !== goals) {
    issues.push(`Map has ${String(crabs)} crabs but ${String(goals)} goals; they must match.`);
  }

  for (const [x, y] of inlandWater(map)) {
    issues.push(`Water at (${String(x)}, ${String(y)}) is not connected to the border.`);
  }
  return issues;
}

/** `~` cells that can't reach the map border through other `~` cells. */
function inlandWater(map: readonly string[]): [number, number][] {
  const isWater = (x: number, y: number) => map[y]?.[x] === '~';
  const reached = new Set<string>();
  const queue: [number, number][] = [];
  map.forEach((row, y) => {
    eachChar(row, (_, x) => {
      const onBorder = y === 0 || y === map.length - 1 || x === 0 || x === row.length - 1;
      if (onBorder && isWater(x, y)) {
        reached.add(`${String(x)},${String(y)}`);
        queue.push([x, y]);
      }
    });
  });
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [x, y] = next;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const key = `${String(nx)},${String(ny)}`;
      if (isWater(nx, ny) && !reached.has(key)) {
        reached.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  const inland: [number, number][] = [];
  map.forEach((row, y) => {
    eachChar(row, (_, x) => {
      if (isWater(x, y) && !reached.has(`${String(x)},${String(y)}`)) inland.push([x, y]);
    });
  });
  return inland;
}

/** Parses and validates a level file. Throws `LevelValidationError` if it is invalid. */
export function parseLevel(json: LevelJson): Level {
  const issues = validateLevel(json);
  if (issues.length > 0) throw new LevelValidationError(json.id, issues);

  // Validation guarantees a non-empty rectangle of known characters.
  const height = json.map.length;
  const width = json.map.join('').length / height;
  const tiles = new Uint8Array(width * height);
  const crabs: number[] = [];
  json.map.forEach((row, y) => {
    eachChar(row, (c, x) => {
      const i = y * width + x;
      tiles[i] = CHAR_TILE[c] as Tile;
      if (c === 'C') crabs.push(i);
    });
  });

  return {
    id: json.id,
    nameKey: json.nameKey,
    version: json.version,
    width,
    height,
    tiles,
    crabs,
    timeLimitSec: json.timeLimitSec,
  };
}

/** The tile at (x, y). "Anything outside the map bounds is water" (spec §3.2). */
export function tileAt(level: Level, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return Tile.Water;
  return level.tiles[y * level.width + x] as Tile;
}
