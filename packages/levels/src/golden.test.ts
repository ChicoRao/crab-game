import { parseLevel, replay, RULES_VERSION } from '@crab-game/engine';
import { describe, expect, it } from 'vitest';
import { GOLDEN_LEVELS as LEVELS } from './golden';
import { hashLevel } from './pipeline';

// Golden replays (docs/engineering.md §5): catch accidental rule changes.
describe('golden replays', () => {
  it('the bundle has levels', () => {
    expect(LEVELS.length).toBeGreaterThan(0);
  });

  for (const level of LEVELS) {
    it(`${level.id} v${String(level.version)} wins in exactly par (${String(level.par)}) moves`, () => {
      expect(level.rulesVersion).toBe(RULES_VERSION);
      expect(level.hash).toBe(hashLevel(level.source));
      expect(level.solution).toHaveLength(level.par);
      expect(replay(parseLevel(level.source), level.solution)).toMatchObject({
        status: 'won',
        moveCount: level.par,
      });
    });
  }
});
