import { describe, expect, it } from 'vitest';
import { GAME_DISPLAY_NAME } from './index';

describe('GAME_DISPLAY_NAME', () => {
  it('is a non-empty, trimmed string', () => {
    expect(GAME_DISPLAY_NAME.length).toBeGreaterThan(0);
    expect(GAME_DISPLAY_NAME).toBe(GAME_DISPLAY_NAME.trim());
  });
});
