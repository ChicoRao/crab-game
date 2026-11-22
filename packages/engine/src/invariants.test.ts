import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { initialState, replay, step, Tile, type Dir, type GameState } from './index';
import { level } from './test-utils';

/**
 * Random valid maps: an interior of floor / wall / lava / ice with some crabs and goals,
 * and a border that is either water or open floor (so crabs can also walk off the map).
 * Extra crabs or goals are turned into floor so that crabs = goals.
 */
const mapArb = fc
  .record({ width: fc.integer({ min: 2, max: 7 }), height: fc.integer({ min: 2, max: 6 }) })
  .chain(({ width, height }) =>
    fc.array(
      fc.array(fc.constantFrom('.', '.', '.', '#', 'L', 'I', 'I', 'C', 'G', '~'), {
        minLength: width,
        maxLength: width,
      }),
      { minLength: height, maxLength: height },
    ),
  )
  .map((grid) => {
    const height = grid.length;
    const cells = grid.map((row, y) =>
      row.map((c, x) => {
        const onBorder = y === 0 || y === height - 1 || x === 0 || x === row.length - 1;
        return c === '~' && !onBorder ? '.' : c;
      }),
    );
    const flat = cells.flat();
    const n = Math.min(flat.filter((c) => c === 'C').length, flat.filter((c) => c === 'G').length);
    const seen = { C: 0, G: 0 };
    return cells.map((row) =>
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

const movesArb = fc.array(fc.constantFrom<Dir>('U', 'D', 'L', 'R'), { maxLength: 30 });

const HAZARDS: readonly number[] = [Tile.Water, Tile.Lava];

describe('engine invariants (docs/engineering.md §5)', () => {
  it('hold for random levels and move sequences', () => {
    fc.assert(
      fc.property(mapArb, movesArb, (map, moves) => {
        const lvl = level(map);
        const crabCount = lvl.crabs.length;
        let state: GameState = initialState(lvl);
        let movedSteps = 0;

        for (const dir of moves) {
          const before = state;
          // "Ice slides always end within the sub-step cap": step() throws if they don't.
          const result = step(lvl, before, dir);
          state = result.state;

          if (!result.moved) {
            // "If step() returns moved: false, the returned state equals the input state exactly"
            expect(state).toEqual(before);
            continue;
          }
          movedSteps += 1;

          // "Crabs never share a tile" (and stay sorted).
          expect(new Set(state.crabs).size).toBe(state.crabs.length);
          expect(state.crabs).toEqual([...state.crabs].sort((a, b) => a - b));
          // "A crab never ends a move inside a wall"; living crabs are never in a hazard.
          for (const i of state.crabs) {
            expect(lvl.tiles[i]).not.toBe(Tile.Wall);
            expect(HAZARDS).not.toContain(lvl.tiles[i]);
          }
          // "Crab count never changes while status = playing"
          if (state.status === 'playing') expect(state.crabs.length).toBe(crabCount);
          // "won ⇔ every crab on a goal"
          const allOnGoals =
            state.crabs.length === crabCount &&
            state.crabs.every((i) => lvl.tiles[i] === Tile.Goal);
          expect(state.status === 'won').toBe(allOnGoals);
          // "lost ⇔ some crab in water/lava": a crab fell during this move.
          expect(state.status === 'lost').toBe(result.events.some((e) => e.type === 'fell'));
        }

        // "moveCount equals the number of steps that returned moved: true"
        expect(state.moveCount).toBe(movedSteps);
        // "replay(level, moves) is deterministic"
        expect(replay(lvl, moves)).toEqual(state);
        expect(replay(lvl, moves)).toEqual(replay(lvl, moves));
      }),
      { numRuns: 500 },
    );
  });
});
