import type { GameEvent } from '@crab-game/engine';
import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timeline';

describe('buildTimeline', () => {
  it('moves each crab along its events; crabs without events stay put', () => {
    const events: GameEvent[] = [
      { type: 'moved', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, subStep: 0 },
      { type: 'blocked', at: { x: 1, y: 2 }, subStep: 0 },
    ];
    const t = buildTimeline(
      [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ],
      events,
    );
    expect(t.subSteps).toBe(1);
    expect(t.tracks[0]?.path).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
    expect(t.tracks[1]?.path).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 2 },
    ]);
  });

  it('plays ice slides as later sub-steps and marks the sub-step a crab fell in', () => {
    const events: GameEvent[] = [
      { type: 'moved', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, subStep: 0 },
      { type: 'slid', from: { x: 2, y: 1 }, to: { x: 3, y: 1 }, subStep: 1 },
      { type: 'fell', from: { x: 3, y: 1 }, to: { x: 4, y: 1 }, into: 'water', subStep: 2 },
    ];
    const t = buildTimeline([{ x: 1, y: 1 }], events);
    expect(t.subSteps).toBe(3);
    expect(t.tracks[0]?.path.map((p) => p.x)).toEqual([1, 2, 3, 4]);
    expect(t.tracks[0]?.fellAt).toBe(2);
  });
});
