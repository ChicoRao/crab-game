import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { joinBundle, splitBundle } from './bundle';
import { buildLevels } from './pipeline';
import type { PlayableLevel, SolutionMap } from './types';

/**
 * `pnpm levels:build`: validate + solve every level and write the bundle.
 * `pnpm levels:check`: the same, but fail instead of writing if the bundle is out of date (CI).
 * The bundle is two files: `levels.json` (shipped to players, no solutions) and
 * `solutions.json` (golden solutions, for tests only).
 */
const LEVELS_DIR = fileURLToPath(new URL('../levels/', import.meta.url));
const BUNDLE_FILE = fileURLToPath(new URL('./generated/levels.json', import.meta.url));
const SOLUTIONS_FILE = fileURLToPath(new URL('./generated/solutions.json', import.meta.url));

const mode = process.argv[2];
if (mode !== 'build' && mode !== 'check') {
  console.error('Usage: tsx packages/levels/src/cli.ts <build|check>');
  process.exit(1);
}

const sources = readdirSync(LEVELS_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({ file, json: JSON.parse(readFileSync(LEVELS_DIR + file, 'utf8')) as unknown }));
const readOr = (file: string, fallback: string): string =>
  existsSync(file) ? readFileSync(file, 'utf8') : fallback;
const committed = readOr(BUNDLE_FILE, '[]\n');
const committedSolutions = readOr(SOLUTIONS_FILE, '{}\n');
const previous = joinBundle(
  JSON.parse(committed) as PlayableLevel[],
  JSON.parse(committedSolutions) as SolutionMap,
);
const { levels, errors } = buildLevels(sources, previous);

if (errors.length > 0) {
  console.error(
    `${String(errors.length)} level problem(s):\n${errors.map((e) => `- ${e}`).join('\n')}`,
  );
  process.exit(1);
}

for (const l of levels) {
  console.log(
    `${l.id.padEnd(8)} v${String(l.version).padEnd(4)} par ${String(l.par).padStart(3)}  ${l.hash.slice(0, 12)}`,
  );
}

const { playable, solutions } = splitBundle(levels);
const bundle = `${JSON.stringify(playable, null, 2)}\n`;
const solutionsFile = `${JSON.stringify(solutions, null, 2)}\n`;
if (bundle === committed && solutionsFile === committedSolutions) {
  console.log(`${String(levels.length)} levels OK; bundle is up to date.`);
} else if (mode === 'build') {
  writeFileSync(BUNDLE_FILE, bundle);
  writeFileSync(SOLUTIONS_FILE, solutionsFile);
  console.log(`${String(levels.length)} levels OK; wrote ${BUNDLE_FILE}.`);
} else {
  console.error('The level bundle is out of date: run `pnpm levels:build` and commit the result.');
  process.exit(1);
}
