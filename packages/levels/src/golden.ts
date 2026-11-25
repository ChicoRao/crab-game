import { joinBundle } from './bundle';
import solutions from './generated/solutions.json' with { type: 'json' };
import { LEVELS } from './index';
import type { BuiltLevel, SolutionMap } from './types';

export type { BuiltLevel };

/** Every level with its golden solution. For tests and tools only; the web app must not import this. */
export const GOLDEN_LEVELS: readonly BuiltLevel[] = joinBundle(LEVELS, solutions as SolutionMap);
