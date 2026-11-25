// @ts-check
import js from '@eslint/js';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import tseslint from 'typescript-eslint';

// The display name lives in one config value (docs/engineering.md §2). Catch it hard-coded anywhere else.
const noHardCodedName = {
  selector: 'Literal[value=/crab\\s+game/i]',
  message: 'Import GAME_DISPLAY_NAME from @crab-game/config instead of hard-coding the game name.',
};

export default tseslint.config(
  {
    ignores: ['**/node_modules/', '**/dist/', '**/coverage/', '**/.turbo/'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    plugins: { '@eslint-community/eslint-comments': eslintComments },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Every eslint-disable needs a reason: `// eslint-disable-next-line rule -- why`.
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      'no-restricted-syntax': ['error', noHardCodedName],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  // No user-facing text in components: every string goes through t() (docs/engineering.md §2.1).
  {
    files: ['apps/web/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        noHardCodedName,
        {
          selector: 'JSXText[value=/[^\\s]/]',
          message: 'User-facing text belongs in locales/en.json; use t().',
        },
      ],
    },
  },
  // Golden solutions must not ship to players: the web app imports only the playable bundle.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@crab-game/levels/golden',
                '@crab-game/levels/src/*',
                '**/generated/solutions.json',
              ],
              message:
                'Golden solutions must not ship to players; import LEVELS from @crab-game/levels.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/config/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  // packages/engine stays pure: no DOM, network, clock or randomness (spec §4, CLAUDE.md).
  {
    files: ['packages/engine/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'fetch',
        'XMLHttpRequest',
        'WebSocket',
        'crypto',
        'performance',
        'setTimeout',
        'setInterval',
        'requestAnimationFrame',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'The engine must be deterministic.' },
        { object: 'Date', property: 'now', message: 'The engine must not read the clock.' },
      ],
      'no-restricted-syntax': [
        'error',
        noHardCodedName,
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'The engine must not read the clock.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-*',
                'pixi.js',
                '@pixi/*',
                'zustand',
                'node:*',
                '@crab-game/web',
              ],
              message: 'packages/engine may only import other pure packages.',
            },
          ],
        },
      ],
    },
  },
);
