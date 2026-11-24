import {
  initialState,
  parseLevel,
  step,
  type Dir,
  type GameEvent,
  type GameState,
  type Level,
} from '@crab-game/engine';
import type { BuiltLevel } from '@crab-game/levels';
import { createStore } from 'zustand/vanilla';

/** A move the board is animating. `seq` tells one animation from the next. */
export interface Animation {
  readonly seq: number;
  readonly from: GameState;
  readonly events: readonly GameEvent[];
}

export interface GameStore {
  readonly levels: readonly BuiltLevel[];
  readonly levelIndex: number;
  readonly level: Level;
  readonly state: GameState;
  /** Non-null while the board animates the last move. */
  readonly animation: Animation | null;
  /** A press made during an animation; at most one is kept (spec §6). */
  readonly queued: Dir | null;
  /** Bumped on every move where no crab could move, to play the "bump" feedback. */
  readonly bumpSeq: number;
  /** Set when the game is lost. */
  readonly lossCause: 'water' | 'lava' | null;
  press(dir: Dir): void;
  /** The board calls this when the animation `seq` has finished playing. */
  animationDone(seq: number): void;
  restart(): void;
  selectLevel(index: number): void;
}

function levelAt(levels: readonly BuiltLevel[], index: number): Level {
  const built = levels[index];
  if (built === undefined) throw new RangeError(`No level at index ${String(index)}`);
  return parseLevel(built.source);
}

export function createGameStore(levels: readonly BuiltLevel[]) {
  let seq = 0;
  const firstLevel = levelAt(levels, 0);

  return createStore<GameStore>()((set, get) => ({
    levels,
    levelIndex: 0,
    level: firstLevel,
    state: initialState(firstLevel),
    animation: null,
    queued: null,
    bumpSeq: 0,
    lossCause: null,

    press(dir) {
      const { level, state, animation, queued, bumpSeq } = get();
      if (state.status !== 'playing') return;
      if (animation !== null) {
        // Keep the first queued press so moves still happen in the order they were made.
        if (queued === null) set({ queued: dir });
        return;
      }
      const result = step(level, state, dir);
      if (!result.moved) {
        set({ bumpSeq: bumpSeq + 1 });
        return;
      }
      const fell = result.events.find((e) => e.type === 'fell');
      seq += 1;
      set({
        state: result.state,
        animation: { seq, from: state, events: result.events },
        lossCause: fell?.into ?? null,
      });
    },

    animationDone(doneSeq) {
      const { animation, queued } = get();
      if (animation?.seq !== doneSeq) return;
      set({ animation: null, queued: null });
      if (queued !== null) get().press(queued);
    },

    restart() {
      const { level } = get();
      set({ state: initialState(level), animation: null, queued: null, lossCause: null });
    },

    selectLevel(index) {
      const level = levelAt(get().levels, index);
      set({
        levelIndex: index,
        level,
        state: initialState(level),
        animation: null,
        queued: null,
        lossCause: null,
      });
    },
  }));
}

export type GameStoreApi = ReturnType<typeof createGameStore>;
