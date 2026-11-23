import { createHash } from 'node:crypto';
import { LevelValidationError, parseLevel, RULES_VERSION, type LevelJson } from '@crab-game/engine';
import { solve, type SolveOptions } from '@crab-game/solver';
import type { BuiltLevel } from './types';

export type { BuiltLevel };

export interface BuildResult {
  levels: BuiltLevel[];
  errors: string[];
}

export function hashLevel(json: LevelJson, rulesVersion: number = RULES_VERSION): string {
  const content = JSON.stringify({ map: json.map, entities: json.entities, rulesVersion });
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Validates, solves and versions every level file. `previous` is the committed bundle:
 * pars and solutions may only change together with a level `version` or `RULES_VERSION`
 * bump (docs/engineering.md §5.1).
 */
export function buildLevels(
  sources: readonly { file: string; json: unknown }[],
  previous: readonly BuiltLevel[],
  solveOptions: SolveOptions = {},
): BuildResult {
  const errors: string[] = [];
  const levels: BuiltLevel[] = [];
  const sorted = [...sources].sort((a, b) => a.file.localeCompare(b.file));

  for (const { file, json } of sorted) {
    if (!isLevelJson(json)) {
      errors.push(
        `${file}: not a level file (needs id, nameKey, version, map, entities, timeLimitSec).`,
      );
      continue;
    }
    // File names are unique, so this also keeps ids unique.
    if (file.replace(/\.json$/, '') !== json.id) {
      errors.push(`${file}: id "${json.id}" must match the file name.`);
      continue;
    }

    let report;
    try {
      report = solve(parseLevel(json), solveOptions);
    } catch (e) {
      if (!(e instanceof LevelValidationError)) throw e;
      errors.push(`${file}: ${e.message}`);
      continue;
    }
    if (report.status !== 'solved' || report.par === null || report.solution === null) {
      errors.push(
        report.status === 'unsolvable'
          ? `${file}: unsolvable.`
          : `${file}: solver gave up (${String(report.limit)} limit); simplify the level or raise the limit.`,
      );
      continue;
    }

    const next: BuiltLevel = {
      id: json.id,
      version: json.version,
      rulesVersion: RULES_VERSION,
      hash: hashLevel(json),
      par: report.par,
      solution: report.solution,
      source: json,
    };
    const problem = versioningProblem(
      previous.find((p) => p.id === json.id),
      next,
    );
    if (problem) errors.push(`${file}: ${problem}`);
    else levels.push(next);
  }

  return { levels: levels.sort((a, b) => a.id.localeCompare(b.id)), errors };
}

function versioningProblem(prev: BuiltLevel | undefined, next: BuiltLevel): string | null {
  if (!prev || prev.rulesVersion !== next.rulesVersion) return null; // new level, or an intended rules change
  if (next.version < prev.version) {
    return `version went down (${String(prev.version)} → ${String(next.version)}).`;
  }
  if (next.version > prev.version) return null;
  if (next.hash !== prev.hash) {
    return 'map or entities changed without a version bump: bump "version" in the level file.';
  }
  if (next.par !== prev.par || next.solution.join() !== prev.solution.join()) {
    return (
      `par or golden solution changed (par ${String(prev.par)} → ${String(next.par)}) with no level or rules change. ` +
      'This is a regression: fix the code. If the rule change is intended, bump RULES_VERSION (docs/engineering.md §5.1).'
    );
  }
  return null;
}

function isLevelJson(value: unknown): value is LevelJson {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.nameKey === 'string' &&
    typeof v.version === 'number' &&
    Array.isArray(v.map) &&
    v.map.every((row) => typeof row === 'string') &&
    Array.isArray(v.entities) &&
    (v.timeLimitSec === null || typeof v.timeLimitSec === 'number')
  );
}
