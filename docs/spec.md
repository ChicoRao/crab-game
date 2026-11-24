# Crab Game: Game Design & Technical Spec (v0.4.4)

_Status: draft. Items marked **[OPEN]** still need a decision. See §12 for the decision log._

_v0.4 changes: clarified that launch is a **public website on our own domain** served as static files, with no backend server (not "offline"). Added domain, hosting and discoverability to §6 and M3._

_v0.3 changes (plan audit, 2026-11-21): blocked moves don't count (§2.3); `rulesVersion` + versioning rules (§3.5, §4); level hash computed at build time, names are i18n keys, open-shore example (§3); timer limit source (§2.6); solver limits (§5); save keying + storage risks (§6); accessibility + onboarding (§6.3, §10.1); no leaderboards and no backend at launch (§8); server-issued identity for any future online features (§8.3); launch channel left open (§9)._

---

## 1. Pitch

A grid puzzle on a small island. Every arrow press moves **all crabs one tile in the same direction**. Use walls to shift the crabs relative to each other and get every crab onto a goal tile at the same moment, without walking any of them into the sea or into lava.

Goal: hobby project + real web launch, mobile-friendly. **Players type our domain name and play in the browser.** At launch the site is static files only: no backend server, no accounts, no leaderboards.

---

## 2. Core rules

### 2.1 Board
- Rectangular 2D grid, **surrounded by water** (island feel). Water is only on the outside for now; no inland ponds.
- Tile types:

| Tile | Behaviour |
|---|---|
| Floor | Normal walkable tile |
| Wall | Blocks movement; a crab facing it stays put |
| Goal | Walkable; counts toward the win condition |
| Lava | Walkable, but a crab entering it = **instant loss** |
| Ice | Walkable; a crab entering it keeps sliding (see 2.4) |
| Water | Outside the island; moving into it = **loss** |
| Teleporter | _Later world. Rules TBD (must include a loop cap, see §11)._ |

- **Number of crabs = number of goals.** Any crab can fill any goal.

### 2.2 Input
- Four directions: up / down / left / right.
- Restart level. **No undo** (by design).

### 2.3 Movement (one press = one attempted move)
1. Every crab tries to move **exactly one tile** in the chosen direction.
2. A crab facing a **wall** stays put. The other crabs still move.
3. Crabs **never share a tile**. A crab whose target tile holds a crab that is staying put also stays put, so a whole chain behind a blocked crab stays put ("they stick together").
4. **Resolution order:** process crabs from the *front* of the movement direction backward (moving right → rightmost first; moving up → topmost first). Each crab moves if its target is not a wall and not occupied by a crab that has already been resolved as staying. This makes chain blocking happen without any special-case code.
5. **A move only counts if at least one crab moves.** If every crab is blocked, nothing changes: the move count stays the same, the press is **not** added to the move list, and the game plays only a small "bump" feedback animation.

