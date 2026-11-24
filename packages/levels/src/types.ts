import type { Dir, LevelJson } from '@crab-game/engine';

/**
 * A level as stored in the bundle (spec §3.3). Kept apart from the build pipeline so the
 * web app can import the bundle without pulling in Node-only code (crypto, solver).
 */
export interface BuiltLevel {
  id: string;
  version: number;
  rulesVersion: number;
  /** SHA-256 of the gameplay-relevant content: map + entities + rules version. */
  hash: string;
  par: number;
  /** The golden solution: replays to `won` in exactly `par` moves. */
  solution: Dir[];
  source: LevelJson;
}
