import { GAME_DISPLAY_NAME } from '@crab-game/config';
import { LEVELS } from '@crab-game/levels';
import i18next from 'i18next';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createGameStore } from './game/store';
import { initI18n } from './i18n';
import './styles.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element');

void initI18n().then(() => {
  document.title = i18next.t('app.title', { name: GAME_DISPLAY_NAME });
  const store = createGameStore(LEVELS);
  createRoot(root).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
});
