import type { Dir } from '@crab-game/engine';

export type KeyAction = { type: 'move'; dir: Dir } | { type: 'restart' };

const KEYS: Readonly<Record<string, KeyAction>> = {
  arrowup: { type: 'move', dir: 'U' },
  arrowdown: { type: 'move', dir: 'D' },
  arrowleft: { type: 'move', dir: 'L' },
  arrowright: { type: 'move', dir: 'R' },
  w: { type: 'move', dir: 'U' },
  s: { type: 'move', dir: 'D' },
  a: { type: 'move', dir: 'L' },
  d: { type: 'move', dir: 'R' },
  r: { type: 'restart' },
};

/** Desktop controls (spec §7): arrow keys + WASD, R = restart. */
export function keyAction(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  return KEYS[e.key.toLowerCase()] ?? null;
}
