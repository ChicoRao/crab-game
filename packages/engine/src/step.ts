import { tileAt } from './level';
import {
  Tile,
  type Dir,
  type GameEvent,
  type GameState,
  type Level,
  type Pos,
  type StepResult,
} from './types';

const DELTA: Readonly<Record<Dir, Pos>> = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

interface Crab {
  pos: Pos;
  alive: boolean;
  sliding: boolean;
}

export function initialState(level: Level): GameState {
  return { crabs: [...level.crabs], moveCount: 0, status: 'playing' };
}

/** One press (spec §2.3–2.5). Pure: the input state is never modified. */
export function step(level: Level, state: GameState, dir: Dir): StepResult {
  if (state.status !== 'playing') return { state, moved: false, events: [] };

  const d = DELTA[dir];
  const key = (p: Pos) => p.y * level.width + p.x;
  // Front of the movement direction first (spec §2.3.4).
  const crabs: Crab[] = state.crabs
    .map((i) => ({
      pos: { x: i % level.width, y: Math.floor(i / level.width) },
      alive: true,
      sliding: false,
    }))
    .sort((a, b) => (b.pos.x - a.pos.x) * d.x + (b.pos.y - a.pos.y) * d.y);
  const occupied = new Set(state.crabs);
  const events: GameEvent[] = [];

  /** Moves the given crabs one tile, front-first. Returns whether any of them moved. */
  const advance = (movers: Crab[], subStep: number): boolean => {
    let anyMoved = false;
    for (const crab of movers) {
      const from = crab.pos;
      const to = { x: from.x + d.x, y: from.y + d.y };
      const tile = tileAt(level, to.x, to.y);
      // Every crab ahead has been resolved already, so an occupied target holds a crab that stays.
      if (tile === Tile.Wall || occupied.has(key(to))) {
        crab.sliding = false;
        events.push({ type: 'blocked', at: from, subStep });
        continue;
      }
      anyMoved = true;
      occupied.delete(key(from));
      crab.pos = to;
      if (tile === Tile.Water || tile === Tile.Lava) {
        crab.alive = false;
        crab.sliding = false;
        events.push({
          type: 'fell',
          from,
          to,
          into: tile === Tile.Water ? 'water' : 'lava',
          subStep,
        });
        continue;
      }
      occupied.add(key(to));
      crab.sliding = tile === Tile.Ice;
      events.push(
        subStep === 0 ? { type: 'moved', from, to, subStep } : { type: 'slid', from, to, subStep },
      );
    }
    return anyMoved;
  };

  if (!advance(crabs, 0)) {
    return { state, moved: false, events: [...events, { type: 'bumped' }] };
  }

  // Ice: only the sliding crabs keep moving, one tile per sub-step (spec §2.4).
  // A slide can't be longer than the board, so the cap only guards future tile types.
  const subStepCap = level.width * level.height;
  for (let subStep = 1; crabs.some((c) => c.sliding); subStep++) {
    /* v8 ignore next -- unreachable with today's tiles; a safeguard for future ones (spec §2.4) */
    if (subStep > subStepCap)
      throw new Error(`Ice slide exceeded ${String(subStepCap)} sub-steps.`);
    advance(
      crabs.filter((c) => c.sliding),
      subStep,
    );
  }

  // Checked only after the whole move resolves; loss first (spec §2.5).
  const alive = crabs.filter((c) => c.alive);
  const lost = alive.length < crabs.length;
  const won = !lost && alive.every((c) => tileAt(level, c.pos.x, c.pos.y) === Tile.Goal);
  if (won) events.push({ type: 'won' });

  return {
    state: {
      crabs: alive.map((c) => key(c.pos)).sort((a, b) => a - b),
      moveCount: state.moveCount + 1,
      status: lost ? 'lost' : won ? 'won' : 'playing',
    },
    moved: true,
    events,
  };
}

/** Plays a move list from the start. Presses after the game ends are ignored. */
export function replay(level: Level, moves: readonly Dir[]): GameState {
  return moves.reduce((state, dir) => step(level, state, dir).state, initialState(level));
}
