# Crab Game: Engineering Standards (v0.3)

How this project is built, tested, reviewed and shipped. Modelled on what larger product teams do, scaled down for a solo developer working with Claude. Companion to `docs/spec.md` (what we build). This doc covers how we build it.

Instructions for Claude live in the repo-root `CLAUDE.md` (§12).

_v0.3.1: single copy of `CLAUDE.md`; progress recorded in `docs/status.md` + GitHub (§11.1)._

_v0.3 changes: aligned with spec v0.3+. Fixed blocked-move invariant; added the rule-change process with `RULES_VERSION` (§5.1); launch has no backend, so API items are conditional (§2, §13). Added Windows line-ending handling (§2)._

---

## 1. Principles

1. **The spec is the source of truth for rules.** Gameplay behaviour changes only together with a spec update in the same PR.
2. **The engine stays pure.** `packages/engine` has no DOM, React, Pixi, network, crypto, clock or randomness. This is enforced by lint, not by memory.
3. **Small, reviewable changes.** One concern per PR. Aim for < ~400 changed lines (level files and generated files excluded).
4. **Automate every check.** If a rule matters, CI enforces it.
5. **`main` is always releasable.** Unfinished features hide behind flags; nothing half-built reaches players.
6. **Ship first, add process as needed.** Tooling is adopted in stages (§13); none of it may block getting the game playable.

---

## 2. Repo & tooling

- GitHub, pnpm workspaces, Turborepo (cached builds and tests).
- **Reproducible environment:** Node LTS pinned in `.nvmrc` and `packageManager`; `.editorconfig`; a **dev container** (`.devcontainer/`) so the repo runs the same on any machine, in Codespaces and in CI.
- **Line endings:** `.gitattributes` with `* text=auto eol=lf`; Prettier `endOfLine: "lf"`. Developers on Windows set `git config --global core.autocrlf input`.
- TypeScript `strict: true`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- ESLint (`typescript-eslint` strict + type-checked) and Prettier. No `any`; `// eslint-disable` needs a reason comment.
- **Dependency boundaries** via `no-restricted-imports` / `eslint-plugin-boundaries`:
  - `engine` → nothing except other pure packages
  - `solver` → `engine`, `levels`
  - `levels` → `engine` (for validation), `solver` (build step)
  - `web` → `engine`, `levels`, `platform`
  - `api` (only if online features are approved) → `engine`, `levels`; `web` never imports it
- Pre-commit: Husky + lint-staged (format + lint changed files), commitlint (Conventional Commits).
- `.env.example` checked in; real secrets never committed (GitHub secret scanning on).
- The game's display name lives in one config value (plus i18n strings). Never hard-code it.

### 2.1 Internationalization (i18n) from day one
- **No user-facing text hard-coded in components.** All strings live in `apps/web/src/i18n/locales/<lang>.json`, accessed through typed keys (e.g. `t('menu.play')`).
- Library: `i18next` + `react-i18next` (or an equivalent lightweight typed setup).
- English (`en`) is the source locale. Missing keys fail the typecheck/lint.
- Language picked from the browser or portal locale, overridable in Settings.
- Level names are translation keys (`nameKey` in the level file).
- Layout must tolerate ~30–40% longer text and must not assume left-to-right in new UI (RTL support itself can come later).
- Adding a language = adding one JSON file. No code changes.

---

## 3. Git workflow

- **Trunk-based:** short-lived branches off `main`, merged within a few days.
- Branch names: `feat/ice-sliding`, `fix/chain-blocking`, `level/w1-04`, `chore/ci-cache`.
- **Conventional Commits:** `feat(engine): add ice slide sub-steps`, `fix(web): d-pad double-fire on iOS`, `level: add w1-04 "Pinch"`.
- **Squash merge** only, so each PR is one commit on `main`.
- **Branch protection on `main`:** PR required, all CI checks green, branch up to date, no force-push.

### 3.1 Pull requests
PR template (`.github/pull_request_template.md`):
- What & why (link the issue)
- How it was tested
- Screenshots / GIF for anything visual
- Spec updated? (yes / not needed)
- Rules changed? (no / yes: `RULES_VERSION` bumped, see §5.1)
- Checklist: tests added, no new lint disables, no hard-coded UI strings, bundle size OK

Review: every PR gets a review pass before merge: a self-review of the diff plus a Claude code review. For rules changes, review against the spec section it touches.

---

## 4. Planning & tracking

- **GitHub Issues + a GitHub Projects board** (Backlog → Ready → In progress → In review → Done).
- Milestones = spec milestones M0–M6.
- Labels: `type:feat|bug|chore|level|docs`, `area:engine|solver|web|levels|platform|ci`, `priority:p0–p3`.
- **Definition of Ready:** clear outcome, acceptance criteria, spec section linked if it involves rules.
- **Definition of Done:** merged to `main`, CI green, tests cover the change, docs/spec updated, deployed to staging.
- **ADRs** (Architecture Decision Records) in `docs/adr/NNNN-title.md` for decisions that are hard to reverse: renderer choice, level format, hosting, launch channel. Format: context → decision → consequences.

