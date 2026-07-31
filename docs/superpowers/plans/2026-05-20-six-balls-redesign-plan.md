# Six Balls Puzzle — Full Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 critical bugs making the game non-playable and completely redesign the client rendering layer with vibrant visuals, smooth animations, and a polished HUD.

**Architecture:** Keep the solid shared game engine (76 tests, no changes except spawn fix and per-player pieceIndex). Server and client game logic get targeted fixes. Client rendering is a full rewrite: rAF canvas loop, continuous fall animation, split/settle animation, bubble burst, and a vibrant pink/purple visual style.

**Tech Stack:** React 18, TypeScript, HTML5 Canvas, Socket.IO client, Vitest (shared tests), Vite (client build)

**Working directory:** `.worktrees/sd-six-balls/` — all commands run from there.

---

## File Map

| File | Action |
|------|--------|
| `shared/src/piece.ts` | Modify: spawn row 11 → 10 |
| `shared/src/types.ts` | Modify: `pieceIndex` from `GameState` → `PlayerState` |
| `server/src/GameEngine.ts` | Modify: use per-player pieceIndex, sequence 100→200 |
| `client/src/game/localGame.ts` | Modify: use per-player pieceIndex, sequence 100→200 |
| `client/src/hooks/useLocalGame.ts` | Modify: `hardDrop` → `softDrop` in auto-fall timer |
| `client/src/App.tsx` | Modify: online keyboard, auto-drop fix, game-over overlay |
| `client/src/themes/themes.ts` | Modify: update color constants |
| `client/src/components/Board.tsx` | Full rewrite: rAF loop, fall/settle/burst animations |
| `client/src/components/GameView.tsx` | Full rewrite: side-panel HUD, attack queue diagrams |
| `client/src/components/Menu.tsx` | Full rewrite: vibrant pink/purple style |

---

## Task 1: Fix Spawn Position

**Files:**
- Modify: `shared/src/piece.ts:130`

- [ ] **Step 1: Run the 76 existing shared tests to confirm they pass before touching anything**

```bash
cd shared && npm test
```

Expected: 76 tests pass, 0 fail.

- [ ] **Step 2: Change spawn row from 11 to 10**

In `shared/src/piece.ts`, change line 130:

```typescript
// Before
return { position: { row: GRID_HEIGHT - 1, col: 4 }, rotation: 0, colors: [pick(), pick(), pick()] };

// After
return { position: { row: GRID_HEIGHT - 2, col: 4 }, rotation: 0, colors: [pick(), pick(), pick()] };
```

- [ ] **Step 3: Run shared tests again — they must still pass**

```bash
cd shared && npm test
```

Expected: 76 tests pass. The spawn test in `piece.test.ts` checks that `createPieceAtSpawn` returns a valid piece; the fix should still pass because row 10 is valid.

- [ ] **Step 4: Commit**

```bash
git add shared/src/piece.ts
git commit -m "fix: spawn piece at row 10 so ball 0 lands at row 11 (valid top row)"
```

---

## Task 2: Per-Player pieceIndex — types.ts

**Files:**
- Modify: `shared/src/types.ts`

- [ ] **Step 1: Add `pieceIndex` to `PlayerState`, remove from `GameState`**

In `shared/src/types.ts`, change lines 60–77:

```typescript
/** Player state */
export interface PlayerState {
  id: string;
  grid: (Ball | null)[][];  // grid[row][col]
  currentPiece: TrianglePiece | null;
  nextPiece: TrianglePiece;
  attackQueue: Attack[];
  isAlive: boolean;
  pieceIndex: number;
}

/** Complete game state */
export interface GameState {
  phase: GamePhase;
  players: [PlayerState, PlayerState];
  startTime: number | null;
  winner: string | null;
  pieceSequence: TrianglePiece[];
}
```

- [ ] **Step 2: Run shared tests — they must still pass**

```bash
cd shared && npm test
```

Expected: 76 tests pass. The `types.test.ts` only tests `BALL_COLORS` and grid dimension constants — no pieceIndex test.

- [ ] **Step 3: Commit**

```bash
git add shared/src/types.ts
git commit -m "refactor: move pieceIndex from GameState into PlayerState for independent tracking"
```

---

## Task 3: Per-Player pieceIndex — Server GameEngine

**Files:**
- Modify: `server/src/GameEngine.ts`

- [ ] **Step 1: Update `createInitialGameState`: sequence 100→200, remove pieceIndex from state**

Replace the full file:

