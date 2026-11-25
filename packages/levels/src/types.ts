import type { Dir, LevelJson } from '@crab-game/engine';

/**
 * A level as the game uses it (spec §3.3). Kept apart from the build pipeline so the
 * web app can import the bundle without pulling in Node-only code (crypto, solver).
 * It has no solution on purpose: the web bundle must not ship the answers to players.
 */
export interface PlayableLevel {
  id: string;
  version: number;
  rulesVersion: number;
  /** SHA-256 of the gameplay-relevant content: map + entities + rules version. */
  hash: string;
  par: number;
  source: LevelJson;
}

/** A level plus its golden solution. Only the build step and tests use this. */
export interface BuiltLevel extends PlayableLevel {
  /** The golden solution: replays to `won` in exactly `par` moves. */
  solution: Dir[];
}

/** Golden solutions by level id, stored apart from the playable bundle. */
export type SolutionMap = Record<string, Dir[]>;
