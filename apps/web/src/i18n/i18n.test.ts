import { LEVELS } from '@crab-game/levels';
import { describe, expect, it } from 'vitest';
import { isLevelNameKey } from './index';
import en from './locales/en.json';

describe('level names (spec §3.2: names are translation keys)', () => {
  it('every level has its name in the English locale', () => {
    for (const level of LEVELS) expect(isLevelNameKey(level.source.nameKey)).toBe(true);
  });

  it('the locale has no names for levels that do not exist', () => {
    const ids = LEVELS.map((l) => l.id);
    expect(Object.keys(en.levels).sort()).toEqual([...ids].sort());
  });

  it('rejects keys that are not level names', () => {
    expect(isLevelNameKey('levels.nope.name')).toBe(false);
    expect(isLevelNameKey('hud.par')).toBe(false);
  });
});
