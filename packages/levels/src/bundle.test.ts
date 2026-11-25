import { describe, expect, it } from 'vitest';
import { joinBundle, splitBundle } from './bundle';
import { LEVELS } from './index';
import type { BuiltLevel } from './types';

const level: BuiltLevel = {
  id: 't-01',
  version: 1,
  rulesVersion: 1,
  hash: 'h',
  par: 2,
  solution: ['R', 'D'],
  source: {
    id: 't-01',
    nameKey: 'levels.t-01.name',
    version: 1,
    map: ['CG'],
    entities: [],
    timeLimitSec: null,
  },
};

describe('level bundle split', () => {
  it('keeps solutions out of the playable bundle', () => {
    const { playable, solutions } = splitBundle([level]);
    expect(playable[0]).not.toHaveProperty('solution');
    expect(solutions).toEqual({ 't-01': ['R', 'D'] });
  });

  it('joins back to the same levels', () => {
    const { playable, solutions } = splitBundle([level]);
    expect(joinBundle(playable, solutions)).toEqual([level]);
  });

  it('the levels the game imports carry no solutions', () => {
    expect(LEVELS.length).toBeGreaterThan(0);
    for (const l of LEVELS) expect(l).not.toHaveProperty('solution');
  });
});
