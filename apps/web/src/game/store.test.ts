import type { LevelJson } from '@crab-game/engine';
import type { PlayableLevel } from '@crab-game/levels';
import { describe, expect, it } from 'vitest';
import { createGameStore } from './store';

function built(id: string, map: string[]): PlayableLevel {
  const source: LevelJson = {
    id,
    nameKey: `levels.${id}.name`,
    version: 1,
    map,
    entities: [],
    timeLimitSec: null,
  };
  return { id, version: 1, rulesVersion: 1, hash: id, par: 0, source };
}

// One crab with a wall on its left and a goal two tiles to its right.
const corridor = built('t-01', ['#####', '#C.G#', '#####']);
// Open shoreline: moving up walks the crab into the sea.
const shore = built('t-02', ['~~~~', '~CG~', '~~~~']);

describe('game store', () => {
  it('applies a move and hands it to the board to animate', () => {
    const store = createGameStore([corridor]);
    store.getState().press('R');
    const s = store.getState();
    expect(s.state.moveCount).toBe(1);
    expect(s.state.crabs).toEqual([7]);
    expect(s.animation?.events).toContainEqual(
      expect.objectContaining({ type: 'moved', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }),
    );
  });

  it('spec §2.3.5: a move where no crab moves does not count; it only bumps', () => {
    const store = createGameStore([corridor]);
    const before = store.getState().state;
    store.getState().press('L');
    const s = store.getState();
    expect(s.state).toBe(before);
    expect(s.animation).toBeNull();
    expect(s.bumpSeq).toBe(1);
  });

  it('spec §6: a press during an animation is queued (max 1) and played afterwards', () => {
    const store = createGameStore([corridor]);
    store.getState().press('R');
    store.getState().press('R');
    store.getState().press('L'); // dropped: the queue already holds one press
    const first = store.getState().animation;
    expect(store.getState().queued).toBe('R');
    expect(store.getState().state.moveCount).toBe(1);

    store.getState().animationDone(first?.seq ?? -1);
    const s = store.getState();
    expect(s.queued).toBeNull();
    expect(s.state.moveCount).toBe(2);
    expect(s.state.status).toBe('won');
    expect(s.animation?.seq).not.toBe(first?.seq);
  });

  it('ignores a finished animation that is no longer the current one', () => {
    const store = createGameStore([corridor]);
    store.getState().press('R');
    const current = store.getState().animation;
    store.getState().animationDone(-1);
    expect(store.getState().animation).toBe(current);
  });

  it('records why the game was lost and ignores further presses', () => {
    const store = createGameStore([shore]);
    store.getState().press('U');
    expect(store.getState().state.status).toBe('lost');
    expect(store.getState().lossCause).toBe('water');
    const lost = store.getState().state;
    store.getState().press('R');
    expect(store.getState().state).toBe(lost);
  });

  it('restart and level select start the level from scratch', () => {
    const store = createGameStore([corridor, shore]);
    store.getState().press('R');
    store.getState().press('R');
    store.getState().restart();
    let s = store.getState();
    expect(s.state).toEqual({ crabs: [6], moveCount: 0, status: 'playing' });
    expect(s.animation).toBeNull();
    expect(s.queued).toBeNull();

    store.getState().selectLevel(1);
    s = store.getState();
    expect(s.levelIndex).toBe(1);
    expect(s.level.id).toBe('t-02');
    expect(s.state.moveCount).toBe(0);
  });
});
