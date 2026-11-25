import bundle from './generated/levels.json' with { type: 'json' };
import type { PlayableLevel } from './types';

export type { PlayableLevel };

/**
 * Every level with its hash and par, ordered by id. Built by `pnpm levels:build`.
 * No golden solutions here: this is what ships to players. Tests use `@crab-game/levels/golden`.
 */
export const LEVELS: readonly PlayableLevel[] = bundle;
