# Six Balls Puzzle - Gameplay Fixes & Features Design

## Overview

Fix critical gameplay bugs and add missing features to make the game playable and fair. Addresses auto-fall, piece rendering, fairness, visuals, local 2P, and theming.

---

## 1. Auto-Fall System (Client-Predictive)

### Architecture

Each client runs its own `setInterval` timer that auto-drops the piece downward. The server is the authority for pattern matching, clearing, and game-over detection.

### Flow

```
Client tick → movePiece(piece, 'down')
  ├─ canPlacePiece succeeds → update local display
  └─ canPlacePiece fails → emit 'hardDrop' to server
                              → server lands piece, processes patterns, gravity
                              → broadcasts gameStateUpdate
```

### Speed Schedule

The interval shortens based on elapsed game time (`Date.now() - gameState.startTime`):

| Elapsed Time | Interval |
|-------------|----------|
| 0–30s | 1000ms |
| 30–60s | 800ms |
| 60–120s | 600ms |
| 120–180s | 450ms |
| 180s+ | 300ms |

### Implementation

- **File:** `client/src/hooks/useAutoDrop.ts` — React hook wrapping `setInterval`
- **File:** `client/src/App.tsx` — wire hook in when `screen === 'playing'`
- Reads `gameState.startTime` to determine current speed tier

---

## 2. Bubble Burst Animation

### Behavior

When the server sends `gameStateUpdate` and balls were removed (positions changed from `Ball` to `null` compared to previous state), trigger animation on those cells.

### Animation Effects by Pattern

| Pattern | Effect |
|---------|--------|
| `hexagonRing` | Balls glow gold, expand, fade out over 400ms |
| `sixLine` | White particle trail sweeps along the line direction |
| `pyramid` | Balls burst upward with small particle fragments |
| `sixConnected` | Balls shrink inward with a quick pop (250ms) |

### Implementation

- **File:** `client/src/components/Board.tsx` — add animation state tracking via `useRef`
- Compare previous grid snapshot to new grid to find removed positions
- Use `requestAnimationFrame` for smooth animation
- Animated balls: draw at increasing radius + decreasing opacity over N frames

---

## 3. Fair Piece Sequence (Shared PRNG)

### Problem

Currently `createPieceAtSpawn()` uses `Math.random()` independently per call. Each player gets a different sequence.

### Solution

Server generates a precomputed piece sequence when the game starts. Uses `gameState.startTime` as PRNG seed.

### Changes

- Add seed-based PRNG to shared package: `shared/src/rng.ts`
  - `export function createRNG(seed: number)` returns `{ next(): number }`
  - Uses a simple mulberry32 or similar deterministic algorithm
- Move piece generation to server: `server/src/GameEngine.ts`
  - `createInitialGameState` creates an RNG, generates first 100 pieces
  - Stores `pieceSequence: [BallColor, BallColor, BallColor][]` in `GameState`
  - When a piece lands, both players advance to the next piece in the sequence
- Client reads `currentPiece` and `nextPiece` from `gameState`

### Data Changes

Add to `GameState` interface:
```typescript
pieceIndex: number;  // current position in sequence
```

---

## 4. Next Piece Preview

### Layout

Show a small preview of the upcoming piece next to each player's board:

```
┌─────────┬─────────────┐
│   NEXT  │   GAME      │
│    ▲    │   BOARD     │
│   ● ●   │             │
└─────────┴─────────────┘
```

### Implementation

- **File:** `client/src/components/Board.tsx` — accept optional `nextPiece` prop
- Draw 3 small balls (radius 8) in triangle formation in a small inset area
- **File:** `client/src/components/GameView.tsx` — pass `player.nextPiece` to `Board`

---

## 5. Local 2-Player Mode

### Controls

Two players share one keyboard:

| Action | Player 1 | Player 2 |
|--------|----------|----------|
| Left | ← (ArrowLeft) | A |
| Right | → (ArrowRight) | D |
| Rotate | ↑ (ArrowUp) | W |
| Soft Drop | ↓ (ArrowDown) | S |
| Hard Drop | Space | Shift (ShiftLeft) |

### Architecture

Client-only mode, no server. Uses the shared game logic library directly.

### Implementation

- **File:** `client/src/game/localGame.ts` — local game engine class
  - Manages `GameState` for both players in-memory
  - Runs auto-fall timer for both players
  - Calls `processInput`, `landPiece`, `processBoard`, `isGameOver` from shared
  - Exposes: `getState()`, `handleInput(playerIndex, input)`, `start()`, `stop()`
- **File:** `client/src/hooks/useLocalGame.ts` — React hook wrapping localGame
- **File:** `client/src/components/Menu.tsx` — add "Local Play" button
- **File:** `client/src/components/GameView.tsx` — accept local game state
- **File:** `client/src/App.tsx` — `localPlay` screen state

