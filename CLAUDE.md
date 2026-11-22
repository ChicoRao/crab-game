# Crab Game: working instructions

## Before you start
- Read docs/status.md first: it says where we are and what's next.
- Read docs/spec.md (rules) and docs/engineering.md (workflow) for anything touching gameplay or process.
- Work on a branch named per the convention; never commit directly to main.

## Hard rules
- packages/engine stays pure: no DOM, React, Pixi, network, crypto, Date.now() or Math.random().
- Gameplay rule changes require a spec update in the same PR. If the spec is ambiguous, stop and ask; don't guess.
- Engine changes are test-first: add a failing test that quotes the spec rule, then implement.
- If golden replays or pars change, decide: regression (fix the code) or intended (bump RULES_VERSION, follow docs/engineering.md §5.1). Never just regenerate the goldens to make CI pass.
- Never edit a level's map without bumping its version and re-running the solver.
- No user-facing text in components: add an i18n key in locales/en.json and use t().
- Never hard-code the game's display name; use the config value.
- No `any`, no unexplained eslint-disable, no new dependency without stating why in the PR.
- No backend, accounts or leaderboards unless the spec says they're approved.

## Before saying a task is done
Run: pnpm typecheck && pnpm lint && pnpm test && pnpm levels:check && pnpm build
For UI changes also run: pnpm e2e, and include a screenshot or GIF.
During M0 some of these scripts don't exist yet. Run the ones that do, and say which ones were skipped.

## Commits & PRs
- Conventional Commits (feat|fix|chore|docs|test|refactor|level)(scope): summary
- Fill in the PR template. Keep PRs small and single-purpose.

## End of a session
- Overwrite docs/status.md with the current snapshot (keep it under one page). Don't append a history; history lives in git, PRs and issues.
- New work or bugs found → GitHub issues. Rule decisions → spec decision log. Hard-to-reverse choices → docs/adr/.

## Level design
- Use `pnpm solve <file>` and include the solver report when proposing or changing a level.
