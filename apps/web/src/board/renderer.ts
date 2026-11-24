import { Tile, type GameEvent, type GameState, type Level, type Pos } from '@crab-game/engine';
import { Application, Container, Graphics } from 'pixi.js';
import { buildTimeline, type Timeline } from './timeline';

/** Board units: everything is drawn at this tile size, then the board is scaled to fit. */
const T = 64;
const SUB_STEP_MS = 110;
const BUMP_MS = 160;

const COLORS = {
  water: 0x1c6ea4,
  sand: 0xf1d9a7,
  sandLine: 0xd9bd85,
  wall: 0x6f6252,
  wallTop: 0x8d7d69,
  goal: 0x2f9e44,
  lava: 0xe8590c,
  lavaLine: 0xffd43b,
  ice: 0xc5ecfa,
  iceLine: 0x74c0fc,
  crab: 0xe03131,
  crabDark: 0xa61e1e,
  eye: 0xffffff,
  pupil: 0x111111,
} as const;

interface Running {
  readonly timeline: Timeline;
  readonly final: GameState;
  readonly onDone: () => void;
  elapsed: number;
}

function posOf(level: Level, index: number): Pos {
  return { x: index % level.width, y: Math.floor(index / level.width) };
}

/** Floor plus a shape cue per tile type, so tiles read without colour (spec §6.3). */
function drawTerrain(g: Graphics, level: Level): void {
  g.clear();
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const tile = level.tiles[y * level.width + x];
      if (tile === Tile.Water || tile === undefined) continue;
      const px = x * T;
      const py = y * T;
      g.rect(px, py, T, T).fill(COLORS.sand).stroke({ width: 1, color: COLORS.sandLine });
      switch (tile) {
        case Tile.Wall:
          g.roundRect(px + 4, py + 4, T - 8, T - 8, 10).fill(COLORS.wall);
          g.roundRect(px + 10, py + 8, T - 20, T / 3, 6).fill(COLORS.wallTop);
          break;
        case Tile.Goal:
          g.circle(px + T / 2, py + T / 2, T * 0.32).stroke({ width: 5, color: COLORS.goal });
          g.circle(px + T / 2, py + T / 2, T * 0.08).fill(COLORS.goal);
          break;
        case Tile.Lava:
          g.rect(px, py, T, T).fill(COLORS.lava);
          for (const row of [0.3, 0.65]) {
            g.moveTo(px + 6, py + T * row);
            for (let k = 1; k <= 4; k++) g.lineTo(px + 6 + k * 13, py + T * row + (k % 2 ? 7 : 0));
            g.stroke({ width: 3, color: COLORS.lavaLine });
          }
          break;
        case Tile.Ice:
          g.rect(px, py, T, T).fill(COLORS.ice);
          for (const o of [0.2, 0.5, 0.8]) {
            g.moveTo(px + T * o - 8, py + T * 0.75)
              .lineTo(px + T * o + 8, py + T * 0.25)
              .stroke({ width: 3, color: COLORS.iceLine });
          }
          break;
        default:
          break;
      }
    }
  }
}

function makeCrab(): Graphics {
  const g = new Graphics();
  // Claws, body, eyes. Drawn around (0, 0) so the crab can be moved by its centre.
  g.circle(-20, -6, 8).fill(COLORS.crabDark);
  g.circle(20, -6, 8).fill(COLORS.crabDark);
  g.ellipse(0, 6, 22, 16).fill(COLORS.crab);
  for (const ex of [-8, 8]) {
    g.circle(ex, -12, 6).fill(COLORS.eye);
    g.circle(ex, -12, 3).fill(COLORS.pupil);
  }
  return g;
}

/** Draws a level and animates moves. It only shows state; it never decides rules (spec §6.3). */
export class BoardRenderer {
  private readonly app = new Application();
  private readonly board = new Container();
  private readonly terrain = new Graphics();
  private readonly crabLayer = new Container();
  private crabs: Graphics[] = [];
  private level: Level | null = null;
  private running: Running | null = null;
  private bumpLeft = 0;
  private baseX = 0;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: COLORS.water,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio,
    });
    host.appendChild(this.app.canvas);
    this.board.addChild(this.terrain, this.crabLayer);
    this.app.stage.addChild(this.board);
    this.app.renderer.on('resize', () => {
      this.layout();
    });
    this.app.ticker.add((ticker) => {
      this.tick(ticker.deltaMS);
    });
  }

  setLevel(level: Level, state: GameState): void {
    this.level = level;
    drawTerrain(this.terrain, level);
    this.layout();
    this.sync(state);
  }

  /** Puts the crabs where `state` says, cancelling any running animation. */
  sync(state: GameState): void {
    const { level } = this;
    if (level === null) return;
    this.running = null;
    for (const c of this.crabs) c.destroy();
    this.crabs = state.crabs.map((index) => {
      const crab = makeCrab();
      this.place(crab, posOf(level, index));
      this.crabLayer.addChild(crab);
      return crab;
    });
  }

  animate(
    from: GameState,
    events: readonly GameEvent[],
    final: GameState,
    onDone: () => void,
  ): void {
    const { level } = this;
    if (level === null) return;
    this.sync(from);
    const start = from.crabs.map((i) => posOf(level, i));
    this.running = { timeline: buildTimeline(start, events), final, onDone, elapsed: 0 };
  }

  bump(): void {
    this.bumpLeft = BUMP_MS;
  }

  destroy(): void {
    this.app.destroy({ removeView: true }, { children: true });
  }

  private place(crab: Graphics, p: Pos): void {
    crab.position.set(p.x * T + T / 2, p.y * T + T / 2);
  }

  private layout(): void {
    const { level } = this;
    if (level === null) return;
    const { width, height } = this.app.screen;
    const scale = Math.min(width / (level.width * T), height / (level.height * T));
    this.board.scale.set(scale);
    this.baseX = (width - level.width * T * scale) / 2;
    this.board.position.set(this.baseX, (height - level.height * T * scale) / 2);
  }

  private tick(deltaMS: number): void {
    if (this.bumpLeft > 0) {
      this.bumpLeft = Math.max(0, this.bumpLeft - deltaMS);
      const p = this.bumpLeft / BUMP_MS;
      this.board.x = this.baseX + Math.sin(p * Math.PI * 6) * 6 * p;
    }

    const run = this.running;
    if (run === null) return;
    run.elapsed += deltaMS;
    const t = run.elapsed / SUB_STEP_MS;
    if (t >= run.timeline.subSteps) {
      this.sync(run.final);
      run.onDone();
      return;
    }
    const s = Math.floor(t);
    const f = t - s;
    const eased = f * (2 - f);
    run.timeline.tracks.forEach((track, i) => {
      const crab = this.crabs[i];
      const a = track.path[s];
      const b = track.path[s + 1];
      if (crab === undefined || a === undefined || b === undefined) return;
      this.place(crab, { x: a.x + (b.x - a.x) * eased, y: a.y + (b.y - a.y) * eased });
      if (track.fellAt !== null && s >= track.fellAt) {
        const fade = s === track.fellAt ? 1 - f : 0;
        crab.alpha = fade;
        crab.scale.set(0.5 + fade * 0.5);
      }
    });
  }
}