---

## 5. Testing strategy

| Layer | Tool | What | Gate |
|---|---|---|---|
| Unit | Vitest | Every engine rule in spec §2, with one or more tests per rule and edge case | Engine coverage ≥ 95% lines/branches |
| Property-based | fast-check | Engine invariants on random levels and move sequences (below) | Must pass |
| Level checks | validator + solver | Every level validates, is solvable, and its par matches the stored value | Must pass |
| Golden replays | Vitest | Each level's stored solution replays to `won` in exactly par moves; catches accidental rule changes | Must pass |
| Save migrations | Vitest | Every past save schema version loads and migrates correctly | Must pass |
| Component | Vitest + Testing Library | HUD, menus, settings, D-pad behaviour | Must pass |
| End-to-end | Playwright | Play level 1 to a win on desktop (keyboard) and a mobile viewport (D-pad); lose → restart; save persists after reload | Must pass |
| i18n | lint/typecheck | No missing or unused translation keys | Must pass |
| Visual regression | Playwright screenshots | Board rendering for a set of reference levels | Added at M2 |
| Accessibility | axe (Playwright) | Menus and settings: contrast, focus order, labels | No serious violations |
| Performance | size-limit, Lighthouse CI | JS bundle budget, load time on throttled mobile | Budget set at M2 |

**Engine invariants (property tests):**
- Crabs never share a tile.
- Crab count never changes while `status = playing`.
- `replay(level, moves)` is deterministic: same input gives same output.
- A crab never ends a move inside a wall.
- `won` ⇔ every crab on a goal; `lost` ⇔ some crab in water/lava.
- If `step()` returns `moved: false`, the returned state equals the input state exactly (including `moveCount`).
- `moveCount` equals the number of steps that returned `moved: true`.
- Ice slides always end within the sub-step cap.

**Engine work is test-first:** write the failing test from the spec rule, then the code.

### 5.1 Rule changes and regressions
Golden replays and par checks run on every PR. When one fails:

1. **Not intended** → it's a **regression**. Fix the code. Nothing else changes.
2. **Intended** (a deliberate rule change or a bug fix that changes behaviour):
   - bump `RULES_VERSION` in the engine
   - regenerate pars and golden solutions (`pnpm levels:build`)
   - update the spec rule and add a decision-log entry
   - make sure the save migration handles best runs whose hash changed (spec §6.2)
   - label the PR `rules-change`

CI fails if pars or golden solutions change while `RULES_VERSION` and the level `version` stay the same.

---

## 6. CI (GitHub Actions)

On every PR, run in parallel where possible, with Turborepo + pnpm caching:

1. Install (frozen lockfile)
2. Typecheck
3. Lint + format check (includes i18n key checks)
4. Unit, property, migration and component tests + coverage report
5. Level pipeline: validate all levels → build bundle (hashes) → run solver → fail if any level is unsolvable, or if par/solution changed without a level `version` or `RULES_VERSION` bump
6. Build
7. Bundle-size check (size-limit), with the result posted as a PR comment
8. Playwright E2E (Chromium desktop + mobile emulation; WebKit added before launch)
9. Preview deploy, with the URL posted on the PR

CI runs inside the same dev container image used locally, so "works on my machine" = works in CI.

Also enabled: Dependabot or Renovate (grouped weekly updates), CodeQL scanning, `pnpm audit` on a schedule.

---

## 7. CD & environments

| Environment | Trigger | Purpose |
|---|---|---|
| Preview | Every PR | Test the change on a real phone before merging |
| Staging | Merge to `main` | Always the latest; play-test here |
| Production | GitHub Release (tag `vX.Y.Z`) | What players get, on our own domain |

- Releases via **release-please**: reads Conventional Commits, opens a release PR with the version bump + `CHANGELOG.md`. Merge it → tag → production deploy.
- Semantic versioning. Save-data schema changes require a migration and a minor or major bump.
- **Rollback:** redeploy the previous release (one click on Vercel/Cloudflare). Document it in `docs/runbook.md`.
- **Feature flags:** a typed config file (`flags.ts`) with per-environment values, e.g. `iceWorld`, `timerSetting`, `swipeControls`. Unfinished features merge behind a flag that's off in production.
- Portal builds (if a portal is chosen) are separate build targets from the same commit, attached to the GitHub Release as artifacts.

### 7.1 Postmortems
Any production incident (broken build shipped, save data lost, a level that became unsolvable, a portal rejection) gets a short, blameless postmortem in `docs/postmortems/YYYY-MM-DD-title.md`:

