import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { Board } from './board/Board';
import { keyAction } from './game/keys';
import type { GameStoreApi } from './game/store';
import { isLevelNameKey } from './i18n';

export function App({ store }: { store: GameStoreApi }) {
  const { t } = useTranslation();
  const levels = useStore(store, (s) => s.levels);
  const levelIndex = useStore(store, (s) => s.levelIndex);
  const level = useStore(store, (s) => s.level);
  const state = useStore(store, (s) => s.state);
  const animating = useStore(store, (s) => s.animation !== null);
  const lossCause = useStore(store, (s) => s.lossCause);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = keyAction(e);
      if (action === null) return;
      e.preventDefault();
      if (action.type === 'restart') store.getState().restart();
      else store.getState().press(action.dir);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [store]);

  const par = levels[levelIndex]?.par ?? 0;
  const name = isLevelNameKey(level.nameKey) ? t(level.nameKey) : level.id;
  const hasNext = levelIndex + 1 < levels.length;
  const settled = !animating;

  return (
    <main className="app">
      <header className="hud">
        <h1>{t('hud.level', { number: levelIndex + 1, name })}</h1>
        <p>{t('hud.moves', { count: state.moveCount, par })}</p>
      </header>

      <Board store={store} />

      <section className="panel" aria-live="polite">
        {settled && state.status === 'won' && (
          <p>{t('status.won', { count: state.moveCount, par })}</p>
        )}
        {settled && state.status === 'won' && !hasNext && <p>{t('status.allCleared')}</p>}
        {settled && state.status === 'lost' && (
          <p>{t(lossCause === 'lava' ? 'status.lostLava' : 'status.lostWater')}</p>
        )}
        <div className="buttons">
          <button
            type="button"
            disabled={levelIndex === 0}
            onClick={() => {
              store.getState().selectLevel(levelIndex - 1);
            }}
          >
            {t('actions.previous')}
          </button>
          <button
            type="button"
            onClick={() => {
              store.getState().restart();
            }}
          >
            {t('actions.restart')}
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => {
              store.getState().selectLevel(levelIndex + 1);
            }}
          >
            {t('actions.next')}
          </button>
        </div>
        <p className="help">{t('app.help')}</p>
      </section>
    </main>
  );
}
