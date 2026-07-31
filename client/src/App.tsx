import { useState, useEffect, useCallback } from 'react';
import { getSocket } from './socket/socket';
import Menu from './components/Menu';
import GameView from './components/GameView';
import { useLocalGame } from './hooks/useLocalGame';
import { useAutoDrop } from './hooks/useAutoDrop';
import type { GameState } from '@six-balls/shared';
import { STARFIELD_BG, NEON_CYAN, NEON_MAGENTA, TEXT_DIM } from './themes/starfield';

const PAGE: React.CSSProperties = { minHeight: '100vh', ...STARFIELD_BG, fontFamily: 'system-ui, sans-serif' };
const TITLE: React.CSSProperties = { margin: 0, fontSize: '26px', fontWeight: 900, color: 'white', letterSpacing: '3px', textShadow: `0 0 14px ${NEON_CYAN}, 0 0 30px ${NEON_MAGENTA}` };
const HEADER: React.CSSProperties = { position: 'relative', textAlign: 'center', padding: '16px 0 12px', borderBottom: '1px solid rgba(255,255,255,0.12)' };
const MENU_BTN: React.CSSProperties = { position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', padding: '7px 16px', fontSize: '13px', fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '16px', color: 'white', cursor: 'pointer' };
const FOOTER: React.CSSProperties = { textAlign: 'center', padding: '12px 0 16px', borderTop: '1px solid rgba(255,255,255,0.12)', color: TEXT_DIM, fontSize: '13px' };
const OVERLAY_CARD: React.CSSProperties = { background: 'rgba(12,18,56,0.95)', borderRadius: '20px', padding: '40px 56px', textAlign: 'center', border: `1.5px solid rgba(255,255,255,0.4)`, boxShadow: `0 0 40px ${NEON_MAGENTA}55, 0 8px 40px rgba(0,0,0,0.5)` };
const PRIMARY_BTN: React.CSSProperties = { padding: '12px 28px', fontSize: '15px', fontWeight: 700, background: `linear-gradient(135deg, ${NEON_CYAN}, ${NEON_MAGENTA})`, border: 'none', borderRadius: '20px', color: '#081030', cursor: 'pointer', boxShadow: `0 0 18px ${NEON_CYAN}66` };
const GHOST_BTN: React.CSSProperties = { padding: '12px 28px', fontSize: '15px', fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '20px', color: 'white', cursor: 'pointer' };

type AppScreen = 'menu' | 'waiting' | 'playing' | 'localPlay';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const { gameState: localGameState, engineRef: localEngineRef, startGame: startLocalGame, stopGame: stopLocalGame, setControl, rotate, hardDrop } = useLocalGame();

  useEffect(() => {
    const socket = getSocket();
    socket.on('roomCreated', ({ code }: { code: string }) => setRoomCode(code));
    socket.on('joinError', ({ message }: { message: string }) => setJoinError(message));
    socket.on('roomJoined', ({ code }: { code: string }) => { setRoomCode(code); setJoinError(null); });
    socket.on('playerJoined', ({ playerCount }: { playerCount: number }) => {
      if (playerCount === 2) setScreen('waiting');
    });
    socket.on('gameStart', ({ gameState: s, playerId: id }: { gameState: GameState; playerId: string }) => {
      setScreen('playing'); setGameState(s); setPlayerId(id);
    });
    socket.on('gameStateUpdate', ({ gameState: s }: { gameState: GameState }) => setGameState(s));
    return () => {
      socket.off('roomCreated'); socket.off('joinError'); socket.off('roomJoined');
      socket.off('playerJoined'); socket.off('gameStart'); socket.off('gameStateUpdate');
    };
  }, []);

  // Online keyboard controls
  useEffect(() => {
    if (screen !== 'playing') return;
    const hkd = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); getSocket().emit('playerInput', { action: 'moveLeft' }); break;
        case 'ArrowRight': e.preventDefault(); getSocket().emit('playerInput', { action: 'moveRight' }); break;
        case 'ArrowUp': e.preventDefault(); getSocket().emit('playerInput', { action: 'rotate' }); break;
        case 'ArrowDown': e.preventDefault(); getSocket().emit('playerInput', { action: 'softDrop' }); break;
        case ' ': e.preventDefault(); getSocket().emit('playerInput', { action: 'hardDrop' }); break;
      }
    };
    window.addEventListener('keydown', hkd);
    return () => window.removeEventListener('keydown', hkd);
  }, [screen]);

  // Online auto-drop (softDrop, not hardDrop)
  const handleAutoDrop = useCallback(() => {
    if (!gameState || !playerId) return;
    getSocket().emit('playerInput', { action: 'softDrop' });
  }, [gameState, playerId]);

  useAutoDrop({
    startTime: gameState?.startTime ?? null,
    onDrop: handleAutoDrop,
    isActive: screen === 'playing' && gameState?.phase === 'playing',
  });

  const handleCreateRoom = useCallback(() => { getSocket().emit('createRoom'); setJoinError(null); }, []);
  const handleJoinRoom = useCallback((code: string) => { getSocket().emit('joinRoom', { code }); setJoinError(null); }, []);
  const handleReady = useCallback(() => { getSocket().emit('playerReady'); }, []);

  const handleLocalPlay = useCallback(() => {
    setScreen('localPlay');
    startLocalGame();
  }, [startLocalGame]);

  // Local keyboard controls: held keys move continuously; rotate/drop are taps
  useEffect(() => {
    if (screen !== 'localPlay') return;
    const down = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); setControl(0, 'left', true); break;
        case 'ArrowRight': e.preventDefault(); setControl(0, 'right', true); break;
        case 'ArrowDown': e.preventDefault(); setControl(0, 'soft', true); break;
        case 'ArrowUp': e.preventDefault(); if (!e.repeat) rotate(0); break;
        case ' ': e.preventDefault(); if (!e.repeat) hardDrop(0); break;
      }
      switch (e.code) {
        case 'KeyA': setControl(1, 'left', true); break;
        case 'KeyD': setControl(1, 'right', true); break;
        case 'KeyS': setControl(1, 'soft', true); break;
        case 'KeyW': if (!e.repeat) rotate(1); break;
        case 'ShiftLeft': case 'ShiftRight': if (!e.repeat) hardDrop(1); break;
      }
    };
    const up = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': setControl(0, 'left', false); break;
        case 'ArrowRight': setControl(0, 'right', false); break;
        case 'ArrowDown': setControl(0, 'soft', false); break;
      }
      switch (e.code) {
        case 'KeyA': setControl(1, 'left', false); break;
        case 'KeyD': setControl(1, 'right', false); break;
        case 'KeyS': setControl(1, 'soft', false); break;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      stopLocalGame();
    };
  }, [screen, setControl, rotate, hardDrop, stopLocalGame]);

  const backToMenu = useCallback(() => { setScreen('menu'); setGameState(null); setRoomCode(null); stopLocalGame(); }, [stopLocalGame]);
  const rematch = useCallback(() => { startLocalGame(); }, [startLocalGame]);

  // ── Online game screen ──
  if (screen === 'playing' || screen === 'waiting') {
    const isEnded = gameState?.phase === 'ended';
    const didWin = isEnded && gameState?.winner === playerId;
    return (
      <div style={PAGE}>
        <div style={HEADER}>
          <h1 style={TITLE}>SIX BALLS PUZZLE</h1>
          <button onClick={backToMenu} style={MENU_BTN}>
            Menu
          </button>
        </div>
        {screen === 'waiting' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '48px' }}>
            <p style={{ color: TEXT_DIM, fontSize: '18px' }}>Opponent joined! Get ready...</p>
            <button onClick={handleReady} style={{ ...PRIMARY_BTN, padding: '12px 32px', fontSize: '16px', borderRadius: '24px' }}>
              READY
            </button>
          </div>
        ) : gameState ? (
          <div style={{ position: 'relative' }}>
            <GameView gameState={gameState} myPlayerId={playerId} />
            {isEnded && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,10,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <div style={OVERLAY_CARD}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>{didWin ? '🎉' : '😢'}</div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: 'white', textShadow: `0 0 16px ${didWin ? NEON_CYAN : NEON_MAGENTA}`, marginBottom: '24px' }}>{didWin ? 'YOU WIN' : 'YOU LOSE'}</div>
                  <button onClick={backToMenu} style={PRIMARY_BTN}>
                    Back to Menu
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : <p style={{ textAlign: 'center', padding: '48px', color: TEXT_DIM }}>Loading...</p>}
        <div style={FOOTER}>
          ← → move &nbsp;·&nbsp; ↑ rotate &nbsp;·&nbsp; ↓ soft drop &nbsp;·&nbsp; Space drop
        </div>
      </div>
    );
  }

  // ── Local play screen ──
  if (screen === 'localPlay') {
    const ls = localGameState;
    const isEnded = ls?.phase === 'ended';
    return (
      <div style={PAGE}>
        <div style={HEADER}>
          <h1 style={TITLE}>SIX BALLS PUZZLE</h1>
          <button onClick={backToMenu} style={MENU_BTN}>
            Menu
          </button>
        </div>
        {ls ? (
          <div style={{ position: 'relative' }}>
            <GameView gameState={ls} myPlayerId="player1" localEngine={localEngineRef.current} />
            {isEnded && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,10,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <div style={OVERLAY_CARD}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>{ls.winner === 'player1' ? '🎉' : '😢'}</div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: 'white', textShadow: `0 0 16px ${ls.winner === 'player1' ? NEON_CYAN : NEON_MAGENTA}`, marginBottom: '24px' }}>{ls.winner === 'player1' ? 'P1 WINS' : 'P2 WINS'}</div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button onClick={rematch} style={PRIMARY_BTN}>
                      Play Again
                    </button>
                    <button onClick={backToMenu} style={GHOST_BTN}>
                      Menu
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : <p style={{ textAlign: 'center', padding: '48px', color: TEXT_DIM }}>Starting...</p>}
        <div style={FOOTER}>
          P1: ← → ↑ ↓ Space &nbsp;·&nbsp; P2: A D W S Shift
        </div>
      </div>
    );
  }

  // ── Menu screen ──
  return (
    <Menu
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      createdRoomCode={roomCode}
      joinError={joinError}
      onLocalPlay={handleLocalPlay}
    />
  );
}