```typescript
import {
  movePiece,
  rotatePiece,
  canPlacePiece,
  landPiece,
  createPieceAtSpawn,
  isGameOver,
  createEmptyGrid,
  createRNG,
  type GameState,
  type PlayerState,
  type TrianglePiece,
} from '@six-balls/shared';

export type GameInput = 'moveLeft' | 'moveRight' | 'rotate' | 'softDrop' | 'hardDrop';

export function createInitialGameState(player1Id: string, player2Id: string): GameState {
  const rng = createRNG(Date.now());
  const sequence: TrianglePiece[] = [];
  for (let i = 0; i < 200; i++) {
    sequence.push(createPieceAtSpawn(rng));
  }
  const p1 = createPlayerState(player1Id, sequence, 0);
  const p2 = createPlayerState(player2Id, sequence, 0);
  return {
    phase: 'playing', players: [p1, p2],
    startTime: Date.now(), winner: null,
    pieceSequence: sequence,
  };
}

function createPlayerState(id: string, sequence: TrianglePiece[], index: number): PlayerState {
  return {
    id, grid: createEmptyGrid(),
    currentPiece: sequence[index],
    nextPiece: sequence[index + 1],
    pieceIndex: index,
    attackQueue: [], isAlive: true,
  };
}

export function processInput(
  gameState: GameState,
  playerId: string,
  input: GameInput
): GameState {
  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return gameState;

  const player = gameState.players[playerIndex];
  if (!player.isAlive || !player.currentPiece) return gameState;

  let newPiece: TrianglePiece;

  switch (input) {
    case 'moveLeft':
      newPiece = movePiece(player.currentPiece, 'left');
      if (!canPlacePiece(player.grid, newPiece)) return gameState;
      break;
    case 'moveRight':
      newPiece = movePiece(player.currentPiece, 'right');
      if (!canPlacePiece(player.grid, newPiece)) return gameState;
      break;
    case 'rotate':
      newPiece = rotatePiece(player.currentPiece);
      if (!canPlacePiece(player.grid, newPiece)) return gameState;
      break;
    case 'softDrop':
      newPiece = movePiece(player.currentPiece, 'down');
      if (!canPlacePiece(player.grid, newPiece)) {
        return handlePieceLand(gameState, playerIndex, player.currentPiece);
      }
      break;
    case 'hardDrop':
      newPiece = player.currentPiece;
      while (true) {
        const next = movePiece(newPiece, 'down');
        if (canPlacePiece(player.grid, next)) {
          newPiece = next;
        } else {
          break;
        }
      }
      return handlePieceLand(gameState, playerIndex, newPiece);
    default:
      return gameState;
  }

  const newPlayers = [...gameState.players] as [PlayerState, PlayerState];
  newPlayers[playerIndex] = { ...player, currentPiece: newPiece };
  return { ...gameState, players: newPlayers };
}

function handlePieceLand(gameState: GameState, playerIndex: number, piece: TrianglePiece): GameState {
  const player = gameState.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const { grid: processedGrid, attacks } = landPiece(player.grid, piece);
  const dead = isGameOver(processedGrid);
  const newPlayers = [...gameState.players] as [PlayerState, PlayerState];
  const nextIndex = player.pieceIndex + 1;

  newPlayers[playerIndex] = {
    ...player, grid: processedGrid,
    currentPiece: dead ? null : gameState.pieceSequence[nextIndex],
    nextPiece: gameState.pieceSequence[nextIndex + 1],
    pieceIndex: nextIndex,
    isAlive: !dead,
  };

  if (attacks.length > 0) {
    newPlayers[opponentIndex] = {
      ...newPlayers[opponentIndex],
      attackQueue: [...newPlayers[opponentIndex].attackQueue, ...attacks],
    };
  }

  let winner: string | null = null;
  if (!newPlayers[0].isAlive) winner = newPlayers[1].id;
  if (!newPlayers[1].isAlive) winner = newPlayers[0].id;

  return { ...gameState, players: newPlayers, phase: winner ? 'ended' : 'playing', winner };
}
```

- [ ] **Step 2: Rebuild server to check for type errors**

```bash
cd server && npm run build
```

Expected: compile succeeds, no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/GameEngine.ts
git commit -m "fix: use per-player pieceIndex in server GameEngine, increase sequence to 200"
```

---

## Task 4: Per-Player pieceIndex — Client LocalGame

**Files:**
- Modify: `client/src/game/localGame.ts`

- [ ] **Step 1: Replace the full file**

```typescript
import {
  movePiece, rotatePiece, canPlacePiece, landPiece, isGameOver,
  createEmptyGrid, createRNG, createPieceAtSpawn,
  type GameState, type PlayerState, type TrianglePiece,
} from '@six-balls/shared';

export type PlayerInput = 'moveLeft' | 'moveRight' | 'rotate' | 'softDrop' | 'hardDrop';

export class LocalGameEngine {
  state: GameState;

  constructor() {
    const rng = createRNG(Date.now());
    const seq: TrianglePiece[] = Array.from({ length: 200 }, () => createPieceAtSpawn(rng));
    this.state = {
      phase: 'playing',
      players: [this.makePlayer('player1', seq, 0), this.makePlayer('player2', seq, 0)],
      startTime: Date.now(),
      winner: null,
      pieceSequence: seq,
    };
  }

  private makePlayer(id: string, seq: TrianglePiece[], idx: number): PlayerState {
    return {
      id, grid: createEmptyGrid(),
      currentPiece: seq[idx], nextPiece: seq[idx + 1],
      pieceIndex: idx,
      attackQueue: [], isAlive: true,
    };
  }

  handleInput(pi: 0 | 1, input: PlayerInput) {
    if (this.state.phase !== 'playing') return;
    const p = this.state.players[pi];
    if (!p.isAlive || !p.currentPiece) return;

    let np: TrianglePiece;
    switch (input) {
      case 'moveLeft': np = movePiece(p.currentPiece, 'left'); if (!canPlacePiece(p.grid, np)) return; break;
      case 'moveRight': np = movePiece(p.currentPiece, 'right'); if (!canPlacePiece(p.grid, np)) return; break;
      case 'rotate': np = rotatePiece(p.currentPiece); if (!canPlacePiece(p.grid, np)) return; break;
      case 'softDrop': np = movePiece(p.currentPiece, 'down'); if (!canPlacePiece(p.grid, np)) { this.land(pi, p.currentPiece); return; } break;
      case 'hardDrop': np = p.currentPiece; while (true) { const n = movePiece(np, 'down'); if (canPlacePiece(p.grid, n)) np = n; else break; } this.land(pi, np); return;
      default: return;
    }
    const np2 = [...this.state.players] as [PlayerState, PlayerState];
    np2[pi] = { ...p, currentPiece: np };
    this.state = { ...this.state, players: np2 };
  }

