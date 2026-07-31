import { useState, useCallback, useRef, useEffect } from 'react';
import { LocalGameEngine, type HeldControl } from '../game/localGame';
import type { GameState } from '@six-balls/shared';

export function useLocalGame() {
  const engRef = useRef<LocalGameEngine | null>(null);
  const [gs, setGS] = useState<GameState | null>(null);

  const start = useCallback(() => {
    const e = new LocalGameEngine();
    engRef.current = e;
    // Dev/testing hook: allows inspecting or poking the engine from the console
    (window as unknown as { __sixballs?: LocalGameEngine }).__sixballs = e;
    setGS({ ...e.state });
  }, []);

  const stop = useCallback(() => { engRef.current = null; setGS(null); }, []);

  const setControl = useCallback((pi: 0 | 1, control: HeldControl, pressed: boolean) => {
    engRef.current?.setControl(pi, control, pressed);
  }, []);

  const rotate = useCallback((pi: 0 | 1) => {
    const e = engRef.current;
    if (!e) return;
    e.rotate(pi);
  }, []);

  const hardDrop = useCallback((pi: 0 | 1) => {
    const e = engRef.current;
    if (!e) return;
    e.hardDrop(pi);
    setGS({ ...e.state });
  }, []);

  // 60fps simulation loop; React state only updates on discrete changes (locks)
  useEffect(() => {
    if (!gs || gs.phase !== 'playing') return;
    let raf = 0;
    let lastVersion = engRef.current?.version ?? 0;
    const loop = () => {
      const e = engRef.current;
      if (!e) return;
      e.tick(Date.now());
      if (e.version !== lastVersion) {
        lastVersion = e.version;
        setGS({ ...e.state });
      }
      if (e.state.phase === 'playing') raf = requestAnimationFrame(loop);
      else setGS({ ...e.state });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [gs?.phase === 'playing', gs?.startTime]);

  return { gameState: gs, engineRef: engRef, startGame: start, stopGame: stop, setControl, rotate, hardDrop };
}
