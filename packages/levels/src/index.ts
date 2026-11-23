import bundle from './generated/levels.json' with { type: 'json' };
import type { BuiltLevel } from './types';

export type { BuiltLevel };

/** Every level with its hash, par and golden solution, ordered by id. Built by `pnpm levels:build`. */
export const LEVELS: readonly BuiltLevel[] = bundle as BuiltLevel[];
