import { parseArgs } from 'node:util';
import { LevelValidationError, parseLevel, type LevelJson } from '@crab-game/engine';
import { solve, type SolveOptions, type SolveReport } from './solve';

export interface CliIo {
  readFile(path: string): string;
  out(line: string): void;
  err(line: string): void;
}

const USAGE = 'Usage: pnpm solve <level.json> [--json] [--max-states <n>] [--timeout-ms <n>]';

/**
 * `pnpm solve <file>`: prints the solver report for one level (docs/engineering.md §10).
 * Exit code: 0 solved, 1 unsolvable / invalid input, 2 unknown (a limit was hit).
 */
export function main(argv: readonly string[], io: CliIo): number {
  let file: string;
  let json: boolean;
  const options: SolveOptions = {};
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        json: { type: 'boolean', default: false },
        'max-states': { type: 'string' },
        'timeout-ms': { type: 'string' },
      },
    });
    const [first] = positionals;
    if (positionals.length !== 1 || first === undefined)
      throw new Error('Expected one level file.');
    file = first;
    json = values.json;
    if (values['max-states'] !== undefined) options.maxStates = positiveInt(values['max-states']);
    if (values['timeout-ms'] !== undefined) options.timeoutMs = positiveInt(values['timeout-ms']);
  } catch (e) {
    io.err(`${errorMessage(e)}\n${USAGE}`);
    return 1;
  }

  let levelJson: LevelJson;
  try {
    levelJson = JSON.parse(io.readFile(file)) as LevelJson;
  } catch (e) {
    io.err(`Could not read ${file}: ${errorMessage(e)}`);
    return 1;
  }

  let report: SolveReport;
  try {
    report = solve(parseLevel(levelJson), options);
  } catch (e) {
    if (!(e instanceof LevelValidationError)) throw e;
    io.err(e.message);
    return 1;
  }

  if (json) {
    io.out(JSON.stringify({ id: levelJson.id, version: levelJson.version, ...report }, null, 2));
  } else {
    io.out(formatReport(`${levelJson.id} (version ${String(levelJson.version)})`, report));
  }
  return report.status === 'solved' ? 0 : report.status === 'unsolvable' ? 1 : 2;
}

function formatReport(title: string, r: SolveReport): string {
  const n = (x: number) => x.toLocaleString('en-US');
  const limitNote = r.limit === 'states' ? 'hit the state limit' : 'hit the timeout';
  const solvable =
    r.status === 'solved' ? 'yes' : r.status === 'unsolvable' ? 'no' : `unknown (${limitNote})`;
  const lines: [string, string][] = [['Solvable', solvable]];
  if (r.par !== null && r.solution !== null) {
    lines.push(
      ['Par', `${n(r.par)} moves`],
      ['Optimal solutions', r.optimalSolutions === null ? 'unknown' : n(r.optimalSolutions)],
      ['Solution', r.solution.join(' ')],
    );
  }
  lines.push(
    [
      'Reachable states',
      r.limit === null ? n(r.reachableStates) : `${n(r.reachableStates)} (search stopped early)`,
    ],
    [
      'Stuck states',
      r.stuckStates === null ? 'unknown' : `${n(r.stuckStates)} (alive, but can no longer win)`,
    ],
  );
  return [title, ...lines.map(([k, v]) => `  ${`${k}:`.padEnd(19)}${v}`)].join('\n');
}

function positiveInt(text: string): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) throw new Error(`Not a whole number: ${text}`);
  return value;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
