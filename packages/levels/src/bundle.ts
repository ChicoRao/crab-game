import type { BuiltLevel, PlayableLevel, SolutionMap } from './types';

/** Splits built levels into the playable bundle (shipped to players) and the golden solutions (not shipped). */
export function splitBundle(levels: readonly BuiltLevel[]): {
  playable: PlayableLevel[];
  solutions: SolutionMap;
} {
  const playable: PlayableLevel[] = [];
  const solutions: SolutionMap = {};
  for (const { solution, ...level } of levels) {
    playable.push(level);
    solutions[level.id] = solution;
  }
  return { playable, solutions };
}

/** Joins the two committed files back into built levels. A level with no stored solution gets an empty one. */
export function joinBundle(
  playable: readonly PlayableLevel[],
  solutions: Readonly<SolutionMap>,
): BuiltLevel[] {
  return playable.map((level) => ({ ...level, solution: solutions[level.id] ?? [] }));
}