### 2.4 Ice (decided: classic sliding)
- A crab that **enters** an ice tile keeps moving in the same direction, one tile per sub-step, **until it reaches a non-ice tile or is blocked**.
- Blocked mid-slide (wall or a crab that isn't moving): it stops on the ice tile it is on.
- During slide sub-steps **only the sliding crabs move**. Crabs on normal tiles stay where they are.
- Sub-steps use the same front-first resolution as 2.3.
- Sliding into water or lava = loss, like normal.
- A crab standing on ice at the *start* of a move just takes a normal step (and slides again if it lands on ice).
- Slides always end (the grid is finite and direction is fixed). The engine still enforces a sub-step cap as a safeguard for future tiles.

### 2.5 Win / lose
- Win and loss are checked **only after the whole move resolves** (including all ice sub-steps). Passing over a goal while sliding does not count.
- **Win:** every crab is on a goal tile at the same time. Crabs on goals are *not* locked; they keep moving with the others.
- **Lose:** any crab enters water or lava → play the fall animation → prompt to restart.
- A move can't produce both a win and a loss: a dead crab can't be on a goal, and with crabs = goals the remaining crabs can't fill every goal. The engine still checks loss first, as a safeguard.

### 2.6 Timer
- **Off by default.** Settings toggle to turn on a per-level countdown. Running out of time = loss.
- Time limit source: optional per-level `timeLimitSec` in the level file; if missing, derived from par. **[OPEN]** the formula (e.g. `par × 3 s`, min 20 s).
- The timer pauses when the tab is hidden or the game is paused.

---

## 3. Level format

### 3.1 Principle: separate the three things a map holds
1. **Terrain:** static tiles (floor, wall, goal, lava, ice). Never changes during play.
2. **Entities:** things that move or have their own data (crabs; later teleporter pairs, switches).
3. **Visuals:** which sprite variant to draw (sand texture, coastline edge, decoration). **Never stored in level files.** The renderer derives them from the terrain.

The rules engine only knows about 1 and 2. That way, restyling the art never touches level files or game logic.

### 3.2 Authoring format (what we write and review)
Hand-written JSON with an ASCII map, the same idea as the classic Sokoban text format. Letters are easier to read than numbers, and maps can be designed directly in chat and reviewed in pull requests.

```json
{
  "id": "w1-02",
  "nameKey": "levels.w1-02.name",
  "version": 1,
  "map": [
    "~~~~~~~",
    "~#C.C.~",
    "~.....~",
    "~.....~",
    "~..GG.~",
    "~~~~~~~"
  ],
  "entities": [],
  "timeLimitSec": null
}
```

_(The real level `w1-02`, "walls separate crabs": press left once and the wall holds one crab while the other closes the gap. Level files live in `packages/levels/levels/<id>.json`; the file name must match the `id`.)_

| Char | Meaning |
|---|---|
| `#` | Wall |
| `.` | Floor |
| `G` | Goal |
| `L` | Lava |
| `I` | Ice |
| `C` | Crab standing on floor (parsed into an entity + a floor tile) |
| `~` | Water, so an island can have an irregular shape. Must connect to the border. |

- Anything outside the map bounds is water.
- **Most levels should have open shoreline** (water reachable), not a full wall ring. Falling into the sea is a core part of the puzzle.
- `C` is a shortcut for convenience. The parser turns it into a crab entity on a floor tile.
- Things that need extra data go in `entities`, not new characters. Example for later: `{ "type": "teleporter", "a": [2,1], "b": [5,3] }`.
- Level names are **translation keys** (`nameKey`), with the text in the locale files.
- Validation: at least one crab, crabs = goals, no crab starts on a goal/lava/water, map is rectangular, `~` only connected to the border, only the characters above, no `entities` until a world defines them.

### 3.3 Build step (`packages/levels`)
A build script (`pnpm levels:build`) compiles the JSON files into a level bundle (`packages/levels/src/generated/levels.json`, committed). For each level it adds:
- `hash`: SHA-256 of the **gameplay-relevant content only**: normalized map + entities + `rulesVersion`. Not the name or time limit, so renaming or retiming a level doesn't change its identity.
- `par` and a golden solution from the solver.

The hash is computed here, at build time, so the engine stays pure (no crypto calls, no async).

`pnpm levels:check` (run in CI) rebuilds everything and fails if: a level is invalid or not proven solvable ("unknown" fails too), the committed bundle is out of date, a map changed without a `version` bump, or a par/solution changed with neither a `version` nor a `RULES_VERSION` bump. `levels:build` refuses the same versioning cases, so goldens can't be regenerated just to make CI pass.

### 3.4 Runtime format (what the engine uses)
- Terrain is parsed once into a flat typed array: `Uint8Array` of length `width × height`, indexed `y * width + x`, values from a `Tile` enum (`Floor = 0`, `Wall = 1`, …).
- Crabs are a sorted array of tile indexes. The solver uses this array to detect states it has already visited.
- So the numbers (`0`/`1`) live in memory; people never read or write them.

### 3.5 Versioning
| Version | Bumped when | Effect |
|---|---|---|
| Level `version` | A level's map or entities change | New hash; CI requires it whenever a level's par or solution changes |
| `RULES_VERSION` (engine constant) | Any **intended** change to how the rules behave | All hashes change; pars and golden solutions are regenerated; spec decision log gets an entry |
| Save schema `version` | Save data shape changes | Migration code runs on load |

Unintended rule changes are caught by golden replay tests (see `docs/engineering.md` §5) and treated as regressions, not version bumps.

### 3.6 Later: level editor
Because the engine is shared, an in-browser editor (paint tiles, place crabs, "Run solver" button, export JSON) is cheap to add. A possible later step is player-made levels.

---

## 4. Engine (`packages/engine`)

Pure TypeScript with no DOM, React, renderer, network, crypto, clock or randomness. Shared by the client, the solver and any future server.

```ts
export const RULES_VERSION = 1;

type Dir = 'U' | 'D' | 'L' | 'R';

interface GameState {
  crabs: number[];        // tile indexes of living crabs, kept sorted (see below)
  moveCount: number;      // only moves where at least one crab moved (§2.3.5)
  status: 'playing' | 'won' | 'lost';
}

interface StepResult {
  state: GameState;
  moved: boolean;         // false = every crab blocked; caller doesn't record the move
  events: GameEvent[];    // drives animation: moved, blocked, bumped, slid, fell, won
}

function parseLevel(json: LevelJson): Level;
function initialState(level: Level): GameState;
function step(level: Level, state: GameState, dir: Dir): StepResult;
function replay(level: Level, moves: Dir[]): GameState;
```

- A crab that falls into water or lava is **removed from `crabs`** (it may have left the map, where there is no tile index); its `fell` event carries where it fell. So the crab count only changes on the move that loses.
- Events carry a `subStep` (0 = the normal step, 1, 2, … = ice slide sub-steps) so the renderer can animate slides in order.
- `step()` on a won or lost game does nothing (`moved: false`, no events).
- Deterministic: same level + same rules version + same moves → same result, always.
- Unit-tested with Vitest. Every rule in §2 gets tests, including chain blocking, blocked moves, ice slides and slides into hazards.

---

## 5. Solver (`packages/solver`, dev tool)

Used while we design levels together, to check "is it beatable, and is it too easy?"

- **Breadth-first search** over states (the set of crab positions). Dead states (water/lava) are pruned; moves where no crab moves are skipped.
- Reports:
  - solvable yes/no
  - **minimum moves** (becomes the level's *par*)
  - number of distinct optimal solutions, **counted** during the search, not listed one by one (many = probably too easy)
  - number of reachable states and **dead ends** (rough difficulty signal). A dead end is a reachable state where every crab is still alive but no win can be reached any more ("stuck"). With no undo, these are the traps that force a restart.
  - one optimal solution, for the level-design discussion
- **Limits:** configurable state cap and timeout. Hitting a limit is reported as "unknown", never as "unsolvable". If a solution was already found, the level is still reported solvable with its par; counts that need the full search are reported as unknown.
- CLI: `pnpm solve <file> [--json] [--max-states <n>] [--timeout-ms <n>]`. Exit code 0 = solvable, 1 = unsolvable or invalid level, 2 = unknown.
- Runs in CI on every level file. A level that can't be solved fails the build.
- Stars: 3★ = par, 2★ = par + small margin, 1★ = cleared. **[OPEN]** exact margins.

---

## 6. Architecture

```
crab-game/
├─ apps/
│  └─ web/          # Vite + React + TS (menus, HUD, settings) + renderer (PixiJS)
├─ packages/
│  ├─ engine/       # rules (§4)
│  ├─ solver/       # BFS solver CLI (§5)
│  ├─ levels/       # level JSON files, validation, build step (§3.3)
│  └─ platform/     # PlatformAdapter + implementations (§9)
└─ tooling: pnpm workspaces, Turborepo, Vitest, Playwright, ESLint/Prettier, GitHub Actions
```

`apps/api` is **not** part of the launch. It's added only if online features are approved later (§8).

- PixiJS draws the board inside a canvas. React handles everything around it. A small store (Zustand) bridges the two: the engine emits events → Pixi animates them → the HUD shows the move count.
- **Input buffering:** a press during an animation is queued (max 1 queued), so fast players never lose inputs.

### 6.1 Hosting & domain
- The game is built into **static files** (HTML, JS, images, sounds) and served from a static host with a global CDN: Vercel, Netlify or Cloudflare Pages. **[OPEN]** pick one.
- **Own domain** (e.g. `<gamename>.com` / `.io` / `.games`), pointed at the host. HTTPS is automatic.
- Players type the domain → the browser downloads the game → it runs entirely in their browser. All game logic runs on the player's device, so there is no game server to run, pay for or scale.
- Discoverability at launch:
  - page title, description and keywords for search engines
  - Open Graph / Twitter card image, so shared links show a nice preview
  - `sitemap.xml`, `robots.txt`, favicon and app icons
  - fast load (bundle budget in `docs/engineering.md`)
- Optional later: make it an installable **PWA** (add to home screen, plays without signal once loaded).
- Choosing the domain depends on the game name (§11). The game's display name lives in **one config value** plus i18n strings, never hard-coded.

### 6.2 Save data
- Stored through a `SaveStore` interface: localStorage on our own site, the portal's save API on portals.
- Schema carries a `version` and runs migrations on load.
- **Keying:**
  - Cleared / stars → by **level `id`**, so they survive small level edits.
  - Best run (move list + move count) → by **level hash**, since it's tied to the exact map and rules.
  - When a hash changes, the stored best run is replayed against the new version; if it no longer wins, stars are kept but the best run is cleared.
- **Known risk:** browsers can delete site storage (iOS Safari after ~7 days without a visit; iframes on portals may have restricted storage). Mitigations: portal save APIs; later, an optional "progress code" export/import.

### 6.3 Rendering the map
- The renderer is a function of (level terrain + current state) → what's on screen. It never decides game rules.
- **Draw layers**, bottom to top: water (animated background) → island terrain → decorations → goals → crabs → effects (splash, lava burst, bump) → UI overlay.
- **Autotiling** for the island coastline and walls: for each tile, look at its neighbours (a 4- or 8-neighbour bitmask) and pick the matching edge or corner sprite.
- Visual-only variation (e.g. random sand textures, shells) uses a random generator seeded with the level hash, so it looks the same every time.
- The board fits the screen with an integer scale where possible and is centred, in portrait and landscape.
- **Accessibility:** goals, lava and ice are distinguishable by **shape/pattern, not only colour** (colourblind players); a **reduced-motion** setting shortens or removes animations.

---

## 7. Controls

| Platform | Controls |
|---|---|
| Desktop | Arrow keys + WASD, `R` = restart |
| Touch devices | Semi-transparent on-screen **D-pad** (bottom corner), restart button |
| Optional | Swipe gestures, off by default, toggled in Settings. **[OPEN]** keep or drop |

- The D-pad shows only when touch input is detected. Large hit areas.
- Layout is responsive. The board scales to fit portrait and landscape.

---

## 8. Online features (accounts, leaderboards, shared stats)

### 8.1 Launch: none (decided)
- The game is public on our domain, but has **no leaderboards, no accounts and no backend at launch.**
- Players see **personal stats** only: levels cleared, stars, levels completed at par.
- A local ID is generated on the device **only to key save data**. It is never used as an identity for any server.
- Save data keeps move lists for best runs, so any later online feature can verify them.

### 8.2 Possible later features (only if players stick around)
- **Daily puzzle** (one level a day, shareable result, streaks): the most promising form of competition for this game.
- "You hit par, along with X% of players" stat after each level.
- Optional progress leaderboard ("highest level reached"), counting only real clears, not ad skips.
- Optional accounts for cross-device progress.

**Not planned:** a "fewest moves" leaderboard. Every level has a fixed minimum, so the top would just be a large tie at par.

### 8.3 Rules for any future online feature
- **Identity is issued by the server, never claimed by the client.** Use Supabase anonymous sign-in (`signInAnonymously()`): the server creates the user and returns a signed session token; the player ID is read from the verified token. Postgres Row Level Security ensures players can only write their own rows. CAPTCHA (e.g. Cloudflare Turnstile) and rate limits on sign-up. Upgrading to Google/email links to the same user, keeping progress.
- **Results are verified by replay.** The client sends move lists, never scores; the server runs `replay()` with the run's `rulesVersion`.
- Every stored run records `levelHash` + `rulesVersion`.
- The data model is written when a feature is approved, not now.

---

## 9. Distribution & monetization

### 9.1 Launch channel **[OPEN]**
Our own domain is the main home of the game either way. Additional channels: itch.io, web game portals (CrazyGames, Poki, GameDistribution). Portals bring players and ad revenue but have SDK requirements and possibly exclusivity (Poki's default deal is web-exclusive). Current lean: own domain + itch.io first, portal later. Check each portal's terms before the public launch, since launching somewhere first may affect what other portals will accept.

### 9.2 Platform adapter
All platform-specific calls go through one interface, so the game never calls a portal SDK directly:

```ts
interface PlatformAdapter {
  init(): Promise<void>;
  gameplayStart(): void;
  gameplayStop(): void;
  showInterstitial(): Promise<void>;       // between levels, rate-limited
  showRewarded(): Promise<boolean>;        // hint / skip level, opt-in
  loadSave(): Promise<SaveData | null>;
  writeSave(data: SaveData): Promise<void>;
}
```

Implementations: `SelfHostedAdapter` (no ads at first; Google H5 Games Ads later), `CrazyGamesAdapter`, `PokiAdapter`, `CapacitorAdapter` (future app). Selected at build time.

Ad placements (when enabled): interstitial between levels (not every level), rewarded for hints / level skips. Skipped levels are marked as skipped, not cleared. Cosmetic crab skins later.

---

## 10. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Engine + tests + solver | All §2 rules pass tests; solver runs on sample levels; level build step works |
| M1 | Playable prototype | 10 hand-made levels playable in the browser with keyboard, deployed to a preview URL |
| M2 | Mobile + polish | D-pad, responsive layout, autotiled art, animations, sound, settings (timer, reduced motion), local save, home page (game name, Play / Continue, Levels, Settings), level select (cleared levels + stars), personal stats |
| M3 | Public launch | ~20–30 levels, game name + domain live, link previews/SEO basics, PlatformAdapter, launch channels chosen (§9.1), privacy policy |
| M4 | Content & growth | Ice world, cosmetics, level editor, more levels, optional PWA |
| M5 | Online (only if approved) | Daily puzzle and/or accounts, per §8.3 |
| M6 | Later | Teleporters, more worlds, app-store build |

### 10.1 Onboarding
No text tutorial. The first 3–5 levels each teach one idea, in order: moving together → walls separate crabs → water is deadly → crabs block each other → lava. Later worlds introduce one new mechanic each the same way.

---

## 11. Open questions

- [ ] Game name and art style / theme (the domain depends on the name)
- [ ] Hosting provider (Vercel / Netlify / Cloudflare Pages)
- [ ] Swipe gestures: keep as optional or drop
- [ ] Timer default formula (when a level has no `timeLimitSec`)
- [ ] Star thresholds relative to par
- [ ] Extra launch channels (§9.1), before M3
- [ ] Daily puzzle source, if approved (hand-made backlog vs. generated + solver-filtered)
- [ ] Teleporter rules (later world), including the loop cap

---

## 12. Decision log

| Date | Decision |
|---|---|
| 2026-11-20 | One tile per press; blocked crab stays, others move; crabs block each other in chains; four directions |
| 2026-11-20 | Any crab can fill any goal; win = all crabs on goals at once; crabs on goals keep moving |
| 2026-11-20 | Water only around the island; lava = instant loss; restart only, no undo; timer off by default |
| 2026-11-20 | Ice = classic sliding until off ice or blocked |
| 2026-11-20 | Levels hand-designed together, checked by the solver |
| 2026-11-20 | Guest play first |
| 2026-11-21 | A move counts only if at least one crab moves |
| 2026-11-21 | Add `RULES_VERSION`; golden replays catch regressions |
| 2026-11-21 | No leaderboards and no backend at launch; any future identity is server-issued |
| 2026-11-21 | The game launches as a public website on its own domain (static hosting) |
| 2026-11-21 | Repo name `crab-game`; display name kept in one config value until the game is named |
| 2026-11-22 | Engine API detail (no rule change): dead crabs leave `GameState.crabs`; events carry `subStep`; levels need ≥ 1 crab |
| 2026-11-22 | Solver "dead end" = a stuck state (all crabs alive, no win reachable), not a losing move |
| 2026-11-22 | First three levels approved: w1-01 moving together, w1-02 walls separate crabs, w1-03 water is deadly |
| 2026-11-23 | Add a home page to M2, next to level select (both come after local save so they can show progress) |