  private land(pi: number, piece: TrianglePiece) {
    const p = this.state.players[pi];
    const oi = pi === 0 ? 1 : 0;
    const { grid: pg, attacks } = landPiece(p.grid, piece);
    const dead = isGameOver(pg);
    const ni = p.pieceIndex + 1;
    const np2 = [...this.state.players] as [PlayerState, PlayerState];
    np2[pi] = {
      ...p, grid: pg,
      currentPiece: dead ? null : this.state.pieceSequence[ni],
      nextPiece: this.state.pieceSequence[ni + 1],
      pieceIndex: ni,
      isAlive: !dead,
    };
    if (attacks.length > 0) np2[oi] = { ...np2[oi], attackQueue: [...np2[oi].attackQueue, ...attacks] };
    let w: string | null = null;
    if (!np2[0].isAlive) w = np2[1].id;
    if (!np2[1].isAlive) w = np2[0].id;
    this.state = { ...this.state, players: np2, phase: w ? 'ended' : 'playing', winner: w };
  }
}
```

- [ ] **Step 2: Type-check the client**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/game/localGame.ts
git commit -m "fix: use per-player pieceIndex in LocalGameEngine, increase sequence to 200"
```

---

## Task 5: Fix Auto-Fall Timer (hardDrop → softDrop)

**Files:**
- Modify: `client/src/hooks/useLocalGame.ts:34`

- [ ] **Step 1: Change `hardDrop` to `softDrop` in the setTimeout callback**

In `client/src/hooks/useLocalGame.ts`, change line 34:

```typescript
// Before
e.handleInput(pi, 'hardDrop');

// After
e.handleInput(pi, 'softDrop');
```

- [ ] **Step 2: Type-check**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useLocalGame.ts
git commit -m "fix: auto-fall timer uses softDrop so pieces fall one row at a time"
```

---

## Task 6: App.tsx — Online Keyboard, Auto-Drop Fix, Game-Over Overlay

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Replace the full file**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { getSocket } from './socket/socket';
import Menu from './components/Menu';
import GameView from './components/GameView';
import { useLocalGame } from './hooks/useLocalGame';
import { useAutoDrop } from './hooks/useAutoDrop';
import type { PlayerInput } from './game/localGame';
import type { GameState } from '@six-balls/shared';

type AppScreen = 'menu' | 'waiting' | 'playing' | 'localPlay';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const { gameState: localGameState, startGame: startLocalGame, handleInput: handleLocalInput, stopGame: stopLocalGame } = useLocalGame();

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

  // Local keyboard controls
  useEffect(() => {
    if (screen !== 'localPlay') return;
    const hkd = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); handleLocalInput(0, 'moveLeft'); break;
        case 'ArrowRight': e.preventDefault(); handleLocalInput(0, 'moveRight'); break;
        case 'ArrowUp': e.preventDefault(); handleLocalInput(0, 'rotate'); break;
        case 'ArrowDown': e.preventDefault(); handleLocalInput(0, 'softDrop'); break;
        case ' ': e.preventDefault(); handleLocalInput(0, 'hardDrop'); break;
      }
      switch (e.code) {
        case 'KeyA': e.preventDefault(); handleLocalInput(1, 'moveLeft'); break;
        case 'KeyD': e.preventDefault(); handleLocalInput(1, 'moveRight'); break;
        case 'KeyW': e.preventDefault(); handleLocalInput(1, 'rotate'); break;
        case 'KeyS': e.preventDefault(); handleLocalInput(1, 'softDrop'); break;
        case 'ShiftLeft': case 'ShiftRight': e.preventDefault(); handleLocalInput(1, 'hardDrop'); break;
      }
    };
    window.addEventListener('keydown', hkd);
    return () => { window.removeEventListener('keydown', hkd); stopLocalGame(); };
  }, [screen, handleLocalInput, stopLocalGame]);

  const backToMenu = useCallback(() => { setScreen('menu'); setGameState(null); setRoomCode(null); stopLocalGame(); }, [stopLocalGame]);
  const rematch = useCallback(() => { startLocalGame(); }, [startLocalGame]);

  // ── Online game screen ──
  if (screen === 'playing' || screen === 'waiting') {
    const isEnded = gameState?.phase === 'ended';
    const didWin = isEnded && gameState?.winner === playerId;
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff5fb, #f5f0ff)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '16px 0 12px', borderBottom: '1px solid #f0d0e8' }}>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 900, color: '#ff4499', letterSpacing: '2px' }}>SIX BALLS PUZZLE</h1>
        </div>
        {screen === 'waiting' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '48px' }}>
            <p style={{ color: '#cc88aa', fontSize: '18px' }}>Opponent joined! Get ready...</p>
            <button onClick={handleReady} style={{ padding: '12px 32px', fontSize: '16px', fontWeight: 700, background: 'linear-gradient(135deg, #ff4499, #cc33ff)', border: 'none', borderRadius: '24px', color: 'white', cursor: 'pointer', boxShadow: '0 3px 12px rgba(255,50,150,0.4)' }}>
              READY
            </button>
          </div>
        ) : gameState ? (
          <div style={{ position: 'relative' }}>
            <GameView gameState={gameState} myPlayerId={playerId} />
            {isEnded && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <div style={{ background: 'white', borderRadius: '20px', padding: '40px 56px', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>{didWin ? '🎉' : '😢'}</div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: didWin ? '#ff4499' : '#8833ff', marginBottom: '24px' }}>{didWin ? 'YOU WIN' : 'YOU LOSE'}</div>
                  <button onClick={backToMenu} style={{ padding: '12px 28px', fontSize: '15px', fontWeight: 700, background: 'linear-gradient(135deg, #ff4499, #cc33ff)', border: 'none', borderRadius: '20px', color: 'white', cursor: 'pointer' }}>
                    Back to Menu
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : <p style={{ textAlign: 'center', padding: '48px', color: '#cc88aa' }}>Loading...</p>}
        <div style={{ textAlign: 'center', padding: '12px 0 16px', borderTop: '1px solid #f0d0e8', color: '#cc88aa', fontSize: '13px' }}>
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
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff5fb, #f5f0ff)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '16px 0 12px', borderBottom: '1px solid #f0d0e8' }}>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 900, color: '#ff4499', letterSpacing: '2px' }}>SIX BALLS PUZZLE</h1>
        </div>
        {ls ? (
          <div style={{ position: 'relative' }}>
            <GameView gameState={ls} myPlayerId="player1" />
            {isEnded && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <div style={{ background: 'white', borderRadius: '20px', padding: '40px 56px', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>{ls.winner === 'player1' ? '🎉' : '😢'}</div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#ff4499', marginBottom: '24px' }}>{ls.winner === 'player1' ? 'P1 WINS' : 'P2 WINS'}</div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button onClick={rematch} style={{ padding: '12px 28px', fontSize: '15px', fontWeight: 700, background: 'linear-gradient(135deg, #ff4499, #cc33ff)', border: 'none', borderRadius: '20px', color: 'white', cursor: 'pointer' }}>
                      Play Again
                    </button>
                    <button onClick={backToMenu} style={{ padding: '12px 28px', fontSize: '15px', fontWeight: 700, background: '#f0e0f0', border: 'none', borderRadius: '20px', color: '#8833ff', cursor: 'pointer' }}>
                      Menu
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : <p style={{ textAlign: 'center', padding: '48px', color: '#cc88aa' }}>Starting...</p>}
        <div style={{ textAlign: 'center', padding: '12px 0 16px', borderTop: '1px solid #f0d0e8', color: '#cc88aa', fontSize: '13px' }}>
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
```

