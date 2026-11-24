import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameStoreApi } from '../game/store';
import { BoardRenderer } from './renderer';

/** Mounts the Pixi board and feeds it store changes (spec §6: engine → Pixi → HUD). */
export function Board({ store }: { store: GameStoreApi }) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (el === null) return;
    const renderer = new BoardRenderer();
    let unsubscribe: (() => void) | null = null;
    let disposed = false;

    void renderer.init(el).then(() => {
      if (disposed) {
        renderer.destroy();
        return;
      }
      const s = store.getState();
      renderer.setLevel(s.level, s.state);
      unsubscribe = store.subscribe((next, prev) => {
        if (next.level !== prev.level) {
          renderer.setLevel(next.level, next.state);
        } else if (next.animation !== null && next.animation !== prev.animation) {
          const { seq, from, events } = next.animation;
          renderer.animate(from, events, next.state, () => {
            store.getState().animationDone(seq);
          });
        } else if (next.state !== prev.state && next.animation === null) {
          renderer.sync(next.state);
        }
        if (next.bumpSeq !== prev.bumpSeq) renderer.bump();
      });
    });

    return () => {
      // Pixi can only be destroyed after init finishes; if it hasn't, the init callback does it.
      if (unsubscribe !== null) {
        unsubscribe();
        renderer.destroy();
      }
      disposed = true;
    };
  }, [store]);

  return <div ref={host} className="board" role="img" aria-label={t('board.label')} />;
}
