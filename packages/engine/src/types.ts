/** Bump on any intended change to how the rules behave (spec §3.5, docs/engineering.md §5.1). */
export const RULES_VERSION = 1;

/** Terrain tile values stored in `Level.tiles` (spec §3.4). */
export const Tile = {
  Floor: 0,
  Wall: 1,
  Goal: 2,
  Lava: 3,
  Ice: 4,
  Water: 5,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

export type Dir = 'U' | 'D' | 'L' | 'R';

/** The hand-written level file (spec §3.2). */
export interface LevelJson {
  id: string;
  nameKey: string;
  version: number;
  map: string[];
  entities: unknown[];
  timeLimitSec: number | null;
}

/** A parsed level: terrain as a flat array indexed `y * width + x` (spec §3.4). */
export interface Level {
  readonly id: string;
  readonly nameKey: string;
  readonly version: number;
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;
  /** Starting crab positions: sorted tile indexes. */
  readonly crabs: readonly number[];
  readonly timeLimitSec: number | null;
}

export interface GameState {
  /**
   * Tile indexes of the living crabs, kept sorted. A crab that falls into water or lava
   * is removed (it may have left the map, where there is no index), so the count only
   * changes on the move that loses the game.
   */
  readonly crabs: readonly number[];
  /** Only moves where at least one crab moved (spec §2.3.5). */
  readonly moveCount: number;
  readonly status: 'playing' | 'won' | 'lost';
}

export interface Pos {
  readonly x: number;
  readonly y: number;
}

/**
 * Drives animation. `subStep` is 0 for the normal step and 1, 2, … for ice slide
 * sub-steps (spec §2.4). `fell.to` may lie outside the map.
 */
export type GameEvent =
  | { type: 'moved'; from: Pos; to: Pos; subStep: 0 }
  | { type: 'slid'; from: Pos; to: Pos; subStep: number }
  | { type: 'blocked'; at: Pos; subStep: number }
  | { type: 'fell'; from: Pos; to: Pos; into: 'water' | 'lava'; subStep: number }
  | { type: 'bumped' }
  | { type: 'won' };

export interface StepResult {
  readonly state: GameState;
  /** false = every crab was blocked; the caller doesn't record the move. */
  readonly moved: boolean;
  readonly events: readonly GameEvent[];
}