- [ ] **Step 2: Type-check**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx
git commit -m "fix: wire online keyboard controls, fix auto-drop to softDrop, add game-over overlay"
```

---

## Task 7: Update Color Palette in themes.ts

**Files:**
- Modify: `client/src/themes/themes.ts`

- [ ] **Step 1: Replace the full file with updated colors**

```typescript
export interface Theme {
  name: string;
  renderer: 'gradient' | 'solid' | 'emoji';
  emojiMap?: Record<string, string>;
}

export const THEMES: Theme[] = [
  { name: 'Vibrant', renderer: 'gradient' },
  { name: 'Flat', renderer: 'solid' },
  { name: 'Emoji', renderer: 'emoji', emojiMap: { red: '🍎', purple: '🍇', yellow: '⭐', blue: '🐳', green: '🐸' } },
];

export const BALL_COLORS_HEX: Record<string, string> = {
  red: '#ff3366',
  purple: '#8833ff',
  yellow: '#ffbb00',
  blue: '#3366ff',
  green: '#22bb55',
};

const DEFAULT_THEME = 'Vibrant';
const STORAGE_KEY = 'six-balls-theme';

export function getStoredTheme(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some(t => t.name === stored)) return stored;
  } catch {}
  return DEFAULT_THEME;
}

export function storeTheme(name: string): void {
  try { localStorage.setItem(STORAGE_KEY, name); } catch {}
}
```

- [ ] **Step 2: Type-check**

```bash
cd client && npx tsc --noEmit
```

If `ThemeSwitcher.tsx` or other files import `getThemeEmojiMap`, you'll get an error. Remove those imports — Board.tsx no longer uses themes.

- [ ] **Step 3: Commit**

```bash
git add client/src/themes/themes.ts
git commit -m "refactor: update ball colors to vibrant palette, simplify themes"
```

---

## Task 8: Rewrite Board.tsx — Canvas Rendering + Fall Animation + Ghost Piece

**Files:**
- Rewrite: `client/src/components/Board.tsx`

This is the largest task. The board is a single `<canvas>` driven by a continuous `requestAnimationFrame` loop. Props are synced to refs so the rAF closure stays fresh without restarting.

- [ ] **Step 1: Write the complete new Board.tsx**

```typescript
import { useRef, useEffect } from 'react';
import {
  type Grid, type TrianglePiece, type GridPosition,
  getRowWidth, getPieceBallPositions, movePiece, canPlacePiece, getSpeedInterval,
} from '@six-balls/shared';

const BALL_RADIUS = 18;
const HEX_SIZE = 36;
const Y_SPACING = HEX_SIZE * Math.sqrt(3) / 2; // ~31.18px
const PADDING_X = 44;
const PADDING_Y = 32;
const TOTAL_ROWS = 12;
const CANVAS_W = 420;
const CANVAS_H = 430;

const HEX_COLORS: Record<string, string> = {
  red: '#ff3366', purple: '#8833ff', yellow: '#ffbb00', blue: '#3366ff', green: '#22bb55',
};

interface BurstBall {
  x: number; y: number; color: string;
  startTime: number; duration: number;
}

interface SettlingBall {
  fromX: number; fromY: number;
  toX: number; toY: number;
  toRow: number; toCol: number;
  color: string;
  startTime: number; duration: number;
}

export interface BoardProps {
  grid: Grid;
  currentPiece: TrianglePiece | null;
  startTime: number | null;
  isMyBoard?: boolean;
}

function posToCanvas(pos: GridPosition): { x: number; y: number } {
  const x = pos.col * HEX_SIZE + PADDING_X + (pos.row % 2 === 0 ? 0 : HEX_SIZE / 2);
  const y = (TOTAL_ROWS - 1 - pos.row) * Y_SPACING + PADDING_Y;
  return { x, y };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, colorKey: string, alpha = 1, radius = BALL_RADIUS) {
  const base = HEX_COLORS[colorKey] ?? '#cccccc';
  const rVal = parseInt(base.slice(1, 3), 16);
  const gVal = parseInt(base.slice(3, 5), 16);
  const bVal = parseInt(base.slice(5, 7), 16);
  const hi = `rgb(${Math.min(255, rVal + 120)},${Math.min(255, gVal + 120)},${Math.min(255, bVal + 120)})`;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = base + '88';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x - radius * 0.24, y - radius * 0.36, radius * 0.05, x, y, radius);
  grad.addColorStop(0, hi);
  grad.addColorStop(1, base);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number, colorKey: string, t: number) {
  const base = HEX_COLORS[colorKey] ?? '#cccccc';
  // Ball: scale to 1.45× at t=0.25, shrink and fade by t=0.55
  if (t < 0.55) {
    const scale = t < 0.25 ? 1 + 0.45 * (t / 0.25) : 1.45 - 0.35 * ((t - 0.25) / 0.3);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS * scale, 0, Math.PI * 2);
    ctx.fillStyle = base;
    ctx.fill();
    ctx.restore();
  }
  // Expanding ring (full duration)
  const ringAlpha = 0.9 * (1 - t);
  if (ringAlpha > 0) {
    const ringRadius = BALL_RADIUS * (0.4 + t * 2.1);
    ctx.save();
    ctx.globalAlpha = ringAlpha;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = base; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  // 8 particles (first 48% of animation)
  if (t < 0.48) {
    const pt = t / 0.48;
    for (let i = 0; i < 8; i++) {
      const angle = (i * 45 * Math.PI) / 180;
      const dist = (20 + (i % 3) * 4) * pt;
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;
      const pAlpha = pt < 0.7 ? 1 : 1 - (pt - 0.7) / 0.3;
      const pRadius = 4 * (1 - pt * 0.5);
      ctx.save();
      ctx.globalAlpha = pAlpha;
      ctx.beginPath();
      ctx.arc(px, py, pRadius, 0, Math.PI * 2);
      ctx.fillStyle = base; ctx.fill();
      ctx.restore();
    }
  }
}

