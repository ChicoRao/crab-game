// Conventional Commits, with the project's extra `level` type (docs/engineering.md §3).
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'docs',
        'test',
        'refactor',
        'level',
        'perf',
        'ci',
        'build',
        'revert',
      ],
    ],
  },
};
