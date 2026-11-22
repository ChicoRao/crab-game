import { describe, expect, it } from 'vitest';
import { initialState, step, type Dir } from './index';
import { level, render } from './test-utils';

function move(map: string[], dir: Dir) {
  const lvl = level(map);
  const result = step(lvl, initialState(lvl), dir);
  return { ...result, board: render(lvl, result.state) };
}

describe('ice (spec §2.4)', () => {
  it('"keeps moving in the same direction … until it reaches a non-ice tile"', () => {
    const { board, state, events } = move(['CIII..', 'G.....'], 'R');
    expect(board).toEqual(['.IIIC.', 'G.....']);
    expect(state.moveCount).toBe(1);
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, subStep: 0 },
      { type: 'slid', from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, subStep: 1 },
      { type: 'slid', from: { x: 2, y: 0 }, to: { x: 3, y: 0 }, subStep: 2 },
      { type: 'slid', from: { x: 3, y: 0 }, to: { x: 4, y: 0 }, subStep: 3 },
    ]);
  });

  it('"Blocked mid-slide (wall): it stops on the ice tile it is on"', () => {
    const { board, events } = move(['CII#', 'G...'], 'R');
    expect(board).toEqual(['.Ik#', 'G...']);
    expect(events.at(-1)).toEqual({ type: 'blocked', at: { x: 2, y: 0 }, subStep: 2 });
  });

  it('"Blocked mid-slide (… a crab that isn\'t moving)": stops on its ice tile', () => {
    expect(move(['CIIC#', 'GG...'], 'R').board).toEqual(['.IkC#', 'GG...']);
  });

  it('"During slide sub-steps only the sliding crabs move"', () => {
    expect(move(['CIII.', '.C...', 'GG...'], 'R').board).toEqual(['.IIIC', '..C..', 'GG...']);
  });

  it('two sliding crabs in a line slide together (front-first sub-steps)', () => {
    // The back crab starts on floor, the front one on ice; both slide, and the
    // back one stops against the front one once that one leaves the ice.
    const lvl = level(['CIIII.', 'GG...C']);
    const result = step(lvl, { crabs: [0, 1], moveCount: 0, status: 'playing' }, 'R');
    expect(render(lvl, result.state)).toEqual(['.IIIkC', 'GG....']);
  });

  it('"Sliding into water or lava = loss"', () => {
    const water = move(['CII', 'G..'], 'R');
    expect(water.state.status).toBe('lost');
    expect(water.events.at(-1)).toMatchObject({ type: 'fell', into: 'water', subStep: 2 });

    const lava = move(['CIL', 'G..'], 'R');
    expect(lava.state.status).toBe('lost');
    expect(lava.events.at(-1)).toMatchObject({ type: 'fell', into: 'lava', subStep: 1 });
  });

  it('"A crab standing on ice at the start of a move just takes a normal step"', () => {
    const lvl = level(['C.I.', 'G...']);
    const onIce = { crabs: [2], moveCount: 0, status: 'playing' as const };
    const down = step(lvl, onIce, 'D');
    expect(down.state.crabs).toEqual([6]);
    expect(down.events).toEqual([
      { type: 'moved', from: { x: 2, y: 0 }, to: { x: 2, y: 1 }, subStep: 0 },
    ]);
  });

  it('"… and slides again if it lands on ice"', () => {
    const lvl = level(['CII..', 'G....']);
    const result = step(lvl, { crabs: [1], moveCount: 0, status: 'playing' }, 'R');
    expect(result.state.crabs).toEqual([3]);
  });

  it('"Win and loss are checked only after the whole move resolves (including all ice sub-steps)"', () => {
    // The top crab reaches its goal on the first step; the bottom crab then slides into the sea.
    const { state } = move(['CG.', 'CII', '.G.'], 'R');
    expect(state.status).toBe('lost');
  });

  it('a slide that ends on a goal can win', () => {
    expect(move(['CIIG'], 'R').state.status).toBe('won');
  });
});
