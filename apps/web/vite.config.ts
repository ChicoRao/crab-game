import { GAME_DISPLAY_NAME } from '@crab-game/config';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Fills `%GAME_DISPLAY_NAME%` in index.html, so the name lives only in the config package. */
function gameName(): Plugin {
  return {
    name: 'game-display-name',
    transformIndexHtml: (html) => html.replaceAll('%GAME_DISPLAY_NAME%', GAME_DISPLAY_NAME),
  };
}

export default defineConfig({
  plugins: [react(), gameName()],
});
