import { parseLevel, replay, step, type Dir, type GameState, type Level } from '@crab-game/engine';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { solve } from './index';

function level(map: string[]): Level {
  return parseLevel({
    id: 'test',
    nameKey: 'levels.test.name',
    version: 1,
    map,
    entities: [],
    timeLimitSec: null,
  });
}

describe('solve (spec §5)', () => {
  it('finds par and an optimal solution', () => {
    expect(solve(level(['CG']))).toEqual({
      status: 'solved',
      limit: null,
      par: 1,
      solution: ['R'],
      optimalSolutions: 1,
      reachableStates: 2,
      stuckStates: 0,
    });
  });

  it('counts distinct optimal solutions during the search', () => {
    expect(solve(level(['C.', '.G']))).toMatchObject({
      par: 2,
      optimalSolutions: 2,
      reachableStates: 4,
    });
    // 4 moves, any order of 2 rights and 2 downs: C(4, 2) = 6.
    expect(solve(level(['C..', '...', '..G']))).toMatchObject({
      par: 4,
      optimalSolutions: 6,
      reachableStates: 9,
    });
  });

  it('"moves where no crab moves are skipped"', () => {
    // Left and right are walls: those presses must not count as moves or loop back.
    expect(solve(level(['#C#', '.G.']))).toMatchObject({
      par: 1,
      solution: ['D'],
      optimalSolutions: 1,
      reachableStates: 2,
    });
  });

  it('reports unsolvable levels, with every reachable state stuck', () => {
    // The left crab can never move without falling into the sea.
    expect(solve(level(['C#C.GG']))).toEqual({
      status: 'unsolvable',
      limit: null,
      par: null,
      solution: null,
      optimalSolutions: null,
      reachableStates: 4,
      stuckStates: 4,
    });
  });

  describe('"Hitting a limit is reported as unknown, never as unsolvable"', () => {
    it('state cap', () => {
      expect(solve(level(['C..', '...', '..G']), { maxStates: 3 })).toMatchObject({
        status: 'unknown',
        limit: 'states',
        par: null,
        stuckStates: null,
        reachableStates: 3,
      });
    });

    it('timeout', () => {
      let t = 0;
      const result = solve(level(['C..', '...', '..G']), { timeoutMs: 0, now: () => t++ });
      expect(result).toMatchObject({ status: 'unknown', limit: 'timeout' });
    });

    it('a solution found before the limit still counts as solved', () => {
      expect(solve(level(['C.', 'G.']), { maxStates: 3 })).toEqual({
        status: 'solved',
        limit: 'states',
        par: 1,
        solution: ['D'],
        optimalSolutions: 1,
        reachableStates: 3,
        stuckStates: null,
      });
    });
  });
});

// ---- Cross-check against brute force on random small levels ----

const DIRS: readonly Dir[] = ['U', 'D', 'L', 'R'];

const mapArb = fc
  .record({ width: fc.integer({ min: 2, max: 5 }), height: fc.integer({ min: 1, max: 4 }) })
  .chain(({ width, height }) =>
    fc.array(
      fc.array(fc.constantFrom('.', '.', '.', '#', 'L', 'I', 'C', 'G'), {
        minLength: width,
        maxLength: width,
      }),
      { minLength: height, maxLength: height },
    ),
  )
  .map((grid) => {
    const flat = grid.flat();
    const n = Math.min(
      3,
      flat.filter((c) => c === 'C').length,
      flat.filter((c) => c === 'G').length,
    );
    const seen = { C: 0, G: 0 };
    return grid.map((row) =>
      row
        .map((c) => {
          if (c !== 'C' && c !== 'G') return c;
          seen[c] += 1;
          return seen[c] <= n ? c : '.';
        })
        .join(''),
    );
  })
  .filter((map) => map.join('').includes('C'));

/** Every living state reachable from the start, by plain depth-first search. */
function reachable(lvl: Level): GameState[] {
  const seen = new Map<string, GameState>();
  const visit = (s: GameState) => {
    const key = s.crabs.join(',');
    if (seen.has(key)) return;
    seen.set(key, s);
    if (s.status !== 'playing') return;
    for (const dir of DIRS) {
      const r = step(lvl, s, dir);
      if (r.moved && r.state.status !== 'lost') visit(r.state);
    }
  };
  visit({ crabs: lvl.crabs, moveCount: 0, status: 'playing' });
  return [...seen.values()];
}

/** Number of press sequences of exactly `n` moves that win on the last one. */
function countWinningSequences(lvl: Level, s: GameState, n: number): number {
  if (s.status === 'won') return n === 0 ? 1 : 0;
  if (n === 0 || s.status === 'lost') return 0;
  return DIRS.reduce((sum, dir) => {
    const r = step(lvl, s, dir);
    return r.moved ? sum + countWinningSequences(lvl, r.state, n - 1) : sum;
  }, 0);
}

describe('solve vs. brute force', () => {
  it('agrees on reachable states, stuck states, par and the number of optimal solutions', () => {
    fc.assert(
      fc.property(mapArb, (map) => {
        const lvl = level(map);
        const report = solve(lvl);
        const states = reachable(lvl);

        expect(report.limit).toBeNull();
        expect(report.reachableStates).toBe(states.length);

        const stuck = states.filter(
          (s) =>
            s.status === 'playing' && solve({ ...lvl, crabs: s.crabs }).status === 'unsolvable',
        );
        expect(report.stuckStates).toBe(stuck.length);

        if (report.status === 'unsolvable') {
          expect(states.some((s) => s.status === 'won')).toBe(false);
          return;
        }
        const { par, solution } = report;
        expect(solution).toHaveLength(par ?? -1);
        expect(replay(lvl, solution ?? [])).toMatchObject({ status: 'won', moveCount: par });
        if (par !== null && par <= 6) {
          const start = { crabs: lvl.crabs, moveCount: 0, status: 'playing' as const };
          expect(report.optimalSolutions).toBe(countWinningSequences(lvl, start, par));
          for (let shorter = 0; shorter < par; shorter++) {
            expect(countWinningSequences(lvl, start, shorter)).toBe(0);
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