### Menu Changes

Add "Local Play" button to the main menu. Clicking it starts local mode immediately (no lobby needed).

---

## 6. Hex Grid Rendering Fix

### Problem

Current rendering uses `row * cellSize` for Y spacing, which produces a vertically stretched grid where circles are far apart and the triangle piece appears non-equilateral.

### Fix

Use proper hex grid packing:
- **Cell size:** ~32px diameter
- **Y spacing between rows:** `cellSize * sqrt(3) / 2` ≈ 27.7px
- **X spacing between columns:** `cellSize`
- **Odd row X offset:** `cellSize / 2`

### Canvas dimensions

For a 10-col × 12-row grid:
- Width: `(10 + 2) * cellSize` = 384px (with padding)
- Height: `(12 + 1) * cellSize * sqrt(3) / 2 + padding` = ~390px

Add subtle hex cell outlines behind the balls as a background grid.

### Board Frame

Draw a visible container border around the play area:
- Outer rectangle with rounded corners
- Row labels (or tick marks) on the left side
- Background: slightly darker than the canvas background

---

## 7. Ball Theme Switcher

### Themes

| Theme Name | Red | Purple | Yellow | Blue | Green |
|-----------|-----|--------|--------|------|-------|
| Classic | `#ff4444` gradient sphere | `#9944ff` gradient sphere | `#ffdd44` gradient sphere | `#4488ff` gradient sphere | `#44cc44` gradient sphere |
| Flat | `#ff4444` solid | `#9944ff` solid | `#ffdd44` solid | `#4488ff` solid | `#44cc44` solid |
| Emoji | 🍎 | 🍇 | ⭐ | 🐳 | 🐸 |
| Fruit | 🍎 | 🍇 | 🍋 | 🫐 | 🥝 |

### Implementation

- **File:** `client/src/themes/themes.ts` — theme definitions as objects
- **File:** `client/src/components/Board.tsx` — accept `theme` prop, draw balls using theme renderer
- **File:** `client/src/components/ThemeSwitcher.tsx` — dropdown/button row selecting theme
- Theme choice stored in `localStorage`, applied per-player board

### Rendering

- **Classic:** Canvas `createRadialGradient` for 3D sphere effect
- **Flat:** Solid fill with dark stroke
- **Emoji/Fruit:** `ctx.fillText(emoji, x, y)` centered on ball position

---

## 8. Pyramid Detection Verification

Both point-up and point-down pyramids already exist in `shared/src/patterns.ts` via `getPointUpPyramid()` and `getPointDownPyramid()`. `findPyramid()` checks both orientations. The issue may be that tests only cover row 0 (bottom of grid) — verify with additional test cases at various row positions.

### Action

- Add tests for pyramid detection at rows 2, 4, and 6 (confirm parity handling)
- Verify both orientations are returned when both exist simultaneously

---

## File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `shared/src/rng.ts` | NEW | Seed-based PRNG for deterministic piece sequences |
| `shared/src/rng.test.ts` | NEW | RNG tests |
| `shared/src/types.ts` | MODIFY | Add `pieceIndex` to GameState, `theme` to PlayerState |
| `shared/src/piece.ts` | MODIFY | Accept external RNG in createPieceAtSpawn |
| `server/src/GameEngine.ts` | MODIFY | Use PRNG for piece sequence, generate in createInitialGameState |
| `client/src/hooks/useAutoDrop.ts` | NEW | Auto-fall timer hook |
| `client/src/hooks/useLocalGame.ts` | NEW | Local 2P game engine hook |
| `client/src/game/localGame.ts` | NEW | Client-side game engine class |
| `client/src/components/Board.tsx` | MODIFY | Hex grid fix, bubble animations, theme support, next piece preview |
| `client/src/components/GameView.tsx` | MODIFY | Pass nextPiece, theme props |
| `client/src/components/ThemeSwitcher.tsx` | NEW | Theme selection UI |
| `client/src/themes/themes.ts` | NEW | Theme definitions |
| `client/src/components/Menu.tsx` | MODIFY | Add "Local Play" button |
| `client/src/App.tsx` | MODIFY | Local play mode, auto-drop, theme state |
| `shared/src/game-engine.ts` | MODIFY | Add getSpeedInterval helper |
| `shared/src/patterns.ts` | MODIFY | Add pyramid cross-row tests |

---

## Testing

- **RNG:** Verify seed produces deterministic, reproducible sequence
- **Auto-fall:** Timer fires at correct intervals, stops on game end
- **Local 2P:** Both boards respond to their respective key mappings
- **Hex rendering:** Equilateral triangles render correctly at all rotations
- **Bubble animation:** Cleared balls animate before removal
- **Theme:** Switching theme updates both boards immediately
- **Pyramid:** Both orientations detected at various row positions, with even/odd parity