export default function Board({ grid, currentPiece, startTime, isMyBoard = false }: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const gridRef = useRef(grid);
  const currentPieceRef = useRef(currentPiece);
  const startTimeRef = useRef(startTime);
  const lastDropTimeRef = useRef(Date.now());
  const prevGridRef = useRef<Grid>(grid);
  const lastPieceRef = useRef<TrianglePiece | null>(null);
  const settlingBallsRef = useRef<SettlingBall[]>([]);
  const settlingPosRef = useRef<Set<string>>(new Set());
  const burstingRef = useRef<BurstBall[]>([]);
  const rafRef = useRef<number>(0);

  // Sync props and detect animation triggers on each prop change
  useEffect(() => {
    const prevPiece = currentPieceRef.current;
    const prevGrid = prevGridRef.current;
    const now = Date.now();

    if (currentPiece) lastPieceRef.current = currentPiece;

    // Detect row drop for fall animation timer
    if (prevPiece && currentPiece && currentPiece.position.row < prevPiece.position.row) {
      lastDropTimeRef.current = now;
    }

    if (prevGrid !== grid) {
      // Burst: balls that disappeared from the grid
      const bursts: BurstBall[] = [];
      for (let row = 0; row < TOTAL_ROWS; row++) {
        const rw = getRowWidth(row);
        for (let col = 0; col < rw; col++) {
          if (prevGrid[row]?.[col] && !grid[row]?.[col]) {
            const { x, y } = posToCanvas({ row, col });
            bursts.push({ x, y, color: prevGrid[row][col]!.color, startTime: now, duration: 380 });
          }
        }
      }
      if (bursts.length > 0) burstingRef.current = [...burstingRef.current, ...bursts];

      // Settle: piece just landed, find new balls that appeared
      if (prevPiece && !currentPiece && lastPieceRef.current) {
        const startPositions = getPieceBallPositions(lastPieceRef.current).map(posToCanvas);
        const newBalls: Array<{ row: number; col: number; color: string }> = [];
        for (let row = 0; row < TOTAL_ROWS; row++) {
          const rw = getRowWidth(row);
          for (let col = 0; col < rw; col++) {
            if (!prevGrid[row]?.[col] && grid[row]?.[col]) {
              newBalls.push({ row, col, color: grid[row][col]!.color });
            }
          }
        }
        settlingBallsRef.current = newBalls.map((ball, i) => ({
          fromX: startPositions[Math.min(i, 2)].x,
          fromY: startPositions[Math.min(i, 2)].y,
          toX: posToCanvas({ row: ball.row, col: ball.col }).x,
          toY: posToCanvas({ row: ball.row, col: ball.col }).y,
          toRow: ball.row, toCol: ball.col,
          color: ball.color,
          startTime: now + i * 30,
          duration: 250,
        }));
        settlingPosRef.current = new Set(newBalls.map(b => `${b.row},${b.col}`));
      }
    }

    currentPieceRef.current = currentPiece;
    prevGridRef.current = grid;
    startTimeRef.current = startTime;
    gridRef.current = grid;
  }, [grid, currentPiece, startTime]);

  // Single rAF loop — runs for the lifetime of the component
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function render() {
      const now = Date.now();
      const piece = currentPieceRef.current;
      const g = gridRef.current;
      const st = startTimeRef.current;

      // Board background (white card)
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 0, 0, CANVAS_W, CANVAS_H, 12);
      ctx.fill();

      // Board border
      ctx.strokeStyle = isMyBoard ? '#ff4499' : '#cc66ff';
      ctx.lineWidth = 4;
      roundRect(ctx, 2, 2, CANVAS_W - 4, CANVAS_H - 4, 10);
      ctx.stroke();

      // Subtle dot pattern
      ctx.save();
      ctx.globalAlpha = 0.05;
      for (let dx = 12; dx < CANVAS_W; dx += 20) {
        for (let dy = 12; dy < CANVAS_H; dy += 20) {
          ctx.beginPath();
          ctx.arc(dx, dy, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#cc44aa';
          ctx.fill();
        }
      }
      ctx.restore();

      // Static grid balls (skip positions being settle-animated)
      const settling = settlingPosRef.current;
      for (let row = 0; row < TOTAL_ROWS; row++) {
        const rw = getRowWidth(row);
        for (let col = 0; col < rw; col++) {
          const ball = g[row][col];
          if (!ball || settling.has(`${row},${col}`)) continue;
          const { x, y } = posToCanvas({ row, col });
          drawBall(ctx, x, y, ball.color);
        }
      }

      // Ghost piece (hard-drop destination), shown as dashed circles
      if (piece) {
        let ghost = piece;
        while (true) {
          const next = movePiece(ghost, 'down');
          if (canPlacePiece(g, next)) ghost = next; else break;
        }
        if (ghost.position.row !== piece.position.row) {
          const gPos = getPieceBallPositions(ghost);
          ctx.save();
          ctx.setLineDash([5, 4]);
          for (let i = 0; i < 3; i++) {
            const { x, y } = posToCanvas(gPos[i]);
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.strokeStyle = HEX_COLORS[piece.colors[i]] ?? '#ccc';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.setLineDash([]); ctx.restore();
        }
      }

      // Falling piece with smooth Y interpolation
      if (piece) {
        const positions = getPieceBallPositions(piece);
        const elapsed = now - lastDropTimeRef.current;
        const interval = st ? getSpeedInterval(now - st) : 1000;
        const t = Math.min(elapsed / interval, 1);
        const yLift = Y_SPACING * (1 - t);
        for (let i = 0; i < 3; i++) {
          const { x, y } = posToCanvas(positions[i]);
          drawBall(ctx, x, y - yLift, piece.colors[i]);
        }
      }

      // Settle animations
      const stillSettling: SettlingBall[] = [];
      for (const sb of settlingBallsRef.current) {
        const elapsed = now - sb.startTime;
        if (elapsed < 0) {
          drawBall(ctx, sb.fromX, sb.fromY, sb.color);
          stillSettling.push(sb);
          continue;
        }
        const t = Math.min(elapsed / sb.duration, 1);
        const ex = easeOut(t);
        drawBall(ctx, sb.fromX + (sb.toX - sb.fromX) * ex, sb.fromY + (sb.toY - sb.fromY) * ex, sb.color);
        if (t < 1) { stillSettling.push(sb); }
        else { settlingPosRef.current.delete(`${sb.toRow},${sb.toCol}`); }
      }
      settlingBallsRef.current = stillSettling;

      // Burst animations
      const stillBursting: BurstBall[] = [];
      for (const bb of burstingRef.current) {
        const t = Math.min((now - bb.startTime) / bb.duration, 1);
        drawBurst(ctx, bb.x, bb.y, bb.color, t);
        if (t < 1) stillBursting.push(bb);
      }
      burstingRef.current = stillBursting;

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ display: 'block', borderRadius: '12px', boxShadow: '0 4px 24px rgba(255,68,153,0.15)' }}
    />
  );
}
```

- [ ] **Step 2: Type-check the client**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors. Fix any missing imports.

- [ ] **Step 3: Start the dev server and verify the board renders**

```bash
cd client && npm run dev
```

Open the local URL. Start a local game. Verify:
- White card boards with colored borders appear
- Balls render as gradient spheres with white borders
- Ghost piece (dashed circles) shows below falling piece
- Piece falls smoothly (no teleport)
- Balls split and slide to settled positions on landing
- Pattern clears trigger burst animation (scale up, particles, ring, clean disappear)

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Board.tsx
git commit -m "feat: rewrite Board.tsx with rAF loop, smooth fall, settle/burst animations, vibrant style"
```

