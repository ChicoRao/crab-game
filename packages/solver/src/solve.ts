import { initialState, step, type Dir, type GameState, type Level } from '@crab-game/engine';

export const DEFAULT_MAX_STATES = 2_000_000;
export const DEFAULT_TIMEOUT_MS = 30_000;

export interface SolveOptions {
  /** Stop after this many distinct states. */
  maxStates?: number;
  /** Stop after this long. */
  timeoutMs?: number;
  /** Clock, injectable for tests. */
  now?: () => number;
}

export interface SolveReport {
  /** `unknown` = a limit was hit before any solution was found (never reported as unsolvable). */
  status: 'solved' | 'unsolvable' | 'unknown';
  /** Which limit stopped the search early; null = every reachable state was explored. */
  limit: 'states' | 'timeout' | null;
  /** Minimum number of moves. */
  par: number | null;
  /** One optimal solution. */
  solution: Dir[] | null;
  /** Distinct move sequences that win in `par` moves; null if the search stopped before counting them all. */
  optimalSolutions: number | null;
  /** Distinct living crab layouts reached, including the start and wins (a lower bound if `limit` is set). */
  reachableStates: number;
  /** Dead ends: reachable states where every crab is alive but no win is reachable any more. */
  stuckStates: number | null;
}

const DIRS: readonly Dir[] = ['U', 'D', 'L', 'R'];

/** Breadth-first search over crab layouts (spec §5). States with a dead crab are pruned. */
export function solve(level: Level, options: SolveOptions = {}): SolveReport {
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const started = now();

  // Node arrays, indexed by state id (= discovery order, so also BFS order).
  const ids = new Map<string, number>();
  const states: GameState[] = [];
  const depth: number[] = [];
  const ways: number[] = []; // number of shortest move sequences reaching this state
  const parent: number[] = [];
  const parentDir: (Dir | null)[] = [];
  const preds: number[][] = [];

  const add = (state: GameState, d: number, from: number, dir: Dir | null): number => {
    const id = states.length;
    ids.set(state.crabs.join(','), id);
    states.push(state);
    depth.push(d);
    ways.push(0);
    parent.push(from);
    parentDir.push(dir);
    preds.push([]);
    return id;
  };

  add(initialState(level), 0, -1, null);
  ways[0] = 1;
  let firstWin = -1;
  let limit: SolveReport['limit'] = null;
  let optimalCounted = false;

  search: for (let head = 0; head < states.length; head++) {
    const d = depth[head] ?? 0;
    // BFS order: once a state deeper than par-1 is dequeued, every path of length par is counted.
    if (firstWin >= 0 && d >= (depth[firstWin] ?? 0)) optimalCounted = true;
    if (head % 1024 === 0 && now() - started > timeoutMs) {
      limit = 'timeout';
      break;
    }
    const state = states[head];
    if (state?.status !== 'playing') continue; // wins are terminal

    for (const dir of DIRS) {
      const result = step(level, state, dir);
      if (!result.moved || result.state.status === 'lost') continue;
      let id = ids.get(result.state.crabs.join(','));
      if (id === undefined) {
        if (states.length >= maxStates) {
          limit = 'states';
          break search;
        }
        id = add(result.state, d + 1, head, dir);
        if (result.state.status === 'won' && firstWin < 0) firstWin = id;
      }
      if (depth[id] === d + 1) ways[id] = (ways[id] ?? 0) + (ways[head] ?? 0);
      preds[id]?.push(head);
    }
  }
  if (limit === null) optimalCounted = true;

  const reachableStates = states.length;
  const stuckStates = limit === null ? countStuck(states, preds) : null;

  if (firstWin < 0) {
    return {
      status: limit === null ? 'unsolvable' : 'unknown',
      limit,
      par: null,
      solution: null,
      optimalSolutions: null,
      reachableStates,
      stuckStates,
    };
  }

  const par = depth[firstWin] ?? 0;
  const solution: Dir[] = [];
  for (let id = firstWin; parentDir[id]; id = parent[id] ?? -1)
    solution.unshift(parentDir[id] as Dir);

  let optimalSolutions = 0;
  states.forEach((s, id) => {
    if (s.status === 'won' && depth[id] === par) optimalSolutions += ways[id] ?? 0;
  });

  return {
    status: 'solved',
    limit,
    par,
    solution,
    optimalSolutions: optimalCounted ? optimalSolutions : null,
    reachableStates,
    stuckStates,
  };
}

/** Playing states from which no win can be reached: walk backwards from every win. */
function countStuck(states: readonly GameState[], preds: readonly (readonly number[])[]): number {
  const canWin = states.map((s) => s.status === 'won');
  const queue = canWin.flatMap((won, id) => (won ? [id] : []));
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    for (const p of preds[id] ?? []) {
      if (!canWin[p]) {
        canWin[p] = true;
        queue.push(p);
      }
    }
  }
  return canWin.filter((won) => !won).length;
}
