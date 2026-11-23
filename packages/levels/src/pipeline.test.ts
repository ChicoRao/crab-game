import { RULES_VERSION, type LevelJson } from '@crab-game/engine';
import { describe, expect, it } from 'vitest';
import { buildLevels, hashLevel, type BuiltLevel } from './pipeline';

function source(
  id: string,
  map: string[],
  extra: Partial<LevelJson> = {},
): { file: string; json: unknown } {
  const json: LevelJson = {
    id,
    nameKey: `levels.${id}.name`,
    version: 1,
    map,
    entities: [],
    timeLimitSec: null,
    ...extra,
  };
  return { file: `${id}.json`, json };
}

const A = ['C..', '...', '..G'];

function built(id: string, map: string[], extra: Partial<LevelJson> = {}): BuiltLevel {
  const result = buildLevels([source(id, map, extra)], []);
  expect(result.errors).toEqual([]);
  const [level] = result.levels;
  if (!level) throw new Error('not built');
  return level;
}

describe('hashLevel (spec §3.3)', () => {
  it('is a SHA-256 hex digest', () => {
    expect(hashLevel(source('a', A).json as LevelJson)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('"gameplay-relevant content only": not the name, id, version or time limit', () => {
    const base = hashLevel(source('a', A).json as LevelJson);
    const renamed = source('b', A, { nameKey: 'x', version: 7, timeLimitSec: 30 })
      .json as LevelJson;
    expect(hashLevel(renamed)).toBe(base);
  });

  it('changes with the map, the entities and RULES_VERSION', () => {
    const json = source('a', A).json as LevelJson;
    const base = hashLevel(json);
    expect(hashLevel({ ...json, map: ['C.G'] })).not.toBe(base);
    expect(hashLevel({ ...json, entities: [{ type: 'x' }] })).not.toBe(base);
    expect(hashLevel(json, RULES_VERSION + 1)).not.toBe(base);
  });
});

describe('buildLevels', () => {
  it('adds hash, par and a golden solution from the solver', () => {
    expect(built('a', A)).toEqual({
      id: 'a',
      version: 1,
      rulesVersion: RULES_VERSION,
      hash: hashLevel(source('a', A).json as LevelJson),
      par: 4,
      solution: ['D', 'D', 'R', 'R'],
      source: source('a', A).json,
    });
  });

  it('orders levels by id', () => {
    const { levels } = buildLevels([source('b', A), source('a', A)], []);
    expect(levels.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('fails invalid, unsolvable and malformed levels', () => {
    const { errors } = buildLevels(
      [source('bad', ['CCX']), source('stuck', ['C#C.GG']), { file: 'junk.json', json: { id: 3 } }],
      [],
    );
    expect(errors).toEqual([
      expect.stringMatching(/^bad\.json: .*Unknown map character/s),
      expect.stringMatching(/^junk\.json: not a level file/),
      expect.stringMatching(/^stuck\.json: unsolvable/),
    ]);
  });

  it('fails when the solver hits a limit ("unknown" is not good enough to ship)', () => {
    const { errors } = buildLevels([source('a', A)], [], { maxStates: 2 });
    expect(errors).toEqual([expect.stringMatching(/^a\.json: solver gave up \(states limit\)/)]);
  });

  it('requires the file name to match the id', () => {
    const { errors } = buildLevels([{ ...source('a', A), file: 'other.json' }], []);
    expect(errors).toEqual([expect.stringMatching(/other\.json: id "a" must match the file name/)]);
  });

  describe('versioning (spec §3.5, docs/engineering.md §5.1)', () => {
    const previous = built('a', A);

    it('accepts an unchanged level', () => {
      expect(buildLevels([source('a', A)], [previous])).toEqual({ levels: [previous], errors: [] });
    });

    it('accepts a rename or retime without a version bump', () => {
      const { errors, levels } = buildLevels(
        [source('a', A, { nameKey: 'n', timeLimitSec: 9 })],
        [previous],
      );
      expect(errors).toEqual([]);
      expect(levels[0]?.hash).toBe(previous.hash);
    });

    it('rejects a map change without a version bump', () => {
      const { errors } = buildLevels([source('a', ['C.', '.G'])], [previous]);
      expect(errors).toEqual([
        expect.stringMatching(/a\.json: map or entities changed .*bump "version"/),
      ]);
    });

    it('accepts a map change with a version bump, and regenerates par', () => {
      const { errors, levels } = buildLevels(
        [source('a', ['C.', '.G'], { version: 2 })],
        [previous],
      );
      expect(errors).toEqual([]);
      expect(levels[0]).toMatchObject({ version: 2, par: 2 });
    });

    it('rejects a lower version', () => {
      const { errors } = buildLevels([source('a', A, { version: 0 })], [{ ...previous }]);
      expect(errors).toEqual([expect.stringMatching(/version went down/)]);
    });

    it('rejects par or solution changes with no version bump: a regression', () => {
      const stale = { ...previous, par: 3, solution: previous.solution.slice(1) };
      const { errors } = buildLevels([source('a', A)], [stale]);
      expect(errors).toEqual([
        expect.stringMatching(/a\.json: par or golden solution changed .*RULES_VERSION/),
      ]);
    });

    it('accepts new pars after a RULES_VERSION bump', () => {
      const older = { ...previous, rulesVersion: RULES_VERSION - 1, hash: 'old', par: 3 };
      const { errors, levels } = buildLevels([source('a', A)], [older]);
      expect(errors).toEqual([]);
      expect(levels[0]).toEqual(previous);
    });
  });
});
