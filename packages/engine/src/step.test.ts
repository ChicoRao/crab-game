import { describe, expect, it } from 'vitest';
import { initialState, replay, RULES_VERSION, step, type Dir, type GameState } from './index';
import { level, render } from './test-utils';

function play(map: string[], dirs: Dir[]) {
  const lvl = level(map);
  let state = initialState(lvl);
  let last = step(lvl, state, dirs[0] ?? 'R');
  state = last.state;
  for (const dir of dirs.slice(1)) {
    last = step(lvl, state, dir);
    state = last.state;
  }
  return { lvl, state, last, board: render(lvl, state) };
}

describe('engine basics (spec §4)', () => {
  it('exports RULES_VERSION = 1', () => {
    expect(RULES_VERSION).toBe(1);
  });

  it('initialState starts playing with zero moves', () => {
    const lvl = level(['C.G']);
    expect(initialState(lvl)).toEqual({ crabs: [0], moveCount: 0, status: 'playing' });
  });
});

describe('movement (spec §2.3)', () => {
  it('"Every crab tries to move exactly one tile in the chosen direction"', () => {
    const map = ['.....', '.C...', '...C.', '.G.G.', '.....'];
    expect(play(map, ['R']).board).toEqual(['.....', '..C..', '....C', '.G.G.', '.....']);
    expect(play(map, ['L']).board).toEqual(['.....', 'C....', '..C..', '.G.G.', '.....']);
    expect(play(map, ['U']).board).toEqual(['.C...', '...C.', '.....', '.G.G.', '.....']);
    expect(play(map, ['D']).board).toEqual(['.....', '.....', '.C...', '.G.c.', '.....']);
  });

  it('"A crab facing a wall stays put. The other crabs still move."', () => {
    const { board, last } = play(['C#..', '.C..', 'GG..'], ['R']);
    expect(board).toEqual(['C#..', '..C.', 'GG..']);
    expect(last.events).toContainEqual({ type: 'blocked', at: { x: 0, y: 0 }, subStep: 0 });
    expect(last.events).toContainEqual({
      type: 'moved',
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
      subStep: 0,
    });
  });

  it('"a whole chain behind a blocked crab stays put"', () => {
    const { board } = play(['.CCC#', '.C...', 'GGGG.'], ['R']);
    expect(board).toEqual(['.CCC#', '..C..', 'GGGG.']);
  });

  it('front-first resolution: a line of crabs with free space ahead all moves (every direction)', () => {
    expect(play(['CCC..', 'GGG..'], ['R']).board).toEqual(['.CCC.', 'GGG..']);
    expect(play(['..CCC', '..GGG'], ['L']).board).toEqual(['.CCC.', '..GGG']);
    expect(play(['.G', '.G', 'C.', 'C.', '..'], ['U']).board).toEqual([
      '.G',
      'CG',
      'C.',
      '..',
      '..',
    ]);
    expect(play(['C.', 'C.', '.G', '.G', '..'], ['D']).board).toEqual([
      '..',
      'C.',
      'CG',
      '.G',
      '..',
    ]);
  });

  it('a crab walking off a goal is not locked (§2.5 "Crabs on goals are not locked")', () => {
    const { state } = play(['CG.', 'C..', 'G..'], ['R', 'R']);
    expect(state.status).toBe('playing');
    expect(state.crabs).toEqual([2, 5]);
  });

  it('moveCount counts each move where a crab moved', () => {
    expect(play(['C...G'], ['R', 'R']).state.moveCount).toBe(2);
  });

  describe('"A move only counts if at least one crab moves" (§2.3.5)', () => {
    it('returns moved: false, the identical state and a bump event', () => {
      const lvl = level(['#C#', 'G.G', '#C#']);
      const before: GameState = { crabs: [1, 7], moveCount: 3, status: 'playing' };
      const result = step(lvl, before, 'L');
      expect(result.moved).toBe(false);
      expect(result.state).toEqual(before);
      expect(result.events).toContainEqual({ type: 'bumped' });
      expect(result.events.filter((e) => e.type === 'blocked')).toHaveLength(2);
    });
  });
});

describe('win / lose (spec §2.5)', () => {
  it('"Win: every crab is on a goal tile at the same time"', () => {
    const { state, last } = play(['C.G', 'C.G'], ['R']);
    expect(state.status).toBe('playing');
    const won = step(level(['C.G', 'C.G']), state, 'R');
    expect(won.state.status).toBe('won');
    expect(won.events.at(-1)).toEqual({ type: 'won' });
    expect(last.events).not.toContainEqual({ type: 'won' });
  });

  it('one crab on a goal is not a win', () => {
    expect(play(['CG.', 'C.G'], ['R']).state.status).toBe('playing');
  });

  it('"any crab enters water … = loss" (an in-map ~ tile)', () => {
    const { state, last } = play(['C~', 'G.'], ['R']);
    expect(state.status).toBe('lost');
    expect(last.events).toContainEqual({
      type: 'fell',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      into: 'water',
      subStep: 0,
    });
  });

  it('walking off the map edge is falling into water', () => {
    const { state, last } = play(['GC'], ['R']);
    expect(state.status).toBe('lost');
    expect(last.events).toContainEqual({
      type: 'fell',
      from: { x: 1, y: 0 },
      to: { x: 2, y: 0 },
      into: 'water',
      subStep: 0,
    });
  });

  it('"Lava: a crab entering it = instant loss"', () => {
    const { state, last } = play(['CL', 'G.'], ['R']);
    expect(state.status).toBe('lost');
    expect(last.events).toContainEqual(expect.objectContaining({ type: 'fell', into: 'lava' }));
  });

  it('dead crabs leave the board; the others finish the move (and follow into the vacated tile)', () => {
    const { state, board } = play(['CC~', 'GG.'], ['R']);
    expect(state.status).toBe('lost');
    expect(state.crabs).toEqual([1]);
    expect(board).toEqual(['.C~', 'GG.']);
  });

  it('a finished game ignores further input', () => {
    const lvl = level(['CG']);
    const won = step(lvl, initialState(lvl), 'R').state;
    expect(step(lvl, won, 'L')).toEqual({ state: won, moved: false, events: [] });
  });
});

describe('replay (spec §4)', () => {
  it('replays a move list to the final state', () => {
    const lvl = level(['#C.', '.#.', '..G']);
    expect(replay(lvl, ['R', 'D', 'D'])).toEqual({ crabs: [8], moveCount: 3, status: 'won' });
  });

  it('blocked presses in the list are not counted', () => {
    const lvl = level(['#C.', '.#.', '..G']);
    expect(replay(lvl, ['L', 'D', 'R', 'D', 'D']).moveCount).toBe(3);
  });
});