```md
# <Title>
- Date / duration:
- Impact: who was affected, and how
- What happened (timeline):
- Root cause:
- How it was fixed:
- How we prevent it next time (action items, each linked to an issue):
```

---

## 8. Observability (from M2)

- **Error tracking:** Sentry (browser), with source maps uploaded in CI and the release tagged.
- **Product analytics:** privacy-friendly (PostHog or Plausible). Core events:
  `level_start`, `level_win {moves, par, durationMs}`, `level_lose {cause}`, `restart`, `level_quit`.
  These feed level-design tuning: win rate, restarts per level, moves vs. par, where players drop off.
- **Web Vitals** reported to analytics.
- Weekly check: top errors, hardest/most-abandoned levels.

---

## 9. Security, privacy & compliance

- No secrets in the client bundle.
- **Privacy policy + cookie/consent banner before launch** if analytics or ads are on. Follow each portal's rules if one is chosen (e.g. CrazyGames requires PEGI-12 suitability and not targeting kids).
- If online features are approved later: server-issued identity, Row Level Security, replay verification, Zod input validation, rate limiting (spec §8.3).
- Licences: track third-party art/audio/fonts and their licences in `ASSETS.md`.

---

## 10. Level design pipeline

1. Draft the map in a PR (`level/w1-04`) or in chat.
2. Run `pnpm solve levels/w1-04.json` → solver report (solvable, par, number of optimal solutions, reachable states, dead ends).
3. Level review checklist:
   - Teaches or tests exactly one idea
   - Not solvable by mashing a single direction
   - No accidental shortcut (check the number of optimal solutions)
   - Uses the open shoreline (water is a real threat), unless the level is about something else on purpose
   - Fits the difficulty curve of its world
   - Fits a phone screen in portrait
   - Goals, lava and ice are readable without colour
4. Commit the level JSON; `pnpm levels:build` stores its hash, par and golden solution. CI keeps it honest from then on.
5. After launch, adjust using analytics (win rate, restarts). Any map change bumps the level `version`.

---

## 11. Docs in the repo

`README.md` (setup, scripts), `CONTRIBUTING.md` (this workflow, short), `CLAUDE.md` (§12), `docs/status.md` (current snapshot, overwritten each session; see §11.1), `docs/spec.md`, `docs/engineering.md`, `docs/adr/`, `docs/runbook.md`, `docs/postmortems/`, `docs/level-design.md`, `ASSETS.md`, `CHANGELOG.md` (generated).

### 11.1 Where progress is recorded
No hand-written session diaries: they grow forever, go stale and cost context for every new session. Instead:

| What | Where |
|---|---|
| What's happening now | `docs/status.md`: one-page snapshot, **overwritten** at the end of each session |
| Work to do, bugs, ideas | GitHub Issues + Projects board |
| What changed and why | PR descriptions + commit history |
| Game rules + design decisions | `docs/spec.md` (decision log §12) |
| Architecture decisions | `docs/adr/` |
| Released versions | `CHANGELOG.md` (generated) |
| Incidents | `docs/postmortems/` |

---

## 12. `CLAUDE.md` (instructions for Claude working in the repo)

The instructions live in **`CLAUDE.md` in the repo root**, and only there, so there is a single copy that can't drift. Claude Code loads it automatically at the start of every session. Change it with a normal PR.

---

## 13. Adopt in stages (don't build it all on day one)

| Stage | Add |
|---|---|
| M0 | Repo, strict TS, lint/format, `.editorconfig`, `.gitattributes`, dev container, Husky + commitlint, Vitest + property tests, level build + checks, golden replays, CI steps 1–6, branch protection, `CLAUDE.md`, issue board, i18n setup with `en` locale, postmortem template |
| M1 | Preview deploys, Playwright smoke test, ADRs for renderer + level format |
| M2 | Staging env, Sentry, analytics, size budget, visual regression, a11y checks, feature flags, save-migration tests. _Consider:_ A/B testing via PostHog flags (level order, ad frequency); Storybook if the UI grows |
| M3 (launch) | release-please, production env on our domain, runbook, privacy policy + consent, launch-channel ADR, portal build target if chosen, WebKit E2E |
| Only if online features are approved | `apps/api`, DB migrations checked in CI, integration tests against a Postgres container, shared API contract (Zod or tRPC), Supabase anonymous auth + RLS, CAPTCHA + rate limiting, automated backups, load test (k6), uptime monitoring |

---

## 14. Deliberately not doing

These are standard at large companies but don't fit a solo game. Revisit only if the situation changes (a team, real scale):

- Terraform / multi-cloud infrastructure-as-code
- CODEOWNERS and multi-approver reviews
- Formal SLOs, error budgets and on-call rotations
- Microservices / Kubernetes
