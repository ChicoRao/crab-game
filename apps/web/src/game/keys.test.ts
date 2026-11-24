import { describe, expect, it } from 'vitest';
import { keyAction } from './keys';

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) =>
  keyAction({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe('spec §7 desktop controls', () => {
  it('maps arrow keys and WASD (either case) to directions', () => {
    expect(key('ArrowUp')).toEqual({ type: 'move', dir: 'U' });
    expect(key('ArrowRight')).toEqual({ type: 'move', dir: 'R' });
    expect(key('a')).toEqual({ type: 'move', dir: 'L' });
    expect(key('S')).toEqual({ type: 'move', dir: 'D' });
  });

  it('R restarts', () => {
    expect(key('r')).toEqual({ type: 'restart' });
  });

  it('leaves browser shortcuts alone', () => {
    expect(key('r', { ctrlKey: true })).toBeNull();
    expect(key('Tab')).toBeNull();
  });
});
