import type { GameEvent, Pos } from '@crab-game/engine';

/** Where one crab is at the start and after each sub-step of a move. */
export interface CrabTrack {
  /** `path[s]` = position before sub-step `s`; `path.length = subSteps + 1`. */
  readonly path: readonly Pos[];
  /** The sub-step in which this crab fell, or null if it survived. */
  readonly fellAt: number | null;
}

export interface Timeline {
  readonly subSteps: number;
  readonly tracks: readonly CrabTrack[];
}

const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

/**
 * Turns a move's events into per-crab paths, one point per sub-step (spec §4: events carry
 * `subStep`, 0 = the normal step, 1, 2, … = ice slides). Crabs are matched by position.
 */
export function buildTimeline(start: readonly Pos[], events: readonly GameEvent[]): Timeline {
  let subSteps = 1;
  for (const e of events) if ('subStep' in e) subSteps = Math.max(subSteps, e.subStep + 1);

  const paths = start.map((p) => [p]);
  const fellAt: (number | null)[] = start.map(() => null);

  for (let s = 0; s < subSteps; s++) {
    const next = paths.map((path) => path[path.length - 1] ?? { x: 0, y: 0 });
    for (const e of events) {
      if (e.type !== 'moved' && e.type !== 'slid' && e.type !== 'fell') continue;
      if (e.subStep !== s) continue;
      const i = paths.findIndex((path, k) => fellAt[k] === null && same(path[s] ?? e.to, e.from));
      if (i === -1) continue;
      next[i] = e.to;
      if (e.type === 'fell') fellAt[i] = s;
    }
    next.forEach((p, i) => paths[i]?.push(p));
  }

  return { subSteps, tracks: paths.map((path, i) => ({ path, fellAt: fellAt[i] ?? null })) };
}
