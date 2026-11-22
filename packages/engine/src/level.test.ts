import { describe, expect, it } from 'vitest';
import { LevelValidationError, parseLevel, Tile, tileAt, validateLevel } from './index';
import { level, levelJson } from './test-utils';

describe('parseLevel (spec §3.2, §3.4)', () => {
  it('parses terrain into a flat Uint8Array indexed y * width + x', () => {
    const lvl = level(['~#G', '.CL', 'I.~']);
    expect(lvl.width).toBe(3);
    expect(lvl.height).toBe(3);
    // prettier-ignore
    expect(Array.from(lvl.tiles)).toEqual([
      Tile.Water, Tile.Wall, Tile.Goal,
      Tile.Floor, Tile.Floor, Tile.Lava,
      Tile.Ice, Tile.Floor, Tile.Water,
    ]);
  });

  it('"C is a shortcut … The parser turns it into a crab entity on a floor tile"', () => {
    const lvl = level(['C.G', 'G.C']);
    expect(lvl.tiles[0]).toBe(Tile.Floor);
    expect(lvl.tiles[5]).toBe(Tile.Floor);
    expect(lvl.crabs).toEqual([0, 5]);
  });

  it('"Crabs are a sorted array of tile indexes"', () => {
    expect(level(['G.C', 'C.G']).crabs).toEqual([2, 3]);
  });

  it('keeps id, version, nameKey and timeLimitSec', () => {
    const lvl = parseLevel({ ...levelJson(['CG']), id: 'w1-03', version: 4, timeLimitSec: 30 });
    expect(lvl).toMatchObject({
      id: 'w1-03',
      version: 4,
      nameKey: 'levels.test.name',
      timeLimitSec: 30,
    });
  });

  it('"Anything outside the map bounds is water"', () => {
    const lvl = level(['CG']);
    expect(tileAt(lvl, -1, 0)).toBe(Tile.Water);
    expect(tileAt(lvl, 2, 0)).toBe(Tile.Water);
    expect(tileAt(lvl, 0, -1)).toBe(Tile.Water);
    expect(tileAt(lvl, 0, 1)).toBe(Tile.Water);
    expect(tileAt(lvl, 1, 0)).toBe(Tile.Goal);
  });
});

describe('level validation (spec §3.2)', () => {
  it('accepts a valid level', () => {
    expect(validateLevel(levelJson(['~~~~', '~CG~', '~~~~']))).toEqual([]);
  });

  it('"map is rectangular"', () => {
    expect(validateLevel(levelJson(['CG', 'C.G']))).toContainEqual(
      expect.stringMatching(/rectangular/),
    );
  });

  it('rejects an empty map', () => {
    expect(validateLevel(levelJson([]))).toContainEqual(expect.stringMatching(/empty/));
    expect(validateLevel(levelJson(['']))).toContainEqual(expect.stringMatching(/empty/));
  });

  it('"crabs = goals"', () => {
    expect(validateLevel(levelJson(['CCG']))).toContainEqual(
      expect.stringMatching(/2 crabs.*1 goal/),
    );
  });

  it('needs at least one crab', () => {
    expect(validateLevel(levelJson(['...']))).toContainEqual(
      expect.stringMatching(/at least one crab/),
    );
  });

  it('"~ only connected to the border" (no inland ponds, §2.1)', () => {
    const issues = validateLevel(levelJson(['~~~~~', '~C.G~', '~.~.~', '~...~', '~~~~~']));
    expect(issues).toContainEqual(expect.stringMatching(/\(2, 2\).*border/));
  });

  it('accepts water that reaches the border through other water', () => {
    expect(validateLevel(levelJson(['~~~~', '~~C~', '~.G~', '....']))).toEqual([]);
  });

  it('rejects unknown map characters', () => {
    expect(validateLevel(levelJson(['CXG']))).toContainEqual(
      expect.stringMatching(/"X".*\(1, 0\)/),
    );
  });

  it('rejects entities until a later world defines them (§2.1 teleporters TBD)', () => {
    const json = { ...levelJson(['CG']), entities: [{ type: 'teleporter' }] };
    expect(validateLevel(json)).toContainEqual(expect.stringMatching(/entities/));
  });

  it('parseLevel throws LevelValidationError listing every issue', () => {
    const fn = () => parseLevel(levelJson(['CCX']));
    expect(fn).toThrow(LevelValidationError);
    try {
      fn();
    } catch (e) {
      expect((e as LevelValidationError).issues).toHaveLength(2);
    }
  });
});