---

## Task 9: Redesign GameView.tsx — Side-Panel HUD + Attack Queue

**Files:**
- Rewrite: `client/src/components/GameView.tsx`

- [ ] **Step 1: Write the complete new GameView.tsx**

```typescript
import type { GameState, PlayerState, Attack } from '@six-balls/shared';
import { getPieceBallPositions } from '@six-balls/shared';
import Board from './Board';

const BALL_HEX: Record<string, string> = {
  red: '#ff3366', purple: '#8833ff', yellow: '#ffbb00', blue: '#3366ff', green: '#22bb55',
};

function MiniDot({ color, size = 7 }: { color: string; size?: number }) {
  const base = BALL_HEX[color] ?? '#cccccc';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: base, border: '1.5px solid white',
      boxShadow: `0 1px 3px ${base}88`,
      flexShrink: 0,
    }} />
  );
}

function NextPiecePreview({ nextPiece }: { nextPiece: PlayerState['nextPiece'] }) {
  const positions = getPieceBallPositions(nextPiece);
  // Normalize to show in a small 3-ball triangle layout
  const minRow = Math.min(...positions.map(p => p.row));
  const minCol = Math.min(...positions.map(p => p.col));
  const cells: Array<{ row: number; col: number; color: string }> = positions.map((p, i) => ({
    row: p.row - minRow, col: p.col - minCol, color: nextPiece.colors[i],
  }));
  const maxRow = Math.max(...cells.map(c => c.row));
  const maxCol = Math.max(...cells.map(c => c.col));
  const CELL = 16;
  return (
    <div style={{ position: 'relative', width: (maxCol + 1) * CELL + 8, height: (maxRow + 1) * CELL + 8, margin: '0 auto' }}>
      {cells.map((c, i) => (
        <div key={i} style={{ position: 'absolute', left: c.col * CELL, top: (maxRow - c.row) * CELL }}>
          <MiniDot color={c.color} size={12} />
        </div>
      ))}
    </div>
  );
}

function AttackDiagram({ attack }: { attack: Attack | null }) {
  if (!attack) {
    return (
      <div style={{ textAlign: 'center', color: '#ddd', fontSize: '11px', padding: '8px 0' }}>
        · · · <br />safe!
      </div>
    );
  }

  const COUNT_LABEL = `${attack.count}× incoming`;

  if (attack.type === 'hexagonRings') {
    // 2-row-2 with hollow center (6 balls around 1 empty center)
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: '2px' }}>
            <MiniDot color="red" /><MiniDot color="red" />
          </div>
          <div style={{ display: 'flex', gap: '2px' }}>
            <MiniDot color="red" />
            <div style={{ width: 7, height: 7, borderRadius: '50%', border: '1px dashed #ff336688', flexShrink: 0 }} />
            <MiniDot color="red" />
          </div>
          <div style={{ display: 'flex', gap: '2px' }}>
            <MiniDot color="red" /><MiniDot color="red" />
          </div>
        </div>
        <div style={{ fontSize: '8px', color: '#cc88aa' }}>{COUNT_LABEL}</div>
      </div>
    );
  }

  if (attack.type === 'rows') {
    const ROW_COLORS = ['purple', 'blue', 'purple', 'yellow', 'purple'];
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: '1px', justifyContent: 'center' }}>
            {ROW_COLORS.map((c, i) => <MiniDot key={i} color={c} />)}
          </div>
          <div style={{ display: 'flex', gap: '1px', justifyContent: 'center' }}>
            {['green', 'red', 'blue', 'green', 'yellow'].map((c, i) => <MiniDot key={i} color={c} />)}
          </div>
        </div>
        <div style={{ fontSize: '8px', color: '#cc88aa' }}>{COUNT_LABEL}</div>
      </div>
    );
  }

  if (attack.type === 'triangles') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: '2px' }}><MiniDot color="yellow" /></div>
          <div style={{ display: 'flex', gap: '2px' }}><MiniDot color="yellow" /><MiniDot color="yellow" /></div>
          <div style={{ display: 'flex', gap: '2px' }}><MiniDot color="yellow" /><MiniDot color="yellow" /><MiniDot color="yellow" /></div>
        </div>
        <div style={{ fontSize: '8px', color: '#cc88aa' }}>{COUNT_LABEL}</div>
      </div>
    );
  }

  return null;
}

function HudColumn({ player, label }: { player: PlayerState; label: string }) {
  const nextAttack = player.attackQueue[0] ?? null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '88px', flexShrink: 0 }}>
      <div style={{ fontWeight: 700, fontSize: '11px', color: '#ff4499', letterSpacing: '1px', textAlign: 'center' }}>
        {label}
      </div>

      {/* NEXT piece */}
      <div style={{ background: 'white', borderRadius: '10px', border: '2px solid #ffb3d1', padding: '8px 6px', boxShadow: '0 2px 8px rgba(255,100,150,0.12)' }}>
        <div style={{ fontSize: '9px', color: '#cc88aa', fontWeight: 700, letterSpacing: '1px', textAlign: 'center', marginBottom: 6 }}>NEXT</div>
        <NextPiecePreview nextPiece={player.nextPiece} />
      </div>

      {/* INCOMING attack queue */}
      <div style={{ background: 'white', borderRadius: '10px', border: nextAttack ? '2px solid #cc99ff' : '2px dashed #eee', padding: '8px 6px', boxShadow: nextAttack ? '0 2px 8px rgba(136,51,255,0.12)' : 'none' }}>
        <div style={{ fontSize: '9px', color: '#cc88aa', fontWeight: 700, letterSpacing: '1px', textAlign: 'center', marginBottom: 6 }}>INCOMING</div>
        <AttackDiagram attack={nextAttack} />
      </div>
    </div>
  );
}

interface GameViewProps {
  gameState: GameState;
  myPlayerId: string;
}

export default function GameView({ gameState, myPlayerId }: GameViewProps) {
  const myIndex = gameState.players.findIndex(p => p.id === myPlayerId);
  const myPlayer = gameState.players[myIndex !== -1 ? myIndex : 0];
  const opponent = gameState.players[myIndex === 0 ? 1 : 0];
  const startTime = gameState.startTime;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '12px', padding: '16px 24px', flexWrap: 'wrap' }}>

      {/* My HUD */}
      <HudColumn player={myPlayer} label="YOU" />

      {/* My board */}
      <Board
        grid={myPlayer.grid}
        currentPiece={myPlayer.currentPiece}
        startTime={startTime}
        isMyBoard={true}
      />

      {/* VS divider */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', padding: '0 4px' }}>
        <div style={{ fontWeight: 900, fontSize: '20px', color: '#cc88aa', letterSpacing: '2px' }}>VS</div>
      </div>

      {/* Opponent board */}
      <Board
        grid={opponent.grid}
        currentPiece={opponent.currentPiece}
        startTime={startTime}
        isMyBoard={false}
      />

      {/* Opponent HUD */}
      <HudColumn player={opponent} label="OPP" />

    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify visually in the browser**

With the dev server running, start a local game. Verify:
- Two boards side by side with VS between them
- HUD column on each side showing NEXT piece preview and INCOMING attack queue
- "safe!" shown when attack queue is empty
- Mini ball diagrams appear when attacks are queued

- [ ] **Step 4: Commit**

```bash
git add client/src/components/GameView.tsx
git commit -m "feat: redesign GameView with side-panel HUD, attack queue mini-diagrams"
```

---

## Task 10: Redesign Menu.tsx — Vibrant Style

**Files:**
- Rewrite: `client/src/components/Menu.tsx`

- [ ] **Step 1: Write the complete new Menu.tsx**

```typescript
import { useState } from 'react';

