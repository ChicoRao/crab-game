import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildLevels, type BuiltLevel } from './pipeline';

/**
 * `pnpm levels:build`: validate + solve every level and write the bundle.
 * `pnpm levels:check`: the same, but fail instead of writing if the bundle is out of date (CI).
 */
const LEVELS_DIR = fileURLToPath(new URL('../levels/', import.meta.url));
const BUNDLE_FILE = fileURLToPath(new URL('./generated/levels.json', import.meta.url));

const mode = process.argv[2];
if (mode !== 'build' && mode !== 'check') {
  console.error('Usage: tsx packages/levels/src/cli.ts <build|check>');
  process.exit(1);
}

const sources = readdirSync(LEVELS_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({ file, json: JSON.parse(readFileSync(LEVELS_DIR + file, 'utf8')) as unknown }));
const committed = existsSync(BUNDLE_FILE) ? readFileSync(BUNDLE_FILE, 'utf8') : '[]\n';
const { levels, errors } = buildLevels(sources, JSON.parse(committed) as BuiltLevel[]);

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

const bundle = `${JSON.stringify(levels, null, 2)}\n`;
if (bundle === committed) {
  console.log(`${String(levels.length)} levels OK; bundle is up to date.`);
} else if (mode === 'build') {
  writeFileSync(BUNDLE_FILE, bundle);
  console.log(`${String(levels.length)} levels OK; wrote ${BUNDLE_FILE}.`);
} else {
  console.error('The level bundle is out of date: run `pnpm levels:build` and commit the result.');
  process.exit(1);
}
