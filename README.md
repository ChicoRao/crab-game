# crab-game

A grid puzzle game for the web. Rules: [`docs/spec.md`](docs/spec.md). Workflow: [`docs/engineering.md`](docs/engineering.md). Current status: [`docs/status.md`](docs/status.md).

## Setup

Requires Node 24 (see `.nvmrc`) and pnpm (version pinned in `package.json` → `packageManager`).

```sh
corepack enable        # or: npm i -g pnpm@<version from packageManager>
pnpm install           # also installs the git hooks
```

On Windows, keep LF line endings: `git config --global core.autocrlf input`.

Or open the repo in the dev container (`.devcontainer/`) and skip the above.

## Scripts

| Script | What it does |
|---|---|
| `pnpm typecheck` | TypeScript in every package |
| `pnpm lint` | ESLint (strict, type-checked; engine purity rules) |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test` | Vitest in every package |
| `pnpm build` | Build every package |

Commits follow Conventional Commits and are checked by commitlint on commit.
