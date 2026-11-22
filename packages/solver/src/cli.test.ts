import { describe, expect, it } from 'vitest';
import { main } from './index';

function run(args: string[], files: Record<string, string>) {
  const out: string[] = [];
  const err: string[] = [];
  const code = main(args, {
    readFile: (path) => {
      const text = files[path];
      if (text === undefined) throw new Error(`ENOENT: no such file '${path}'`);
      return text;
    },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const levelFile = (map: string[]) =>
  JSON.stringify({
    id: 'w1-01',
    nameKey: 'levels.w1-01.name',
    version: 2,
    map,
    entities: [],
    timeLimitSec: null,
  });

describe('pnpm solve <file>', () => {
  it('prints the solver report and exits 0 for a solvable level', () => {
    const { code, out } = run(['w1-01.json'], { 'w1-01.json': levelFile(['C..', '...', '..G']) });
    expect(code).toBe(0);
    expect(out).toContain('w1-01 (version 2)');
    expect(out).toMatch(/Solvable:\s+yes/);
    expect(out).toMatch(/Par:\s+4 moves/);
    expect(out).toMatch(/Optimal solutions:\s+6/);
    expect(out).toMatch(/Solution:\s+[UDLR]( [UDLR]){3}\n/);
    expect(out).toMatch(/Reachable states:\s+9/);
    expect(out).toMatch(/Stuck states:\s+0/);
  });

  it('exits 1 for an unsolvable level', () => {
    const { code, out } = run(['l.json'], { 'l.json': levelFile(['C#C.GG']) });
    expect(code).toBe(1);
    expect(out).toMatch(/Solvable:\s+no/);
    expect(out).toMatch(/Stuck states:\s+4/);
  });

  it('exits 2 when a limit is hit before an answer', () => {
    const { code, out } = run(['l.json', '--max-states', '2'], {
      'l.json': levelFile(['C..', '...', '..G']),
    });
    expect(code).toBe(2);
    expect(out).toMatch(/Solvable:\s+unknown \(hit the state limit\)/);
    expect(out).toMatch(/Reachable states:\s+2 \(search stopped early\)/);
  });

  it('notes a limit hit after a solution was found', () => {
    const { code, out } = run(['l.json', '--max-states', '3'], {
      'l.json': levelFile(['C.', 'G.']),
    });
    expect(code).toBe(0);
    expect(out).toMatch(/Stuck states:\s+unknown/);
  });

  it('--json prints the report as JSON', () => {
    const { code, out } = run(['l.json', '--json'], { 'l.json': levelFile(['CG']) });
    expect(code).toBe(0);
    expect(JSON.parse(out)).toMatchObject({
      id: 'w1-01',
      version: 2,
      status: 'solved',
      par: 1,
      solution: ['R'],
    });
  });

  it('accepts --timeout-ms', () => {
    expect(run(['l.json', '--timeout-ms', '5000'], { 'l.json': levelFile(['CG']) }).code).toBe(0);
  });

  it('reports invalid levels with every issue', () => {
    const { code, err } = run(['l.json'], { 'l.json': levelFile(['CCX']) });
    expect(code).toBe(1);
    expect(err).toContain('Unknown map character "X"');
    expect(err).toContain('2 crabs but 0 goals');
  });

  it('reports unreadable files and bad JSON', () => {
    expectFailure(run(['missing.json'], {}), 'ENOENT');
    expectFailure(run(['bad.json'], { 'bad.json': '{' }), 'bad.json');
  });

  it('prints usage for bad arguments', () => {
    expectFailure(run([], {}), 'Usage: pnpm solve');
    expectFailure(run(['a.json', '--max-states', 'lots'], {}), 'Usage');
    expectFailure(run(['a.json', '--nope'], {}), 'Usage');
  });
});

function expectFailure(result: ReturnType<typeof run>, message: string) {
  expect(result.code).toBe(1);
  expect(result.err).toContain(message);
}