interface MenuProps {
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  createdRoomCode: string | null;
  joinError: string | null;
  onLocalPlay?: () => void;
}

const BTN: React.CSSProperties = {
  padding: '14px 24px',
  fontSize: '15px',
  fontWeight: 700,
  border: 'none',
  borderRadius: '24px',
  cursor: 'pointer',
  width: '100%',
  letterSpacing: '1px',
  transition: 'transform 0.1s, box-shadow 0.1s',
};

export default function Menu({ onCreateRoom, onJoinRoom, createdRoomCode, joinError, onLocalPlay }: MenuProps) {
  const [joinCode, setJoinCode] = useState('');

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff5fb, #f5f0ff)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>

      <h1 style={{ fontSize: '36px', fontWeight: 900, color: '#ff4499', letterSpacing: '3px', margin: '0 0 8px', textShadow: '0 2px 0 #ffaacc' }}>
        SIX BALLS PUZZLE
      </h1>
      <p style={{ color: '#cc88aa', fontSize: '14px', marginBottom: '36px' }}>Match 6 to win!</p>

      <div style={{ background: 'white', borderRadius: '20px', padding: '32px 36px', boxShadow: '0 4px 32px rgba(255,68,153,0.15)', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        <button
          onClick={onLocalPlay}
          style={{ ...BTN, background: 'linear-gradient(135deg, #ff4499, #cc33ff)', color: 'white', boxShadow: '0 3px 12px rgba(255,50,150,0.4)' }}
        >
          Local Play
        </button>

        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #ffd0e8, transparent)' }} />

        <button
          onClick={onCreateRoom}
          style={{ ...BTN, background: 'white', color: '#ff4499', border: '2px solid #ffb3d1', boxShadow: '0 2px 8px rgba(255,100,150,0.15)' }}
        >
          Create Online Room
        </button>

        {createdRoomCode && (
          <div style={{ background: 'linear-gradient(135deg, #fff5fb, #f5f0ff)', borderRadius: '12px', padding: '14px', textAlign: 'center', border: '1px solid #ffb3d1' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#cc88aa', fontWeight: 700, letterSpacing: '1px' }}>ROOM CODE</p>
            <p style={{ margin: '0 0 6px', fontSize: '32px', fontWeight: 900, letterSpacing: '6px', color: '#ff4499' }}>{createdRoomCode}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#cc88aa' }}>Waiting for opponent...</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter room code"
            maxLength={6}
            style={{ padding: '12px 16px', fontSize: '18px', textAlign: 'center', letterSpacing: '4px', fontWeight: 700, border: '2px solid #ffb3d1', borderRadius: '12px', color: '#ff4499', background: 'white', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
          <button
            onClick={() => onJoinRoom(joinCode)}
            disabled={joinCode.length !== 6}
            style={{ ...BTN, background: joinCode.length === 6 ? 'linear-gradient(135deg, #8833ff, #cc33ff)' : '#f0e0f0', color: joinCode.length === 6 ? 'white' : '#cc99cc', cursor: joinCode.length === 6 ? 'pointer' : 'default', boxShadow: joinCode.length === 6 ? '0 3px 12px rgba(136,51,255,0.4)' : 'none' }}
          >
            Join Room
          </button>
          {joinError && <p style={{ margin: 0, color: '#ff4499', fontSize: '13px', textAlign: 'center' }}>{joinError}</p>}
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify visually**

With the dev server running, open the menu. Verify:
- Pink/purple gradient background
- White centered card with shadow
- "Local Play" button in gradient pink
- Room code display with large text when created
- Join input and button styled correctly

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Menu.tsx
git commit -m "feat: redesign Menu with vibrant pink/purple style"
```

---

## Task 11: Integration Smoke Test

- [ ] **Step 1: Run the full shared test suite**

```bash
cd shared && npm test
```

Expected: 76 tests pass, 0 fail.

- [ ] **Step 2: Build the client (catches any remaining type/import errors)**

```bash
cd client && npm run build
```

Expected: build succeeds, no type errors.

- [ ] **Step 3: Build the server**

```bash
cd server && npm run build
```

Expected: compile succeeds.

- [ ] **Step 4: Manual — local 2-player game**

Start the client dev server. Open the game, click "Local Play". Test:
- [ ] Piece falls smoothly (not teleporting)
- [ ] Arrow keys move P1, WASD moves P2
- [ ] Soft drop (↓/S) moves piece one row at a time
- [ ] Hard drop (Space/Shift) instantly places piece at bottom
- [ ] Ghost piece (dashed circles) shows correct landing position
- [ ] Piece lands, 3 balls slide separately to settled positions (250ms)
- [ ] When 6+ matching balls form a pattern, they burst (scale up, particles, ring, disappear cleanly — no ghost dot left)
- [ ] NEXT piece preview in HUD updates correctly
- [ ] INCOMING attack queue shows "safe!" when empty; shows shape diagram when opponent clears patterns
- [ ] Game-over overlay appears when a player's grid fills to top row; "P1 WINS" / "P2 WINS" shown correctly
- [ ] "Play Again" restarts the game; "Menu" returns to main menu

- [ ] **Step 5: Manual — online game**

Start the server. Open two browser tabs. Create a room in tab 1, join in tab 2, click Ready in both. Test:
- [ ] Arrow keys work in online mode (piece responds to keyboard)
- [ ] Piece falls at correct auto-drop speed (not teleporting)
- [ ] Game-over overlay appears in the winner's tab
- [ ] "Back to Menu" returns to the main menu

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: integration smoke test passed — full redesign complete"
```

---

## Self-Review

**Spec coverage check:**

| Spec Section | Task |
|---|---|
| Visual style (gradient bg, card boards, dot pattern) | Task 8 (Board), Task 6 (App) |
| Ball rendering (radial gradient, white border, drop shadow) | Task 8 |
| Ghost piece (dashed circles at drop destination) | Task 8 |
| Screen layout (title top, controls bottom, HUD+boards+VS) | Task 6 (App), Task 9 (GameView) |
| HUD column (NEXT, INCOMING, score) | Task 9 |
| Attack queue mini-diagrams (hexagon, rows, pyramid, safe) | Task 9 |
| Menu redesign | Task 10 |
| Game-over overlay | Task 6 |
| Phase 1 fall animation (subRow smooth) | Task 8 |
| Phase 2 settle (3 balls slide independently) | Task 8 |
| Burst animation (scale 1.45×, 8 particles, ring, clean disappear) | Task 8 |
| Fix spawn position | Task 1 |
| Per-player pieceIndex | Tasks 2, 3, 4 |
| Auto-fall uses softDrop | Tasks 5, 6 |
| Online keyboard controls | Task 6 |
| Restart flow (Play Again / Back to Menu) | Task 6 |
| All 76 shared tests pass | Tasks 1, 2, 11 |

**Score display:** The spec HUD shows a SCORE field, but `PlayerState` has no score field and the File Change Summary does not list adding one to `types.ts`. The HUD layout in Task 9 omits the score counter rather than inventing a fake value. If score is needed, it can be added in a follow-up (add `score: number` to `PlayerState`, increment in `handlePieceLand` based on patterns cleared).
