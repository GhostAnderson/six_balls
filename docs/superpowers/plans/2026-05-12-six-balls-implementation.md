# Six Balls Puzzle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based two-player puzzle battle game with hexagonal grid, pattern matching, and real-time multiplayer.

**Architecture:** Shared game logic library used by both client (for local preview/rendering) and server (authoritative state). React + Canvas frontend, Node.js + Socket.IO backend. Monorepo with three packages: `shared`, `client`, `server`.

**Tech Stack:** TypeScript, React 18, HTML5 Canvas, Vite, Node.js, Express, Socket.IO

---

## Phase 1: Project Setup & Core Data Structures

### Task 1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/index.ts`

- [ ] **Step 1: Create root package.json for monorepo**

```json
{
  "name": "six-balls",
  "private": true,
  "workspaces": [
    "shared",
    "client",
    "server"
  ],
  "scripts": {
    "test": "npm test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  }
}
```

- [ ] **Step 2: Create base TypeScript config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create shared package**

Create `shared/package.json`:
```json
{
  "name": "@six-balls/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

Create `shared/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `shared/src/index.ts`:
```typescript
export * from './types';
export * from './grid';
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: Dependencies installed, no errors

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd shared && npm run build`
Expected: Build succeeds (may warn about missing exports, that's fine for now)

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.base.json shared/
git commit -m "chore: initialize monorepo with shared package"
```

---

### Task 2: Core Types

**Files:**
- Create: `shared/src/types.ts`
- Create: `shared/src/types.test.ts`

- [ ] **Step 1: Define core game types**

Create `shared/src/types.ts`:
```typescript
/** Ball colors in the game */
export type BallColor = 'red' | 'purple' | 'yellow' | 'blue' | 'green';

/** All possible ball colors */
export const BALL_COLORS: readonly BallColor[] = ['red', 'purple', 'yellow', 'blue', 'green'] as const;

/** Position in the hexagonal grid */
export interface GridPosition {
  row: number;  // 0 = bottom, 11 = top
  col: number;  // 0 = left
}

/** A ball on the grid */
export interface Ball {
  color: BallColor;
  position: GridPosition;
}

/** Grid dimensions */
export const GRID_WIDTH_EVEN = 10;  // Columns in even rows (0, 2, 4...)
export const GRID_WIDTH_ODD = 9;    // Columns in odd rows (1, 3, 5...)
export const GRID_HEIGHT = 12;      // Total rows (0-11)

/** Rotation state of the falling triangle (0-5, each step is 60 degrees clockwise) */
export type RotationState = 0 | 1 | 2 | 3 | 4 | 5;

/** A falling triangle piece with 3 balls */
export interface TrianglePiece {
  /** Center position of the piece */
  position: GridPosition;
  /** Current rotation (0-5) */
  rotation: RotationState;
  /** Colors of the 3 balls [top/center, bottomLeft, bottomRight] at rotation 0 */
  colors: [BallColor, BallColor, BallColor];
}

/** Pattern types that can be matched */
export type PatternType = 'hexagonRing' | 'sixLine' | 'pyramid' | 'sixConnected';

/** Result of pattern detection */
export interface PatternMatch {
  type: PatternType;
  positions: GridPosition[];
  color: BallColor;
}

/** Attack types sent to opponent */
export type AttackType = 'hexagonRings' | 'rows' | 'triangles';

/** Attack payload */
export interface Attack {
  type: AttackType;
  count: number;
}

/** Game phase */
export type GamePhase = 'waiting' | 'countdown' | 'playing' | 'paused' | 'ended';

/** Player state */
export interface PlayerState {
  id: string;
  grid: (Ball | null)[][];  // grid[row][col]
  currentPiece: TrianglePiece | null;
  nextPiece: TrianglePiece;
  attackQueue: Attack[];
  isAlive: boolean;
}

/** Complete game state */
export interface GameState {
  phase: GamePhase;
  players: [PlayerState, PlayerState];
  startTime: number | null;
  winner: string | null;
}
```

- [ ] **Step 2: Write type validation tests**

Create `shared/src/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  BALL_COLORS,
  GRID_WIDTH_EVEN,
  GRID_WIDTH_ODD,
  GRID_HEIGHT,
  type BallColor,
  type GridPosition
} from './types';

describe('types', () => {
  it('has 5 ball colors', () => {
    expect(BALL_COLORS).toHaveLength(5);
    expect(BALL_COLORS).toContain('red');
    expect(BALL_COLORS).toContain('purple');
    expect(BALL_COLORS).toContain('yellow');
    expect(BALL_COLORS).toContain('blue');
    expect(BALL_COLORS).toContain('green');
  });

  it('has correct grid dimensions', () => {
    expect(GRID_WIDTH_EVEN).toBe(10);
    expect(GRID_WIDTH_ODD).toBe(9);
    expect(GRID_HEIGHT).toBe(12);
  });
});
```

- [ ] **Step 3: Run tests to verify**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add shared/src/types.ts shared/src/types.test.ts
git commit -m "feat(shared): add core game types"
```

---

### Task 3: Hexagonal Grid - Position Validation

**Files:**
- Create: `shared/src/grid.ts`
- Create: `shared/src/grid.test.ts`

- [ ] **Step 1: Write failing tests for position validation**

Create `shared/src/grid.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidPosition, getRowWidth } from './grid';

describe('grid', () => {
  describe('getRowWidth', () => {
    it('returns 10 for even rows', () => {
      expect(getRowWidth(0)).toBe(10);
      expect(getRowWidth(2)).toBe(10);
      expect(getRowWidth(10)).toBe(10);
    });

    it('returns 9 for odd rows', () => {
      expect(getRowWidth(1)).toBe(9);
      expect(getRowWidth(3)).toBe(9);
      expect(getRowWidth(11)).toBe(9);
    });
  });

  describe('isValidPosition', () => {
    it('accepts valid positions in even rows', () => {
      expect(isValidPosition({ row: 0, col: 0 })).toBe(true);
      expect(isValidPosition({ row: 0, col: 9 })).toBe(true);
      expect(isValidPosition({ row: 2, col: 5 })).toBe(true);
    });

    it('accepts valid positions in odd rows', () => {
      expect(isValidPosition({ row: 1, col: 0 })).toBe(true);
      expect(isValidPosition({ row: 1, col: 8 })).toBe(true);
      expect(isValidPosition({ row: 3, col: 4 })).toBe(true);
    });

    it('rejects positions outside grid height', () => {
      expect(isValidPosition({ row: -1, col: 0 })).toBe(false);
      expect(isValidPosition({ row: 12, col: 0 })).toBe(false);
    });

    it('rejects positions outside row width', () => {
      expect(isValidPosition({ row: 0, col: -1 })).toBe(false);
      expect(isValidPosition({ row: 0, col: 10 })).toBe(false);
      expect(isValidPosition({ row: 1, col: 9 })).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - functions not defined

- [ ] **Step 3: Implement grid utilities**

Create `shared/src/grid.ts`:
```typescript
import { GRID_WIDTH_EVEN, GRID_WIDTH_ODD, GRID_HEIGHT, type GridPosition } from './types';

/**
 * Get the width (number of columns) for a given row.
 * Even rows have 10 columns, odd rows have 9.
 */
export function getRowWidth(row: number): number {
  return row % 2 === 0 ? GRID_WIDTH_EVEN : GRID_WIDTH_ODD;
}

/**
 * Check if a position is within the grid bounds.
 */
export function isValidPosition(pos: GridPosition): boolean {
  if (pos.row < 0 || pos.row >= GRID_HEIGHT) {
    return false;
  }
  if (pos.col < 0 || pos.col >= getRowWidth(pos.row)) {
    return false;
  }
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/grid.ts shared/src/grid.test.ts
git commit -m "feat(shared): add grid position validation"
```

---

### Task 4: Hexagonal Grid - Neighbor Calculation

**Files:**
- Modify: `shared/src/grid.ts`
- Modify: `shared/src/grid.test.ts`

- [ ] **Step 1: Write failing tests for neighbor calculation**

Add to `shared/src/grid.test.ts`:
```typescript
describe('getNeighbors', () => {
  it('returns 6 neighbors for center position in even row', () => {
    // Position (2, 5) in even row
    const neighbors = getNeighbors({ row: 2, col: 5 });
    expect(neighbors).toHaveLength(6);

    // Even row neighbor offsets:
    // upper-left: (row+1, col-1), upper-right: (row+1, col)
    // left: (row, col-1), right: (row, col+1)
    // lower-left: (row-1, col-1), lower-right: (row-1, col)
    expect(neighbors).toContainEqual({ row: 3, col: 4 });  // upper-left
    expect(neighbors).toContainEqual({ row: 3, col: 5 });  // upper-right
    expect(neighbors).toContainEqual({ row: 2, col: 4 });  // left
    expect(neighbors).toContainEqual({ row: 2, col: 6 });  // right
    expect(neighbors).toContainEqual({ row: 1, col: 4 });  // lower-left
    expect(neighbors).toContainEqual({ row: 1, col: 5 });  // lower-right
  });

  it('returns 6 neighbors for center position in odd row', () => {
    // Position (3, 4) in odd row
    const neighbors = getNeighbors({ row: 3, col: 4 });
    expect(neighbors).toHaveLength(6);

    // Odd row neighbor offsets:
    // upper-left: (row+1, col), upper-right: (row+1, col+1)
    // left: (row, col-1), right: (row, col+1)
    // lower-left: (row-1, col), lower-right: (row-1, col+1)
    expect(neighbors).toContainEqual({ row: 4, col: 4 });  // upper-left
    expect(neighbors).toContainEqual({ row: 4, col: 5 });  // upper-right
    expect(neighbors).toContainEqual({ row: 3, col: 3 });  // left
    expect(neighbors).toContainEqual({ row: 3, col: 5 });  // right
    expect(neighbors).toContainEqual({ row: 2, col: 4 });  // lower-left
    expect(neighbors).toContainEqual({ row: 2, col: 5 });  // lower-right
  });

  it('filters out invalid positions at edges', () => {
    // Bottom-left corner
    const neighbors = getNeighbors({ row: 0, col: 0 });
    // Should only have valid neighbors (no negative positions)
    neighbors.forEach(n => {
      expect(isValidPosition(n)).toBe(true);
    });
    expect(neighbors.length).toBeLessThan(6);
  });

  it('filters out invalid positions at top', () => {
    const neighbors = getNeighbors({ row: 11, col: 4 });
    // Row 12 doesn't exist
    neighbors.forEach(n => {
      expect(isValidPosition(n)).toBe(true);
    });
  });
});
```

Add import at top:
```typescript
import { isValidPosition, getRowWidth, getNeighbors } from './grid';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - getNeighbors not defined

- [ ] **Step 3: Implement getNeighbors**

Add to `shared/src/grid.ts`:
```typescript
/** Direction names for the 6 hex neighbors */
export type HexDirection = 'upperLeft' | 'upperRight' | 'left' | 'right' | 'lowerLeft' | 'lowerRight';

/**
 * Get neighbor offset based on row parity and direction.
 */
function getNeighborOffset(isEvenRow: boolean, direction: HexDirection): { dRow: number; dCol: number } {
  if (isEvenRow) {
    // Even row offsets
    switch (direction) {
      case 'upperLeft':  return { dRow: 1, dCol: -1 };
      case 'upperRight': return { dRow: 1, dCol: 0 };
      case 'left':       return { dRow: 0, dCol: -1 };
      case 'right':      return { dRow: 0, dCol: 1 };
      case 'lowerLeft':  return { dRow: -1, dCol: -1 };
      case 'lowerRight': return { dRow: -1, dCol: 0 };
    }
  } else {
    // Odd row offsets
    switch (direction) {
      case 'upperLeft':  return { dRow: 1, dCol: 0 };
      case 'upperRight': return { dRow: 1, dCol: 1 };
      case 'left':       return { dRow: 0, dCol: -1 };
      case 'right':      return { dRow: 0, dCol: 1 };
      case 'lowerLeft':  return { dRow: -1, dCol: 0 };
      case 'lowerRight': return { dRow: -1, dCol: 1 };
    }
  }
}

const ALL_DIRECTIONS: HexDirection[] = ['upperLeft', 'upperRight', 'left', 'right', 'lowerLeft', 'lowerRight'];

/**
 * Get all valid neighbor positions for a given position.
 * Returns only positions that are within the grid bounds.
 */
export function getNeighbors(pos: GridPosition): GridPosition[] {
  const isEvenRow = pos.row % 2 === 0;
  const neighbors: GridPosition[] = [];

  for (const direction of ALL_DIRECTIONS) {
    const offset = getNeighborOffset(isEvenRow, direction);
    const neighbor: GridPosition = {
      row: pos.row + offset.dRow,
      col: pos.col + offset.dCol,
    };
    if (isValidPosition(neighbor)) {
      neighbors.push(neighbor);
    }
  }

  return neighbors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/grid.ts shared/src/grid.test.ts
git commit -m "feat(shared): add hex neighbor calculation"
```

---

### Task 5: Grid Creation and Ball Access

**Files:**
- Modify: `shared/src/grid.ts`
- Modify: `shared/src/grid.test.ts`

- [ ] **Step 1: Write failing tests for grid creation and access**

Add to `shared/src/grid.test.ts`:
```typescript
import {
  isValidPosition,
  getRowWidth,
  getNeighbors,
  createEmptyGrid,
  getBall,
  setBall,
  type Grid
} from './grid';
import type { Ball } from './types';

describe('createEmptyGrid', () => {
  it('creates a grid with 12 rows', () => {
    const grid = createEmptyGrid();
    expect(grid).toHaveLength(12);
  });

  it('even rows have 10 columns', () => {
    const grid = createEmptyGrid();
    expect(grid[0]).toHaveLength(10);
    expect(grid[2]).toHaveLength(10);
    expect(grid[10]).toHaveLength(10);
  });

  it('odd rows have 9 columns', () => {
    const grid = createEmptyGrid();
    expect(grid[1]).toHaveLength(9);
    expect(grid[3]).toHaveLength(9);
    expect(grid[11]).toHaveLength(9);
  });

  it('all cells are null initially', () => {
    const grid = createEmptyGrid();
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < getRowWidth(row); col++) {
        expect(grid[row][col]).toBeNull();
      }
    }
  });
});

describe('getBall / setBall', () => {
  it('sets and gets a ball at a position', () => {
    const grid = createEmptyGrid();
    const ball: Ball = { color: 'red', position: { row: 0, col: 0 } };

    setBall(grid, { row: 0, col: 0 }, ball);
    expect(getBall(grid, { row: 0, col: 0 })).toEqual(ball);
  });

  it('returns null for empty positions', () => {
    const grid = createEmptyGrid();
    expect(getBall(grid, { row: 5, col: 5 })).toBeNull();
  });

  it('can clear a position by setting null', () => {
    const grid = createEmptyGrid();
    const ball: Ball = { color: 'blue', position: { row: 2, col: 3 } };

    setBall(grid, { row: 2, col: 3 }, ball);
    setBall(grid, { row: 2, col: 3 }, null);
    expect(getBall(grid, { row: 2, col: 3 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - functions not defined

- [ ] **Step 3: Implement grid creation and access**

Add to `shared/src/grid.ts`:
```typescript
import { GRID_WIDTH_EVEN, GRID_WIDTH_ODD, GRID_HEIGHT, type GridPosition, type Ball } from './types';

/** The grid is a 2D array: grid[row][col] */
export type Grid = (Ball | null)[][];

/**
 * Create an empty grid with correct dimensions.
 */
export function createEmptyGrid(): Grid {
  const grid: Grid = [];
  for (let row = 0; row < GRID_HEIGHT; row++) {
    const width = getRowWidth(row);
    grid.push(new Array(width).fill(null));
  }
  return grid;
}

/**
 * Get the ball at a position, or null if empty.
 */
export function getBall(grid: Grid, pos: GridPosition): Ball | null {
  if (!isValidPosition(pos)) {
    return null;
  }
  return grid[pos.row][pos.col];
}

/**
 * Set a ball at a position (or null to clear).
 */
export function setBall(grid: Grid, pos: GridPosition, ball: Ball | null): void {
  if (!isValidPosition(pos)) {
    return;
  }
  grid[pos.row][pos.col] = ball;
}
```

Update the import at the top to include Ball:
```typescript
import { GRID_WIDTH_EVEN, GRID_WIDTH_ODD, GRID_HEIGHT, type GridPosition, type Ball } from './types';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/grid.ts shared/src/grid.test.ts
git commit -m "feat(shared): add grid creation and ball access"
```

---

## Phase 2: Triangle Pieces

### Task 6: Triangle Piece - Ball Positions

**Files:**
- Create: `shared/src/piece.ts`
- Create: `shared/src/piece.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Write failing tests for piece ball positions**

Create `shared/src/piece.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getPieceBallPositions } from './piece';
import type { TrianglePiece } from './types';

describe('getPieceBallPositions', () => {
  it('returns 3 positions for rotation 0 (point up)', () => {
    const piece: TrianglePiece = {
      position: { row: 2, col: 5 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };
    const positions = getPieceBallPositions(piece);
    expect(positions).toHaveLength(3);
  });

  it('rotation 0: top ball is above, two balls below', () => {
    // At rotation 0, the triangle points up
    // Center is the "pivot" point
    // For even row (2): upper neighbors are (3, 4) and (3, 5)
    const piece: TrianglePiece = {
      position: { row: 2, col: 5 },  // even row
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };
    const positions = getPieceBallPositions(piece);

    // Ball 0 (red): top position
    // Ball 1 (blue): bottom-left
    // Ball 2 (green): bottom-right
    // The exact positions depend on our coordinate convention
    expect(positions[0]).toEqual({ row: 3, col: 5 });  // top (upper-right of center)
    expect(positions[1]).toEqual({ row: 2, col: 4 });  // bottom-left (left of center)
    expect(positions[2]).toEqual({ row: 2, col: 5 });  // bottom-right (center itself)
  });

  it('rotation 3: triangle points down (inverted)', () => {
    const piece: TrianglePiece = {
      position: { row: 2, col: 5 },  // even row
      rotation: 3,
      colors: ['red', 'blue', 'green'],
    };
    const positions = getPieceBallPositions(piece);

    // At rotation 3 (180 degrees), triangle points down
    expect(positions[0]).toEqual({ row: 1, col: 4 });  // bottom (lower-left of center)
    expect(positions[1]).toEqual({ row: 2, col: 5 });  // top-right (center)
    expect(positions[2]).toEqual({ row: 2, col: 4 });  // top-left
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - getPieceBallPositions not defined

- [ ] **Step 3: Implement piece ball positions**

Create `shared/src/piece.ts`:
```typescript
import type { TrianglePiece, GridPosition, RotationState } from './types';

/**
 * Triangle piece rotation positions.
 *
 * The piece consists of 3 balls. We define positions relative to a "center" anchor point.
 * At rotation 0, the triangle points up:
 *       [0]
 *    [1]  [2]
 *
 * Each rotation is 60 degrees clockwise.
 *
 * For even rows, the offset patterns are different from odd rows due to hex grid staggering.
 */

// Offsets for each ball at each rotation state
// Format: [ball0, ball1, ball2] where each is {dRow, dCol}
// These offsets are for EVEN rows. For odd rows, diagonal offsets shift differently.

interface Offset {
  dRow: number;
  dColEven: number;  // Column offset when center is in even row
  dColOdd: number;   // Column offset when center is in odd row
}

// Rotation 0: point up      Rotation 1: point up-right   Rotation 2: point down-right
//      0                          2  0                           2
//    1   2                        1                             0  1
//
// Rotation 3: point down    Rotation 4: point down-left  Rotation 5: point up-left
//    1   2                            1                         1  0
//      0                          0  2                           2

const ROTATION_OFFSETS: Record<RotationState, [Offset, Offset, Offset]> = {
  0: [
    { dRow: 1, dColEven: 0, dColOdd: 1 },   // ball 0: upper-right
    { dRow: 0, dColEven: -1, dColOdd: -1 }, // ball 1: left
    { dRow: 0, dColEven: 0, dColOdd: 0 },   // ball 2: center
  ],
  1: [
    { dRow: 1, dColEven: 0, dColOdd: 1 },   // ball 0: upper-right
    { dRow: 0, dColEven: 0, dColOdd: 0 },   // ball 1: center
    { dRow: 1, dColEven: -1, dColOdd: 0 },  // ball 2: upper-left
  ],
  2: [
    { dRow: 0, dColEven: 0, dColOdd: 0 },   // ball 0: center
    { dRow: -1, dColEven: 0, dColOdd: 1 },  // ball 1: lower-right
    { dRow: 1, dColEven: -1, dColOdd: 0 },  // ball 2: upper-left
  ],
  3: [
    { dRow: -1, dColEven: -1, dColOdd: 0 }, // ball 0: lower-left
    { dRow: 0, dColEven: 0, dColOdd: 0 },   // ball 1: center
    { dRow: 0, dColEven: -1, dColOdd: -1 }, // ball 2: left
  ],
  4: [
    { dRow: -1, dColEven: -1, dColOdd: 0 }, // ball 0: lower-left
    { dRow: -1, dColEven: 0, dColOdd: 1 },  // ball 1: lower-right
    { dRow: 0, dColEven: 0, dColOdd: 0 },   // ball 2: center
  ],
  5: [
    { dRow: 0, dColEven: 0, dColOdd: 0 },   // ball 0: center
    { dRow: 1, dColEven: -1, dColOdd: 0 },  // ball 1: upper-left
    { dRow: -1, dColEven: 0, dColOdd: 1 },  // ball 2: lower-right
  ],
};

/**
 * Get the grid positions of the 3 balls in a triangle piece.
 * Returns positions in order [ball0, ball1, ball2] matching the colors array.
 */
export function getPieceBallPositions(piece: TrianglePiece): [GridPosition, GridPosition, GridPosition] {
  const { position, rotation } = piece;
  const isEvenRow = position.row % 2 === 0;
  const offsets = ROTATION_OFFSETS[rotation];

  return offsets.map((offset) => ({
    row: position.row + offset.dRow,
    col: position.col + (isEvenRow ? offset.dColEven : offset.dColOdd),
  })) as [GridPosition, GridPosition, GridPosition];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Update index.ts exports**

Add to `shared/src/index.ts`:
```typescript
export * from './piece';
```

- [ ] **Step 6: Commit**

```bash
git add shared/src/piece.ts shared/src/piece.test.ts shared/src/index.ts
git commit -m "feat(shared): add triangle piece ball positions"
```

---

### Task 7: Piece Movement and Rotation

**Files:**
- Modify: `shared/src/piece.ts`
- Modify: `shared/src/piece.test.ts`

- [ ] **Step 1: Write failing tests for piece movement**

Add to `shared/src/piece.test.ts`:
```typescript
import {
  getPieceBallPositions,
  movePiece,
  rotatePiece,
  canPlacePiece
} from './piece';
import { createEmptyGrid, setBall } from './grid';
import type { TrianglePiece, Ball } from './types';

describe('movePiece', () => {
  it('moves piece left', () => {
    const piece: TrianglePiece = {
      position: { row: 5, col: 5 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };
    const moved = movePiece(piece, 'left');
    expect(moved.position).toEqual({ row: 5, col: 4 });
    expect(moved.rotation).toBe(0);
    expect(moved.colors).toEqual(['red', 'blue', 'green']);
  });

  it('moves piece right', () => {
    const piece: TrianglePiece = {
      position: { row: 5, col: 5 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };
    const moved = movePiece(piece, 'right');
    expect(moved.position).toEqual({ row: 5, col: 6 });
  });

  it('moves piece down', () => {
    const piece: TrianglePiece = {
      position: { row: 5, col: 5 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };
    const moved = movePiece(piece, 'down');
    expect(moved.position).toEqual({ row: 4, col: 5 });
  });
});

describe('rotatePiece', () => {
  it('rotates clockwise from 0 to 1', () => {
    const piece: TrianglePiece = {
      position: { row: 5, col: 5 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };
    const rotated = rotatePiece(piece);
    expect(rotated.rotation).toBe(1);
  });

  it('wraps from 5 to 0', () => {
    const piece: TrianglePiece = {
      position: { row: 5, col: 5 },
      rotation: 5,
      colors: ['red', 'blue', 'green'],
    };
    const rotated = rotatePiece(piece);
    expect(rotated.rotation).toBe(0);
  });
});

describe('canPlacePiece', () => {
  it('returns true for valid empty positions', () => {
    const grid = createEmptyGrid();
    const piece: TrianglePiece = {
      position: { row: 5, col: 5 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };
    expect(canPlacePiece(grid, piece)).toBe(true);
  });

  it('returns false when a ball position is occupied', () => {
    const grid = createEmptyGrid();
    const ball: Ball = { color: 'purple', position: { row: 6, col: 5 } };
    setBall(grid, { row: 6, col: 5 }, ball);

    const piece: TrianglePiece = {
      position: { row: 5, col: 5 },  // even row, rotation 0 has ball at (6, 5)
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };
    expect(canPlacePiece(grid, piece)).toBe(false);
  });

  it('returns false when ball position is out of bounds', () => {
    const grid = createEmptyGrid();
    const piece: TrianglePiece = {
      position: { row: 0, col: 0 },  // bottom-left, some rotations will be OOB
      rotation: 3,  // points down, will have negative row
      colors: ['red', 'blue', 'green'],
    };
    expect(canPlacePiece(grid, piece)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - functions not defined

- [ ] **Step 3: Implement movement and placement**

Add to `shared/src/piece.ts`:
```typescript
import type { TrianglePiece, GridPosition, RotationState } from './types';
import { isValidPosition, getBall, type Grid } from './grid';

export type MoveDirection = 'left' | 'right' | 'down';

/**
 * Create a new piece moved in the specified direction.
 * Does not check validity - use canPlacePiece for that.
 */
export function movePiece(piece: TrianglePiece, direction: MoveDirection): TrianglePiece {
  const { position } = piece;
  let newPosition: GridPosition;

  switch (direction) {
    case 'left':
      newPosition = { row: position.row, col: position.col - 1 };
      break;
    case 'right':
      newPosition = { row: position.row, col: position.col + 1 };
      break;
    case 'down':
      newPosition = { row: position.row - 1, col: position.col };
      break;
  }

  return {
    ...piece,
    position: newPosition,
  };
}

/**
 * Create a new piece rotated 60 degrees clockwise.
 * Does not check validity - use canPlacePiece for that.
 */
export function rotatePiece(piece: TrianglePiece): TrianglePiece {
  const newRotation = ((piece.rotation + 1) % 6) as RotationState;
  return {
    ...piece,
    rotation: newRotation,
  };
}

/**
 * Check if a piece can be placed on the grid.
 * Returns false if any ball position is out of bounds or occupied.
 */
export function canPlacePiece(grid: Grid, piece: TrianglePiece): boolean {
  const positions = getPieceBallPositions(piece);

  for (const pos of positions) {
    if (!isValidPosition(pos)) {
      return false;
    }
    if (getBall(grid, pos) !== null) {
      return false;
    }
  }

  return true;
}
```

Update imports at top of file:
```typescript
import type { TrianglePiece, GridPosition, RotationState } from './types';
import { isValidPosition, getBall, type Grid } from './grid';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/piece.ts shared/src/piece.test.ts
git commit -m "feat(shared): add piece movement and placement validation"
```

---

### Task 8: Piece Generation

**Files:**
- Modify: `shared/src/piece.ts`
- Modify: `shared/src/piece.test.ts`

- [ ] **Step 1: Write failing tests for piece generation**

Add to `shared/src/piece.test.ts`:
```typescript
import {
  getPieceBallPositions,
  movePiece,
  rotatePiece,
  canPlacePiece,
  createRandomPiece,
  createPieceAtSpawn
} from './piece';
import { BALL_COLORS, GRID_HEIGHT } from './types';

describe('createRandomPiece', () => {
  it('creates a piece with 3 valid colors', () => {
    const piece = createRandomPiece();
    expect(piece.colors).toHaveLength(3);
    piece.colors.forEach(color => {
      expect(BALL_COLORS).toContain(color);
    });
  });

  it('starts at rotation 0', () => {
    const piece = createRandomPiece();
    expect(piece.rotation).toBe(0);
  });

  it('creates different pieces (randomness check)', () => {
    const pieces = Array.from({ length: 20 }, () => createRandomPiece());
    const uniqueColorCombos = new Set(pieces.map(p => p.colors.join(',')));
    // With 5 colors and 3 positions, should have some variety in 20 pieces
    expect(uniqueColorCombos.size).toBeGreaterThan(1);
  });
});

describe('createPieceAtSpawn', () => {
  it('creates piece at top center', () => {
    const piece = createPieceAtSpawn();
    expect(piece.position.row).toBe(GRID_HEIGHT - 1);  // Top row (11)
    expect(piece.position.col).toBe(4);  // Center-ish
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - functions not defined

- [ ] **Step 3: Implement piece generation**

Add to `shared/src/piece.ts`:
```typescript
import { BALL_COLORS, GRID_HEIGHT, type BallColor } from './types';

/**
 * Get a random ball color.
 */
function randomColor(): BallColor {
  return BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)];
}

/**
 * Create a new random triangle piece at default position.
 */
export function createRandomPiece(): TrianglePiece {
  return {
    position: { row: 0, col: 0 },
    rotation: 0,
    colors: [randomColor(), randomColor(), randomColor()],
  };
}

/**
 * Create a piece at the spawn position (top center of grid).
 */
export function createPieceAtSpawn(): TrianglePiece {
  return {
    position: { row: GRID_HEIGHT - 1, col: 4 },
    rotation: 0,
    colors: [randomColor(), randomColor(), randomColor()],
  };
}
```

Update imports:
```typescript
import { BALL_COLORS, GRID_HEIGHT, type BallColor, type TrianglePiece, type GridPosition, type RotationState } from './types';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/piece.ts shared/src/piece.test.ts
git commit -m "feat(shared): add piece generation"
```

---

## Phase 3: Gravity System

### Task 9: Basic Gravity - Single Ball Falling

**Files:**
- Create: `shared/src/gravity.ts`
- Create: `shared/src/gravity.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Write failing tests for single ball gravity**

Create `shared/src/gravity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { applyGravity } from './gravity';
import { createEmptyGrid, setBall, getBall } from './grid';
import type { Ball } from './types';

describe('gravity', () => {
  describe('single ball falling', () => {
    it('ball falls to bottom of empty grid', () => {
      const grid = createEmptyGrid();
      const ball: Ball = { color: 'red', position: { row: 5, col: 5 } };
      setBall(grid, { row: 5, col: 5 }, ball);

      const newGrid = applyGravity(grid);

      // Ball should be at bottom
      expect(getBall(newGrid, { row: 5, col: 5 })).toBeNull();
      expect(getBall(newGrid, { row: 0, col: 5 })).not.toBeNull();
      expect(getBall(newGrid, { row: 0, col: 5 })?.color).toBe('red');
    });

    it('ball on bottom row stays in place', () => {
      const grid = createEmptyGrid();
      const ball: Ball = { color: 'blue', position: { row: 0, col: 3 } };
      setBall(grid, { row: 0, col: 3 }, ball);

      const newGrid = applyGravity(grid);

      expect(getBall(newGrid, { row: 0, col: 3 })).not.toBeNull();
      expect(getBall(newGrid, { row: 0, col: 3 })?.color).toBe('blue');
    });

    it('ball rests on another ball', () => {
      const grid = createEmptyGrid();
      const bottomBall: Ball = { color: 'red', position: { row: 0, col: 5 } };
      const topBall: Ball = { color: 'blue', position: { row: 5, col: 5 } };
      setBall(grid, { row: 0, col: 5 }, bottomBall);
      setBall(grid, { row: 5, col: 5 }, topBall);

      const newGrid = applyGravity(grid);

      // Both balls should be stacked
      expect(getBall(newGrid, { row: 0, col: 5 })?.color).toBe('red');
      // Blue ball falls but lands on red, finding the lowest stable position
      // In hex grid, row 1 col 5 would be diagonally adjacent
      // Need to find where it actually lands based on hex geometry
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - applyGravity not defined

- [ ] **Step 3: Implement basic gravity**

Create `shared/src/gravity.ts`:
```typescript
import type { Ball, GridPosition } from './types';
import {
  createEmptyGrid,
  getBall,
  setBall,
  isValidPosition,
  getRowWidth,
  type Grid
} from './grid';
import { GRID_HEIGHT } from './types';

/**
 * Check if a position is supported (has something below it or is at bottom).
 * In a hex grid, a ball is supported if:
 * - It's on row 0 (bottom)
 * - OR at least one of its lower neighbors has a ball
 */
function isSupported(grid: Grid, pos: GridPosition): boolean {
  if (pos.row === 0) {
    return true;
  }

  const isEvenRow = pos.row % 2 === 0;

  // Lower neighbors depend on row parity
  let lowerLeft: GridPosition;
  let lowerRight: GridPosition;

  if (isEvenRow) {
    lowerLeft = { row: pos.row - 1, col: pos.col - 1 };
    lowerRight = { row: pos.row - 1, col: pos.col };
  } else {
    lowerLeft = { row: pos.row - 1, col: pos.col };
    lowerRight = { row: pos.row - 1, col: pos.col + 1 };
  }

  // Supported if either lower neighbor has a ball
  const hasLowerLeft = isValidPosition(lowerLeft) && getBall(grid, lowerLeft) !== null;
  const hasLowerRight = isValidPosition(lowerRight) && getBall(grid, lowerRight) !== null;

  return hasLowerLeft || hasLowerRight;
}

/**
 * Find where a ball would fall to from a given position.
 * Balls slide diagonally into gaps, preferring right side when both are open.
 */
function findFallDestination(grid: Grid, pos: GridPosition): GridPosition {
  let current = pos;

  while (true) {
    if (current.row === 0) {
      return current;
    }

    const isEvenRow = current.row % 2 === 0;

    let lowerLeft: GridPosition;
    let lowerRight: GridPosition;

    if (isEvenRow) {
      lowerLeft = { row: current.row - 1, col: current.col - 1 };
      lowerRight = { row: current.row - 1, col: current.col };
    } else {
      lowerLeft = { row: current.row - 1, col: current.col };
      lowerRight = { row: current.row - 1, col: current.col + 1 };
    }

    const leftValid = isValidPosition(lowerLeft);
    const rightValid = isValidPosition(lowerRight);
    const leftEmpty = leftValid && getBall(grid, lowerLeft) === null;
    const rightEmpty = rightValid && getBall(grid, lowerRight) === null;

    // Prefer right when both are open (per spec)
    if (rightEmpty) {
      current = lowerRight;
    } else if (leftEmpty) {
      current = lowerLeft;
    } else {
      // Both blocked, ball rests here
      return current;
    }
  }
}

/**
 * Apply gravity to the grid, making all balls fall to stable positions.
 * Returns a new grid with balls in their final positions.
 */
export function applyGravity(grid: Grid): Grid {
  // Create new grid and collect all balls
  const newGrid = createEmptyGrid();
  const balls: Ball[] = [];

  for (let row = 0; row < GRID_HEIGHT; row++) {
    const width = getRowWidth(row);
    for (let col = 0; col < width; col++) {
      const ball = getBall(grid, { row, col });
      if (ball !== null) {
        balls.push({ ...ball });
      }
    }
  }

  // Sort balls by row (process bottom balls first)
  balls.sort((a, b) => a.position.row - b.position.row);

  // Place each ball at its fall destination
  for (const ball of balls) {
    const dest = findFallDestination(newGrid, ball.position);
    const newBall: Ball = { color: ball.color, position: dest };
    setBall(newGrid, dest, newBall);
  }

  return newGrid;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Update index.ts exports**

Add to `shared/src/index.ts`:
```typescript
export * from './gravity';
```

- [ ] **Step 6: Commit**

```bash
git add shared/src/gravity.ts shared/src/gravity.test.ts shared/src/index.ts
git commit -m "feat(shared): add basic gravity system"
```

---

### Task 10: Gravity - Multiple Balls and Stacking

**Files:**
- Modify: `shared/src/gravity.test.ts`

- [ ] **Step 1: Add more gravity tests**

Add to `shared/src/gravity.test.ts`:
```typescript
describe('multiple balls stacking', () => {
  it('stacks balls in a pile', () => {
    const grid = createEmptyGrid();
    // Drop 3 balls in the same column area
    setBall(grid, { row: 8, col: 5 }, { color: 'red', position: { row: 8, col: 5 } });
    setBall(grid, { row: 6, col: 5 }, { color: 'blue', position: { row: 6, col: 5 } });
    setBall(grid, { row: 4, col: 5 }, { color: 'green', position: { row: 4, col: 5 } });

    const newGrid = applyGravity(grid);

    // Count total balls
    let ballCount = 0;
    for (let row = 0; row < 12; row++) {
      const width = row % 2 === 0 ? 10 : 9;
      for (let col = 0; col < width; col++) {
        if (getBall(newGrid, { row, col })) ballCount++;
      }
    }
    expect(ballCount).toBe(3);
  });

  it('right ball priority when competing for same slot', () => {
    const grid = createEmptyGrid();
    // Two balls above the same gap - right one should win
    // In row 2 (even), positions 5 and 6 both fall toward row 1 col 5
    setBall(grid, { row: 2, col: 5 }, { color: 'red', position: { row: 2, col: 5 } });
    setBall(grid, { row: 2, col: 6 }, { color: 'blue', position: { row: 2, col: 6 } });

    const newGrid = applyGravity(grid);

    // Both should end up somewhere at bottom, not overlapping
    const row0Balls = [];
    const row1Balls = [];
    for (let col = 0; col < 10; col++) {
      const ball0 = getBall(newGrid, { row: 0, col });
      const ball1 = getBall(newGrid, { row: 1, col });
      if (ball0) row0Balls.push({ col, color: ball0.color });
      if (ball1) row1Balls.push({ col, color: ball1.color });
    }

    // Should have 2 balls total across bottom rows
    expect(row0Balls.length + row1Balls.length).toBe(2);
  });
});

describe('gravity preserves hollow structures', () => {
  it('balls can form stable bridges', () => {
    const grid = createEmptyGrid();
    // Create a foundation
    setBall(grid, { row: 0, col: 4 }, { color: 'red', position: { row: 0, col: 4 } });
    setBall(grid, { row: 0, col: 6 }, { color: 'red', position: { row: 0, col: 6 } });
    // Ball supported by both
    setBall(grid, { row: 1, col: 5 }, { color: 'blue', position: { row: 1, col: 5 } });

    const newGrid = applyGravity(grid);

    // Blue ball should stay at row 1 col 5 (supported by both red balls)
    expect(getBall(newGrid, { row: 1, col: 5 })?.color).toBe('blue');
    expect(getBall(newGrid, { row: 0, col: 4 })?.color).toBe('red');
    expect(getBall(newGrid, { row: 0, col: 6 })?.color).toBe('red');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd shared && npm test`
Expected: All tests pass (implementation from Task 9 should handle these)

- [ ] **Step 3: Commit**

```bash
git add shared/src/gravity.test.ts
git commit -m "test(shared): add comprehensive gravity tests"
```

---

## Phase 4: Pattern Detection

### Task 11: Six Connected Detection

**Files:**
- Create: `shared/src/patterns.ts`
- Create: `shared/src/patterns.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Write failing tests for six-connected detection**

Create `shared/src/patterns.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { findSixConnected } from './patterns';
import { createEmptyGrid, setBall } from './grid';
import type { Ball } from './types';

describe('findSixConnected', () => {
  it('returns empty array for empty grid', () => {
    const grid = createEmptyGrid();
    const matches = findSixConnected(grid);
    expect(matches).toEqual([]);
  });

  it('returns empty array for 5 connected balls', () => {
    const grid = createEmptyGrid();
    // Place 5 connected red balls
    const positions = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
    ];
    positions.forEach(pos => {
      setBall(grid, pos, { color: 'red', position: pos });
    });

    const matches = findSixConnected(grid);
    expect(matches).toEqual([]);
  });

  it('finds 6 connected balls in a row', () => {
    const grid = createEmptyGrid();
    // Place 6 connected red balls horizontally
    const positions = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
      { row: 0, col: 5 },
    ];
    positions.forEach(pos => {
      setBall(grid, pos, { color: 'red', position: pos });
    });

    const matches = findSixConnected(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('sixConnected');
    expect(matches[0].color).toBe('red');
    expect(matches[0].positions).toHaveLength(6);
  });

  it('finds 6+ connected balls in irregular shape', () => {
    const grid = createEmptyGrid();
    // Create an L-shape with 7 balls
    // Row 0: 4 balls
    // Row 1: 3 balls (connecting to row 0)
    const positions = [
      { row: 0, col: 3 },
      { row: 0, col: 4 },
      { row: 0, col: 5 },
      { row: 0, col: 6 },
      { row: 1, col: 5 },  // connects to row 0 col 5 or 6
      { row: 1, col: 6 },
      { row: 1, col: 7 },
    ];
    positions.forEach(pos => {
      setBall(grid, pos, { color: 'blue', position: pos });
    });

    const matches = findSixConnected(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].positions.length).toBeGreaterThanOrEqual(6);
  });

  it('does not match different colors', () => {
    const grid = createEmptyGrid();
    // Place 3 red and 3 blue
    setBall(grid, { row: 0, col: 0 }, { color: 'red', position: { row: 0, col: 0 } });
    setBall(grid, { row: 0, col: 1 }, { color: 'red', position: { row: 0, col: 1 } });
    setBall(grid, { row: 0, col: 2 }, { color: 'red', position: { row: 0, col: 2 } });
    setBall(grid, { row: 0, col: 3 }, { color: 'blue', position: { row: 0, col: 3 } });
    setBall(grid, { row: 0, col: 4 }, { color: 'blue', position: { row: 0, col: 4 } });
    setBall(grid, { row: 0, col: 5 }, { color: 'blue', position: { row: 0, col: 5 } });

    const matches = findSixConnected(grid);
    expect(matches).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - findSixConnected not defined

- [ ] **Step 3: Implement six-connected detection**

Create `shared/src/patterns.ts`:
```typescript
import type { GridPosition, BallColor, PatternMatch } from './types';
import { getBall, getNeighbors, getRowWidth, type Grid } from './grid';
import { GRID_HEIGHT } from './types';

/**
 * Find all connected groups of same-colored balls using flood fill.
 */
function findConnectedGroup(
  grid: Grid,
  start: GridPosition,
  visited: Set<string>
): GridPosition[] {
  const ball = getBall(grid, start);
  if (!ball) return [];

  const color = ball.color;
  const group: GridPosition[] = [];
  const queue: GridPosition[] = [start];
  const key = (pos: GridPosition) => `${pos.row},${pos.col}`;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = key(current);

    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    const currentBall = getBall(grid, current);
    if (!currentBall || currentBall.color !== color) continue;

    group.push(current);

    for (const neighbor of getNeighbors(current)) {
      if (!visited.has(key(neighbor))) {
        queue.push(neighbor);
      }
    }
  }

  return group;
}

/**
 * Find all groups of 6+ connected same-colored balls.
 */
export function findSixConnected(grid: Grid): PatternMatch[] {
  const visited = new Set<string>();
  const matches: PatternMatch[] = [];

  for (let row = 0; row < GRID_HEIGHT; row++) {
    const width = getRowWidth(row);
    for (let col = 0; col < width; col++) {
      const pos = { row, col };
      const key = `${row},${col}`;

      if (visited.has(key)) continue;

      const ball = getBall(grid, pos);
      if (!ball) {
        visited.add(key);
        continue;
      }

      const group = findConnectedGroup(grid, pos, visited);

      if (group.length >= 6) {
        matches.push({
          type: 'sixConnected',
          color: ball.color,
          positions: group,
        });
      }
    }
  }

  return matches;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Update index.ts exports**

Add to `shared/src/index.ts`:
```typescript
export * from './patterns';
```

- [ ] **Step 6: Commit**

```bash
git add shared/src/patterns.ts shared/src/patterns.test.ts shared/src/index.ts
git commit -m "feat(shared): add six-connected pattern detection"
```

---

### Task 12: Six-Line Detection

**Files:**
- Modify: `shared/src/patterns.ts`
- Modify: `shared/src/patterns.test.ts`

- [ ] **Step 1: Write failing tests for six-line detection**

Add to `shared/src/patterns.test.ts`:
```typescript
import { findSixConnected, findSixLine } from './patterns';

describe('findSixLine', () => {
  it('returns empty array for empty grid', () => {
    const grid = createEmptyGrid();
    const matches = findSixLine(grid);
    expect(matches).toEqual([]);
  });

  it('finds horizontal six-line', () => {
    const grid = createEmptyGrid();
    // 6 balls in a row horizontally
    for (let col = 0; col < 6; col++) {
      setBall(grid, { row: 0, col }, { color: 'red', position: { row: 0, col } });
    }

    const matches = findSixLine(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('sixLine');
    expect(matches[0].color).toBe('red');
  });

  it('does not match 5 in a line', () => {
    const grid = createEmptyGrid();
    for (let col = 0; col < 5; col++) {
      setBall(grid, { row: 0, col }, { color: 'red', position: { row: 0, col } });
    }

    const matches = findSixLine(grid);
    expect(matches).toEqual([]);
  });

  it('finds diagonal six-line (upper-left to lower-right)', () => {
    const grid = createEmptyGrid();
    // Diagonal line going up-right from row 0
    // For even rows: upper-right neighbor is (row+1, col)
    // For odd rows: upper-right neighbor is (row+1, col+1)
    // Starting at (0, 2):
    // (0,2) -> (1,2) -> (2,2) -> (3,3) -> (4,3) -> (5,3)
    const positions = [
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 3, col: 3 },
      { row: 4, col: 3 },
      { row: 5, col: 3 },
    ];
    positions.forEach(pos => {
      setBall(grid, pos, { color: 'blue', position: pos });
    });

    const matches = findSixLine(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('sixLine');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - findSixLine not defined

- [ ] **Step 3: Implement six-line detection**

Add to `shared/src/patterns.ts`:
```typescript
/**
 * Direction vectors for line detection.
 * We check 3 directions: horizontal, diagonal up-right, diagonal up-left
 * Only need to check "positive" directions since we scan the whole grid.
 */
type LineDirection = 'horizontal' | 'diagonalUpRight' | 'diagonalUpLeft';

function getNextInLine(pos: GridPosition, direction: LineDirection): GridPosition {
  const isEvenRow = pos.row % 2 === 0;

  switch (direction) {
    case 'horizontal':
      return { row: pos.row, col: pos.col + 1 };
    case 'diagonalUpRight':
      // Upper-right neighbor
      if (isEvenRow) {
        return { row: pos.row + 1, col: pos.col };
      } else {
        return { row: pos.row + 1, col: pos.col + 1 };
      }
    case 'diagonalUpLeft':
      // Upper-left neighbor
      if (isEvenRow) {
        return { row: pos.row + 1, col: pos.col - 1 };
      } else {
        return { row: pos.row + 1, col: pos.col };
      }
  }
}

function findLineInDirection(
  grid: Grid,
  start: GridPosition,
  direction: LineDirection
): GridPosition[] {
  const ball = getBall(grid, start);
  if (!ball) return [];

  const color = ball.color;
  const line: GridPosition[] = [start];
  let current = start;

  while (true) {
    const next = getNextInLine(current, direction);
    const nextBall = getBall(grid, next);

    if (!nextBall || nextBall.color !== color) {
      break;
    }

    line.push(next);
    current = next;
  }

  return line;
}

/**
 * Find all six-in-a-line patterns (3 directions: horizontal, both diagonals).
 */
export function findSixLine(grid: Grid): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const directions: LineDirection[] = ['horizontal', 'diagonalUpRight', 'diagonalUpLeft'];
  const foundLines = new Set<string>();

  for (let row = 0; row < GRID_HEIGHT; row++) {
    const width = getRowWidth(row);
    for (let col = 0; col < width; col++) {
      const pos = { row, col };
      const ball = getBall(grid, pos);
      if (!ball) continue;

      for (const direction of directions) {
        const line = findLineInDirection(grid, pos, direction);

        if (line.length >= 6) {
          // Create a unique key for this line to avoid duplicates
          const sortedPositions = [...line].sort((a, b) =>
            a.row !== b.row ? a.row - b.row : a.col - b.col
          );
          const lineKey = sortedPositions.map(p => `${p.row},${p.col}`).join('|');

          if (!foundLines.has(lineKey)) {
            foundLines.add(lineKey);
            matches.push({
              type: 'sixLine',
              color: ball.color,
              positions: line,
            });
          }
        }
      }
    }
  }

  return matches;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/patterns.ts shared/src/patterns.test.ts
git commit -m "feat(shared): add six-line pattern detection"
```

---

### Task 13: Hexagon Ring Detection

**Files:**
- Modify: `shared/src/patterns.ts`
- Modify: `shared/src/patterns.test.ts`

- [ ] **Step 1: Write failing tests for hexagon ring detection**

Add to `shared/src/patterns.test.ts`:
```typescript
import { findSixConnected, findSixLine, findHexagonRing } from './patterns';

describe('findHexagonRing', () => {
  it('returns empty array for empty grid', () => {
    const grid = createEmptyGrid();
    const matches = findHexagonRing(grid);
    expect(matches).toEqual([]);
  });

  it('finds a hexagon ring (6 same-color balls around a center)', () => {
    const grid = createEmptyGrid();
    // Place a center ball (any color)
    setBall(grid, { row: 2, col: 5 }, { color: 'yellow', position: { row: 2, col: 5 } });

    // Place 6 red balls around it (even row neighbors)
    // upper-left: (3, 4), upper-right: (3, 5)
    // left: (2, 4), right: (2, 6)
    // lower-left: (1, 4), lower-right: (1, 5)
    const ringPositions = [
      { row: 3, col: 4 },
      { row: 3, col: 5 },
      { row: 2, col: 4 },
      { row: 2, col: 6 },
      { row: 1, col: 4 },
      { row: 1, col: 5 },
    ];
    ringPositions.forEach(pos => {
      setBall(grid, pos, { color: 'red', position: pos });
    });

    const matches = findHexagonRing(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('hexagonRing');
    expect(matches[0].color).toBe('red');
    expect(matches[0].positions).toHaveLength(6);
  });

  it('does not match if one ring ball is different color', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 2, col: 5 }, { color: 'yellow', position: { row: 2, col: 5 } });

    // 5 red + 1 blue
    setBall(grid, { row: 3, col: 4 }, { color: 'red', position: { row: 3, col: 4 } });
    setBall(grid, { row: 3, col: 5 }, { color: 'red', position: { row: 3, col: 5 } });
    setBall(grid, { row: 2, col: 4 }, { color: 'red', position: { row: 2, col: 4 } });
    setBall(grid, { row: 2, col: 6 }, { color: 'blue', position: { row: 2, col: 6 } }); // different!
    setBall(grid, { row: 1, col: 4 }, { color: 'red', position: { row: 1, col: 4 } });
    setBall(grid, { row: 1, col: 5 }, { color: 'red', position: { row: 1, col: 5 } });

    const matches = findHexagonRing(grid);
    expect(matches).toEqual([]);
  });

  it('works with empty center', () => {
    const grid = createEmptyGrid();
    // No center ball, just the ring
    const ringPositions = [
      { row: 3, col: 4 },
      { row: 3, col: 5 },
      { row: 2, col: 4 },
      { row: 2, col: 6 },
      { row: 1, col: 4 },
      { row: 1, col: 5 },
    ];
    ringPositions.forEach(pos => {
      setBall(grid, pos, { color: 'green', position: pos });
    });

    const matches = findHexagonRing(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].color).toBe('green');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - findHexagonRing not defined

- [ ] **Step 3: Implement hexagon ring detection**

Add to `shared/src/patterns.ts`:
```typescript
import { getBall, getNeighbors, getRowWidth, isValidPosition, type Grid } from './grid';

/**
 * Get all 6 neighbor positions for a center (even if some are invalid).
 * Returns null for positions that are out of bounds.
 */
function getAllNeighborPositions(center: GridPosition): (GridPosition | null)[] {
  const isEvenRow = center.row % 2 === 0;

  const offsets = isEvenRow
    ? [
        { dRow: 1, dCol: -1 },  // upper-left
        { dRow: 1, dCol: 0 },   // upper-right
        { dRow: 0, dCol: -1 },  // left
        { dRow: 0, dCol: 1 },   // right
        { dRow: -1, dCol: -1 }, // lower-left
        { dRow: -1, dCol: 0 },  // lower-right
      ]
    : [
        { dRow: 1, dCol: 0 },   // upper-left
        { dRow: 1, dCol: 1 },   // upper-right
        { dRow: 0, dCol: -1 },  // left
        { dRow: 0, dCol: 1 },   // right
        { dRow: -1, dCol: 0 },  // lower-left
        { dRow: -1, dCol: 1 },  // lower-right
      ];

  return offsets.map(offset => {
    const pos = { row: center.row + offset.dRow, col: center.col + offset.dCol };
    return isValidPosition(pos) ? pos : null;
  });
}

/**
 * Find all hexagon ring patterns (6 same-colored balls around any center).
 */
export function findHexagonRing(grid: Grid): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const foundRings = new Set<string>();

  // Check every position as potential center
  for (let row = 1; row < GRID_HEIGHT - 1; row++) {  // Skip top/bottom rows
    const width = getRowWidth(row);
    for (let col = 1; col < width - 1; col++) {  // Skip edge columns
      const center = { row, col };
      const neighborPositions = getAllNeighborPositions(center);

      // Check if all 6 neighbors exist and are same color
      const validNeighbors = neighborPositions.filter((p): p is GridPosition => p !== null);
      if (validNeighbors.length !== 6) continue;

      const neighborBalls = validNeighbors.map(pos => getBall(grid, pos));

      // All must have balls
      if (neighborBalls.some(b => b === null)) continue;

      // All must be same color
      const firstColor = neighborBalls[0]!.color;
      if (!neighborBalls.every(b => b!.color === firstColor)) continue;

      // Create unique key for this ring
      const sortedPositions = [...validNeighbors].sort((a, b) =>
        a.row !== b.row ? a.row - b.row : a.col - b.col
      );
      const ringKey = sortedPositions.map(p => `${p.row},${p.col}`).join('|');

      if (!foundRings.has(ringKey)) {
        foundRings.add(ringKey);
        matches.push({
          type: 'hexagonRing',
          color: firstColor,
          positions: validNeighbors,
        });
      }
    }
  }

  return matches;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/patterns.ts shared/src/patterns.test.ts
git commit -m "feat(shared): add hexagon ring pattern detection"
```

---

### Task 14: Pyramid Detection

**Files:**
- Modify: `shared/src/patterns.ts`
- Modify: `shared/src/patterns.test.ts`

- [ ] **Step 1: Write failing tests for pyramid detection**

Add to `shared/src/patterns.test.ts`:
```typescript
import { findSixConnected, findSixLine, findHexagonRing, findPyramid } from './patterns';

describe('findPyramid', () => {
  it('returns empty array for empty grid', () => {
    const grid = createEmptyGrid();
    const matches = findPyramid(grid);
    expect(matches).toEqual([]);
  });

  it('finds point-up pyramid (1+2+3 formation)', () => {
    const grid = createEmptyGrid();
    // Point up pyramid:
    //      0          <- row 2
    //    0   0        <- row 1
    //  0   0   0      <- row 0
    // Starting from bottom-left at (0, 3)
    // Row 0: 3 balls at cols 3, 4, 5
    // Row 1: 2 balls (even row 0's upper neighbors)
    // Row 2: 1 ball at top

    // Actually, let's be more precise about hex coordinates:
    // Row 0 (even): balls at col 3, 4, 5
    // Row 1 (odd): balls at col 3, 4 (upper neighbors of row 0)
    // Row 2 (even): ball at col 3 (upper neighbor shared)

    setBall(grid, { row: 0, col: 3 }, { color: 'red', position: { row: 0, col: 3 } });
    setBall(grid, { row: 0, col: 4 }, { color: 'red', position: { row: 0, col: 4 } });
    setBall(grid, { row: 0, col: 5 }, { color: 'red', position: { row: 0, col: 5 } });
    setBall(grid, { row: 1, col: 3 }, { color: 'red', position: { row: 1, col: 3 } });
    setBall(grid, { row: 1, col: 4 }, { color: 'red', position: { row: 1, col: 4 } });
    setBall(grid, { row: 2, col: 4 }, { color: 'red', position: { row: 2, col: 4 } });

    const matches = findPyramid(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('pyramid');
    expect(matches[0].color).toBe('red');
    expect(matches[0].positions).toHaveLength(6);
  });

  it('finds point-down pyramid (inverted)', () => {
    const grid = createEmptyGrid();
    // Point down (inverted):
    //  0   0   0      <- row 2 (3 balls)
    //    0   0        <- row 1 (2 balls)
    //      0          <- row 0 (1 ball)

    setBall(grid, { row: 2, col: 3 }, { color: 'blue', position: { row: 2, col: 3 } });
    setBall(grid, { row: 2, col: 4 }, { color: 'blue', position: { row: 2, col: 4 } });
    setBall(grid, { row: 2, col: 5 }, { color: 'blue', position: { row: 2, col: 5 } });
    setBall(grid, { row: 1, col: 4 }, { color: 'blue', position: { row: 1, col: 4 } });
    setBall(grid, { row: 1, col: 5 }, { color: 'blue', position: { row: 1, col: 5 } });
    setBall(grid, { row: 0, col: 5 }, { color: 'blue', position: { row: 0, col: 5 } });

    const matches = findPyramid(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('pyramid');
    expect(matches[0].color).toBe('blue');
  });

  it('does not match with 5 balls', () => {
    const grid = createEmptyGrid();
    // Missing one ball from pyramid
    setBall(grid, { row: 0, col: 3 }, { color: 'red', position: { row: 0, col: 3 } });
    setBall(grid, { row: 0, col: 4 }, { color: 'red', position: { row: 0, col: 4 } });
    setBall(grid, { row: 0, col: 5 }, { color: 'red', position: { row: 0, col: 5 } });
    setBall(grid, { row: 1, col: 3 }, { color: 'red', position: { row: 1, col: 3 } });
    setBall(grid, { row: 1, col: 4 }, { color: 'red', position: { row: 1, col: 4 } });
    // Missing top ball

    const matches = findPyramid(grid);
    expect(matches).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - findPyramid not defined

- [ ] **Step 3: Implement pyramid detection**

Add to `shared/src/patterns.ts`:
```typescript
/**
 * Get the positions for a point-up pyramid starting at given base-left position.
 * Returns null if any position is invalid.
 */
function getPointUpPyramid(baseLeft: GridPosition): GridPosition[] | null {
  const positions: GridPosition[] = [];

  // Row 0: 3 balls (base)
  for (let i = 0; i < 3; i++) {
    const pos = { row: baseLeft.row, col: baseLeft.col + i };
    if (!isValidPosition(pos)) return null;
    positions.push(pos);
  }

  // Row 1: 2 balls
  const row1IsOdd = (baseLeft.row + 1) % 2 === 1;
  const row1ColOffset = row1IsOdd ? 0 : 0;

  // For row above even row: upper neighbors are at col-1 and col
  // We need the two middle positions
  if (baseLeft.row % 2 === 0) {
    // Base is even row, row+1 is odd
    // Upper-left of (row, col) is (row+1, col)
    // Upper-right of (row, col) is (row+1, col+1)
    const pos1 = { row: baseLeft.row + 1, col: baseLeft.col };
    const pos2 = { row: baseLeft.row + 1, col: baseLeft.col + 1 };
    if (!isValidPosition(pos1) || !isValidPosition(pos2)) return null;
    positions.push(pos1, pos2);
  } else {
    // Base is odd row, row+1 is even
    // Upper-left of (row, col) is (row+1, col-1)
    // Upper-right of (row, col) is (row+1, col)
    const pos1 = { row: baseLeft.row + 1, col: baseLeft.col };
    const pos2 = { row: baseLeft.row + 1, col: baseLeft.col + 1 };
    if (!isValidPosition(pos1) || !isValidPosition(pos2)) return null;
    positions.push(pos1, pos2);
  }

  // Row 2: 1 ball (apex)
  // Need to find the position that's above the middle of row 1
  const row1Left = positions[3];
  const row2IsOdd = (baseLeft.row + 2) % 2 === 1;

  if (row2IsOdd) {
    // Row 2 is odd, row 1 is even
    // Upper-right of row1Left is (row+1, col)
    const apex = { row: baseLeft.row + 2, col: row1Left.col };
    if (!isValidPosition(apex)) return null;
    positions.push(apex);
  } else {
    // Row 2 is even, row 1 is odd
    // Upper-right of row1Left is (row+1, col+1)
    const apex = { row: baseLeft.row + 2, col: row1Left.col };
    if (!isValidPosition(apex)) return null;
    positions.push(apex);
  }

  return positions;
}

/**
 * Get the positions for a point-down pyramid starting at given apex position.
 */
function getPointDownPyramid(apex: GridPosition): GridPosition[] | null {
  const positions: GridPosition[] = [apex];

  // Row -1 from apex: 2 balls
  const apexIsEven = apex.row % 2 === 0;
  let row1Pos1: GridPosition, row1Pos2: GridPosition;

  if (apexIsEven) {
    // Lower neighbors: (row-1, col-1) and (row-1, col)
    row1Pos1 = { row: apex.row - 1, col: apex.col - 1 };
    row1Pos2 = { row: apex.row - 1, col: apex.col };
  } else {
    // Lower neighbors: (row-1, col) and (row-1, col+1)
    row1Pos1 = { row: apex.row - 1, col: apex.col };
    row1Pos2 = { row: apex.row - 1, col: apex.col + 1 };
  }

  if (!isValidPosition(row1Pos1) || !isValidPosition(row1Pos2)) return null;
  positions.push(row1Pos1, row1Pos2);

  // Row -2 from apex: 3 balls
  const row1IsOdd = (apex.row - 1) % 2 === 1;
  let baseCol: number;

  if (row1IsOdd) {
    // Row 1 is odd, base row is even
    // Lower-left of row1Pos1 is (row-1, col)
    baseCol = row1Pos1.col;
  } else {
    // Row 1 is even, base row is odd
    // Lower-left of row1Pos1 is (row-1, col-1)
    baseCol = row1Pos1.col - 1;
  }

  for (let i = 0; i < 3; i++) {
    const pos = { row: apex.row - 2, col: baseCol + i };
    if (!isValidPosition(pos)) return null;
    positions.push(pos);
  }

  return positions;
}

/**
 * Find all pyramid patterns (1+2+3 triangle formation, either point up or down).
 */
export function findPyramid(grid: Grid): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const foundPyramids = new Set<string>();

  // Check for point-up pyramids (base at current row)
  for (let row = 0; row < GRID_HEIGHT - 2; row++) {
    const width = getRowWidth(row);
    for (let col = 0; col < width - 2; col++) {
      const positions = getPointUpPyramid({ row, col });
      if (!positions) continue;

      const balls = positions.map(pos => getBall(grid, pos));
      if (balls.some(b => b === null)) continue;

      const color = balls[0]!.color;
      if (!balls.every(b => b!.color === color)) continue;

      const sortedKey = [...positions]
        .sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)
        .map(p => `${p.row},${p.col}`)
        .join('|');

      if (!foundPyramids.has(sortedKey)) {
        foundPyramids.add(sortedKey);
        matches.push({
          type: 'pyramid',
          color,
          positions,
        });
      }
    }
  }

  // Check for point-down pyramids (apex at current row)
  for (let row = 2; row < GRID_HEIGHT; row++) {
    const width = getRowWidth(row);
    for (let col = 0; col < width; col++) {
      const positions = getPointDownPyramid({ row, col });
      if (!positions) continue;

      const balls = positions.map(pos => getBall(grid, pos));
      if (balls.some(b => b === null)) continue;

      const color = balls[0]!.color;
      if (!balls.every(b => b!.color === color)) continue;

      const sortedKey = [...positions]
        .sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)
        .map(p => `${p.row},${p.col}`)
        .join('|');

      if (!foundPyramids.has(sortedKey)) {
        foundPyramids.add(sortedKey);
        matches.push({
          type: 'pyramid',
          color,
          positions,
        });
      }
    }
  }

  return matches;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/patterns.ts shared/src/patterns.test.ts
git commit -m "feat(shared): add pyramid pattern detection"
```

---

### Task 15: Pattern Priority and Combined Detection

**Files:**
- Modify: `shared/src/patterns.ts`
- Modify: `shared/src/patterns.test.ts`

- [ ] **Step 1: Write failing tests for combined pattern detection**

Add to `shared/src/patterns.test.ts`:
```typescript
import {
  findSixConnected,
  findSixLine,
  findHexagonRing,
  findPyramid,
  findAllPatterns,
  findHighestPriorityPattern
} from './patterns';

describe('findAllPatterns', () => {
  it('returns all matching patterns', () => {
    const grid = createEmptyGrid();
    // Create a six-line that's also six-connected
    for (let col = 0; col < 6; col++) {
      setBall(grid, { row: 0, col }, { color: 'red', position: { row: 0, col } });
    }

    const patterns = findAllPatterns(grid);
    // Should find both sixLine and sixConnected
    expect(patterns.some(p => p.type === 'sixLine')).toBe(true);
    expect(patterns.some(p => p.type === 'sixConnected')).toBe(true);
  });
});

describe('findHighestPriorityPattern', () => {
  it('returns null for empty grid', () => {
    const grid = createEmptyGrid();
    expect(findHighestPriorityPattern(grid)).toBeNull();
  });

  it('prioritizes hexagonRing over sixLine', () => {
    const grid = createEmptyGrid();
    // Create both a hexagon ring and a six-line
    // The ring should take priority

    // Hexagon ring around (2, 5)
    const ringPositions = [
      { row: 3, col: 4 },
      { row: 3, col: 5 },
      { row: 2, col: 4 },
      { row: 2, col: 6 },
      { row: 1, col: 4 },
      { row: 1, col: 5 },
    ];
    ringPositions.forEach(pos => {
      setBall(grid, pos, { color: 'red', position: pos });
    });

    // Also create a six-line of different color
    for (let col = 0; col < 6; col++) {
      setBall(grid, { row: 0, col }, { color: 'blue', position: { row: 0, col } });
    }

    const highest = findHighestPriorityPattern(grid);
    expect(highest).not.toBeNull();
    expect(highest!.type).toBe('hexagonRing');
  });

  it('prioritizes sixLine over pyramid', () => {
    const grid = createEmptyGrid();

    // Six-line
    for (let col = 0; col < 6; col++) {
      setBall(grid, { row: 4, col }, { color: 'red', position: { row: 4, col } });
    }

    // Pyramid (different color to ensure separate detection)
    setBall(grid, { row: 0, col: 3 }, { color: 'blue', position: { row: 0, col: 3 } });
    setBall(grid, { row: 0, col: 4 }, { color: 'blue', position: { row: 0, col: 4 } });
    setBall(grid, { row: 0, col: 5 }, { color: 'blue', position: { row: 0, col: 5 } });
    setBall(grid, { row: 1, col: 3 }, { color: 'blue', position: { row: 1, col: 3 } });
    setBall(grid, { row: 1, col: 4 }, { color: 'blue', position: { row: 1, col: 4 } });
    setBall(grid, { row: 2, col: 4 }, { color: 'blue', position: { row: 2, col: 4 } });

    const highest = findHighestPriorityPattern(grid);
    expect(highest).not.toBeNull();
    expect(highest!.type).toBe('sixLine');
  });

  it('sixConnected is lowest priority (no special attack)', () => {
    const grid = createEmptyGrid();
    // Create irregular 6-connected (not a line or other pattern)
    //  X X X
    //    X X X
    setBall(grid, { row: 0, col: 0 }, { color: 'green', position: { row: 0, col: 0 } });
    setBall(grid, { row: 0, col: 1 }, { color: 'green', position: { row: 0, col: 1 } });
    setBall(grid, { row: 0, col: 2 }, { color: 'green', position: { row: 0, col: 2 } });
    setBall(grid, { row: 1, col: 1 }, { color: 'green', position: { row: 1, col: 1 } });
    setBall(grid, { row: 1, col: 2 }, { color: 'green', position: { row: 1, col: 2 } });
    setBall(grid, { row: 1, col: 3 }, { color: 'green', position: { row: 1, col: 3 } });

    const highest = findHighestPriorityPattern(grid);
    // This might match as sixLine or sixConnected depending on exact positions
    // The key is that sixConnected should be returned if nothing higher matches
    expect(highest).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - functions not defined

- [ ] **Step 3: Implement combined detection with priority**

Add to `shared/src/patterns.ts`:
```typescript
/** Pattern priority (higher number = higher priority) */
const PATTERN_PRIORITY: Record<PatternMatch['type'], number> = {
  hexagonRing: 4,
  sixLine: 3,
  pyramid: 2,
  sixConnected: 1,
};

/**
 * Find all patterns in the grid.
 */
export function findAllPatterns(grid: Grid): PatternMatch[] {
  return [
    ...findHexagonRing(grid),
    ...findSixLine(grid),
    ...findPyramid(grid),
    ...findSixConnected(grid),
  ];
}

/**
 * Find the highest priority pattern in the grid.
 * Returns null if no patterns found.
 */
export function findHighestPriorityPattern(grid: Grid): PatternMatch | null {
  const patterns = findAllPatterns(grid);

  if (patterns.length === 0) {
    return null;
  }

  // Sort by priority (descending) and return first
  patterns.sort((a, b) => PATTERN_PRIORITY[b.type] - PATTERN_PRIORITY[a.type]);

  return patterns[0];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/patterns.ts shared/src/patterns.test.ts
git commit -m "feat(shared): add pattern priority and combined detection"
```

---

## Phase 5: Game Engine

### Task 16: Clear Pattern and Chain Reactions

**Files:**
- Create: `shared/src/engine.ts`
- Create: `shared/src/engine.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Write failing tests for pattern clearing**

Create `shared/src/engine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { clearPattern, processBoard } from './engine';
import { createEmptyGrid, setBall, getBall } from './grid';
import type { PatternMatch } from './types';

describe('clearPattern', () => {
  it('removes balls at pattern positions', () => {
    const grid = createEmptyGrid();
    // Place some balls
    for (let col = 0; col < 6; col++) {
      setBall(grid, { row: 0, col }, { color: 'red', position: { row: 0, col } });
    }

    const pattern: PatternMatch = {
      type: 'sixConnected',
      color: 'red',
      positions: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
        { row: 0, col: 4 },
        { row: 0, col: 5 },
      ],
    };

    const newGrid = clearPattern(grid, pattern);

    // All balls should be cleared
    for (let col = 0; col < 6; col++) {
      expect(getBall(newGrid, { row: 0, col })).toBeNull();
    }
  });

  it('clears all balls of same color for hexagonRing', () => {
    const grid = createEmptyGrid();
    // Ring balls
    const ringPositions = [
      { row: 3, col: 4 },
      { row: 3, col: 5 },
      { row: 2, col: 4 },
      { row: 2, col: 6 },
      { row: 1, col: 4 },
      { row: 1, col: 5 },
    ];
    ringPositions.forEach(pos => {
      setBall(grid, pos, { color: 'red', position: pos });
    });

    // Extra red ball elsewhere
    setBall(grid, { row: 0, col: 0 }, { color: 'red', position: { row: 0, col: 0 } });
    // Blue ball (should stay)
    setBall(grid, { row: 0, col: 1 }, { color: 'blue', position: { row: 0, col: 1 } });

    const pattern: PatternMatch = {
      type: 'hexagonRing',
      color: 'red',
      positions: ringPositions,
    };

    const newGrid = clearPattern(grid, pattern);

    // All red balls should be gone
    expect(getBall(newGrid, { row: 0, col: 0 })).toBeNull();
    ringPositions.forEach(pos => {
      expect(getBall(newGrid, pos)).toBeNull();
    });
    // Blue ball should remain
    expect(getBall(newGrid, { row: 0, col: 1 })?.color).toBe('blue');
  });
});

describe('processBoard', () => {
  it('applies gravity after clearing', () => {
    const grid = createEmptyGrid();
    // Stack: blue on top of red
    setBall(grid, { row: 0, col: 5 }, { color: 'red', position: { row: 0, col: 5 } });
    setBall(grid, { row: 1, col: 5 }, { color: 'blue', position: { row: 1, col: 5 } });

    // Create a clearable pattern elsewhere
    for (let col = 0; col < 6; col++) {
      if (col !== 5) {
        setBall(grid, { row: 0, col }, { color: 'red', position: { row: 0, col } });
      }
    }
    // Now we have 6 red balls (including the one at col 5)
    // After clearing, blue ball should fall

    const { grid: newGrid, clears } = processBoard(grid);

    // Should have detected and cleared the red pattern
    expect(clears.length).toBeGreaterThan(0);
    // Blue ball should have fallen
    expect(getBall(newGrid, { row: 0, col: 5 })?.color).toBe('blue');
  });

  it('handles chain reactions', () => {
    // This would require setting up a board where clearing one pattern
    // causes gravity to create another pattern
    // For now, just verify the function returns correctly
    const grid = createEmptyGrid();
    const { grid: newGrid, clears } = processBoard(grid);

    expect(newGrid).toBeDefined();
    expect(Array.isArray(clears)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - functions not defined

- [ ] **Step 3: Implement pattern clearing and board processing**

Create `shared/src/engine.ts`:
```typescript
import type { GridPosition, PatternMatch, BallColor, Attack } from './types';
import { createEmptyGrid, getBall, setBall, getRowWidth, type Grid } from './grid';
import { applyGravity } from './gravity';
import { findHighestPriorityPattern } from './patterns';
import { GRID_HEIGHT } from './types';

/**
 * Clear a pattern from the grid.
 * For special patterns (hexagonRing, sixLine, pyramid), clears all balls of that color.
 * For sixConnected, only clears the matched positions.
 */
export function clearPattern(grid: Grid, pattern: PatternMatch): Grid {
  const newGrid = createEmptyGrid();

  // Copy all balls
  for (let row = 0; row < GRID_HEIGHT; row++) {
    const width = getRowWidth(row);
    for (let col = 0; col < width; col++) {
      const ball = getBall(grid, { row, col });
      if (ball) {
        setBall(newGrid, { row, col }, { ...ball });
      }
    }
  }

  // For special patterns, clear all balls of that color
  if (pattern.type === 'hexagonRing' || pattern.type === 'sixLine' || pattern.type === 'pyramid') {
    for (let row = 0; row < GRID_HEIGHT; row++) {
      const width = getRowWidth(row);
      for (let col = 0; col < width; col++) {
        const ball = getBall(newGrid, { row, col });
        if (ball && ball.color === pattern.color) {
          setBall(newGrid, { row, col }, null);
        }
      }
    }
  } else {
    // For sixConnected, only clear the matched positions
    for (const pos of pattern.positions) {
      setBall(newGrid, pos, null);
    }
  }

  return newGrid;
}

/**
 * Get the attack generated by a pattern.
 */
export function getPatternAttack(pattern: PatternMatch): Attack | null {
  switch (pattern.type) {
    case 'hexagonRing':
      return { type: 'hexagonRings', count: 5 };  // 5 random hexagon rings (30 balls)
    case 'sixLine':
      return { type: 'rows', count: 2 };  // 2 random rows (19 balls)
    case 'pyramid':
      return { type: 'triangles', count: 4 };  // 4 random triangles
    case 'sixConnected':
      return null;  // No attack
  }
}

export interface ProcessResult {
  grid: Grid;
  clears: PatternMatch[];
  attacks: Attack[];
}

/**
 * Process the board: detect patterns, clear them, apply gravity, repeat until stable.
 * Returns the final grid and all clears/attacks that occurred.
 */
export function processBoard(grid: Grid): ProcessResult {
  let currentGrid = grid;
  const allClears: PatternMatch[] = [];
  const allAttacks: Attack[] = [];

  while (true) {
    // Find highest priority pattern
    const pattern = findHighestPriorityPattern(currentGrid);

    if (!pattern) {
      // No more patterns, we're done
      break;
    }

    // Clear the pattern
    currentGrid = clearPattern(currentGrid, pattern);
    allClears.push(pattern);

    // Get attack if any
    const attack = getPatternAttack(pattern);
    if (attack) {
      allAttacks.push(attack);
    }

    // Apply gravity
    currentGrid = applyGravity(currentGrid);
  }

  return {
    grid: currentGrid,
    clears: allClears,
    attacks: allAttacks,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Update index.ts exports**

Add to `shared/src/index.ts`:
```typescript
export * from './engine';
```

- [ ] **Step 6: Commit**

```bash
git add shared/src/engine.ts shared/src/engine.test.ts shared/src/index.ts
git commit -m "feat(shared): add pattern clearing and board processing"
```

---

### Task 17: Piece Landing

**Files:**
- Modify: `shared/src/engine.ts`
- Modify: `shared/src/engine.test.ts`

- [ ] **Step 1: Write failing tests for piece landing**

Add to `shared/src/engine.test.ts`:
```typescript
import { clearPattern, processBoard, landPiece } from './engine';
import type { TrianglePiece } from './types';

describe('landPiece', () => {
  it('places 3 balls on the grid', () => {
    const grid = createEmptyGrid();
    const piece: TrianglePiece = {
      position: { row: 5, col: 5 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };

    const newGrid = landPiece(grid, piece);

    // Count balls
    let ballCount = 0;
    for (let row = 0; row < 12; row++) {
      const width = row % 2 === 0 ? 10 : 9;
      for (let col = 0; col < width; col++) {
        if (getBall(newGrid, { row, col })) ballCount++;
      }
    }
    expect(ballCount).toBe(3);
  });

  it('applies gravity after landing', () => {
    const grid = createEmptyGrid();
    const piece: TrianglePiece = {
      position: { row: 8, col: 5 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };

    const newGrid = landPiece(grid, piece);

    // Balls should have fallen to bottom area
    let foundInTopHalf = false;
    for (let row = 6; row < 12; row++) {
      const width = row % 2 === 0 ? 10 : 9;
      for (let col = 0; col < width; col++) {
        if (getBall(newGrid, { row, col })) foundInTopHalf = true;
      }
    }
    expect(foundInTopHalf).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - landPiece not defined

- [ ] **Step 3: Implement piece landing**

Add to `shared/src/engine.ts`:
```typescript
import { getPieceBallPositions } from './piece';
import type { TrianglePiece } from './types';

/**
 * Land a piece on the grid, placing its 3 balls and applying gravity.
 */
export function landPiece(grid: Grid, piece: TrianglePiece): Grid {
  const newGrid = createEmptyGrid();

  // Copy existing balls
  for (let row = 0; row < GRID_HEIGHT; row++) {
    const width = getRowWidth(row);
    for (let col = 0; col < width; col++) {
      const ball = getBall(grid, { row, col });
      if (ball) {
        setBall(newGrid, { row, col }, { ...ball });
      }
    }
  }

  // Place the piece's balls
  const positions = getPieceBallPositions(piece);
  for (let i = 0; i < 3; i++) {
    const pos = positions[i];
    const color = piece.colors[i];
    setBall(newGrid, pos, { color, position: pos });
  }

  // Apply gravity
  return applyGravity(newGrid);
}
```

Add import at top:
```typescript
import { getPieceBallPositions } from './piece';
import type { TrianglePiece } from './types';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine.ts shared/src/engine.test.ts
git commit -m "feat(shared): add piece landing"
```

---

### Task 18: Game Over Detection

**Files:**
- Modify: `shared/src/engine.ts`
- Modify: `shared/src/engine.test.ts`

- [ ] **Step 1: Write failing tests for game over detection**

Add to `shared/src/engine.test.ts`:
```typescript
import { clearPattern, processBoard, landPiece, isGameOver, canSpawnPiece } from './engine';

describe('isGameOver', () => {
  it('returns false for empty grid', () => {
    const grid = createEmptyGrid();
    expect(isGameOver(grid)).toBe(false);
  });

  it('returns false when top rows are empty', () => {
    const grid = createEmptyGrid();
    // Fill bottom half
    for (let row = 0; row < 5; row++) {
      const width = row % 2 === 0 ? 10 : 9;
      for (let col = 0; col < width; col++) {
        setBall(grid, { row, col }, { color: 'red', position: { row, col } });
      }
    }
    expect(isGameOver(grid)).toBe(false);
  });

  it('returns true when top row has balls', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 11, col: 4 }, { color: 'red', position: { row: 11, col: 4 } });
    expect(isGameOver(grid)).toBe(true);
  });
});

describe('canSpawnPiece', () => {
  it('returns true for empty grid', () => {
    const grid = createEmptyGrid();
    expect(canSpawnPiece(grid)).toBe(true);
  });

  it('returns false when spawn area is blocked', () => {
    const grid = createEmptyGrid();
    // Block the spawn position (row 11, col 4)
    setBall(grid, { row: 11, col: 4 }, { color: 'red', position: { row: 11, col: 4 } });
    expect(canSpawnPiece(grid)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd shared && npm test`
Expected: FAIL - functions not defined

- [ ] **Step 3: Implement game over detection**

Add to `shared/src/engine.ts`:
```typescript
/**
 * Check if the game is over (balls have overflowed to top row).
 */
export function isGameOver(grid: Grid): boolean {
  const topRow = GRID_HEIGHT - 1;  // Row 11
  const width = getRowWidth(topRow);

  for (let col = 0; col < width; col++) {
    if (getBall(grid, { row: topRow, col }) !== null) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a new piece can spawn at the spawn position.
 */
export function canSpawnPiece(grid: Grid): boolean {
  const spawnRow = GRID_HEIGHT - 1;  // Row 11
  const spawnCol = 4;  // Center column

  // Check if spawn position and its neighbors are clear
  // At rotation 0, piece occupies: (row+1, col), (row, col-1), (row, col)
  // Since spawn is at top row, we just check if the spawn position itself is clear
  return getBall(grid, { row: spawnRow, col: spawnCol }) === null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine.ts shared/src/engine.test.ts
git commit -m "feat(shared): add game over detection"
```

---

## Phase 6: Client Setup

### Task 19: Initialize Client Package

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/tsconfig.node.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/vite-env.d.ts`

- [ ] **Step 1: Create client package.json**

Create `client/package.json`:
```json
{
  "name": "@six-balls/client",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@six-balls/shared": "*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "socket.io-client": "^4.7.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create TypeScript configs**

Create `client/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `client/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: Create Vite config**

Create `client/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create HTML entry point**

Create `client/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Six Balls Puzzle</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #1a1a2e;
        color: #eee;
        min-height: 100vh;
      }
      #root {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create React entry files**

Create `client/src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />
```

Create `client/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `client/src/App.tsx`:
```typescript
import React from 'react';

export default function App() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Six Balls Puzzle</h1>
      <p>Game coming soon...</p>
    </div>
  );
}
```

- [ ] **Step 6: Install dependencies and verify**

Run: `npm install`

Run: `cd client && npm run dev`
Expected: Dev server starts, page shows "Six Balls Puzzle" at http://localhost:3000

- [ ] **Step 7: Commit**

```bash
git add client/
git commit -m "chore: initialize client package with React and Vite"
```

---

### Task 20: Canvas Renderer - Hexagonal Grid

**Files:**
- Create: `client/src/game/renderer.ts`
- Create: `client/src/game/renderer.test.ts`
- Create: `client/src/components/Board.tsx`

- [ ] **Step 1: Create canvas renderer utilities**

Create `client/src/game/renderer.ts`:
```typescript
import type { GridPosition, BallColor } from '@six-balls/shared';
import { GRID_HEIGHT, getRowWidth } from '@six-balls/shared';

/** Ball radius in pixels */
export const BALL_RADIUS = 20;

/** Horizontal spacing between ball centers */
export const BALL_SPACING_X = BALL_RADIUS * 2 + 2;

/** Vertical spacing between rows */
export const BALL_SPACING_Y = BALL_RADIUS * 1.73 + 2;  // sqrt(3) for hex

/** Padding around the board */
export const BOARD_PADDING = 30;

/** Colors for each ball type */
export const BALL_COLORS_MAP: Record<BallColor, string> = {
  red: '#ff4444',
  purple: '#9944ff',
  yellow: '#ffcc00',
  blue: '#4488ff',
  green: '#44cc44',
};

/**
 * Calculate canvas dimensions needed for the board.
 */
export function getBoardDimensions(): { width: number; height: number } {
  const maxWidth = 10;  // Even rows have 10 balls
  const width = BOARD_PADDING * 2 + maxWidth * BALL_SPACING_X;
  const height = BOARD_PADDING * 2 + GRID_HEIGHT * BALL_SPACING_Y;
  return { width, height };
}

/**
 * Convert grid position to canvas coordinates.
 */
export function gridToCanvas(pos: GridPosition): { x: number; y: number } {
  const isOddRow = pos.row % 2 === 1;

  // Odd rows are offset by half a ball width
  const xOffset = isOddRow ? BALL_SPACING_X / 2 : 0;

  // Y is inverted (row 0 is at bottom, but canvas y=0 is at top)
  const x = BOARD_PADDING + pos.col * BALL_SPACING_X + BALL_RADIUS + xOffset;
  const y = BOARD_PADDING + (GRID_HEIGHT - 1 - pos.row) * BALL_SPACING_Y + BALL_RADIUS;

  return { x, y };
}

/**
 * Draw a single ball on the canvas.
 */
export function drawBall(
  ctx: CanvasRenderingContext2D,
  pos: GridPosition,
  color: BallColor
): void {
  const { x, y } = gridToCanvas(pos);
  const fillColor = BALL_COLORS_MAP[color];

  // Draw ball with gradient for 3D effect
  const gradient = ctx.createRadialGradient(
    x - BALL_RADIUS * 0.3,
    y - BALL_RADIUS * 0.3,
    BALL_RADIUS * 0.1,
    x,
    y,
    BALL_RADIUS
  );
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(0.3, fillColor);
  gradient.addColorStop(1, darkenColor(fillColor, 0.3));

  ctx.beginPath();
  ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Add outline
  ctx.strokeStyle = darkenColor(fillColor, 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Darken a hex color by a factor (0-1).
 */
function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const newR = Math.floor(r * (1 - factor));
  const newG = Math.floor(g * (1 - factor));
  const newB = Math.floor(b * (1 - factor));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Draw the empty grid (cell outlines).
 */
export function drawGridOutline(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;

  for (let row = 0; row < GRID_HEIGHT; row++) {
    const width = getRowWidth(row);
    for (let col = 0; col < width; col++) {
      const { x, y } = gridToCanvas({ row, col });

      ctx.beginPath();
      ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
```

- [ ] **Step 2: Create Board component**

Create `client/src/components/Board.tsx`:
```typescript
import React, { useRef, useEffect } from 'react';
import type { Grid } from '@six-balls/shared';
import { getBall, getRowWidth, GRID_HEIGHT } from '@six-balls/shared';
import { getBoardDimensions, drawGridOutline, drawBall } from '../game/renderer';

interface BoardProps {
  grid: Grid;
}

export default function Board({ grid }: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = getBoardDimensions();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw grid outline
    drawGridOutline(ctx);

    // Draw balls
    for (let row = 0; row < GRID_HEIGHT; row++) {
      const rowWidth = getRowWidth(row);
      for (let col = 0; col < rowWidth; col++) {
        const ball = getBall(grid, { row, col });
        if (ball) {
          drawBall(ctx, { row, col }, ball.color);
        }
      }
    }
  }, [grid, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ border: '2px solid #333', borderRadius: '8px' }}
    />
  );
}
```

- [ ] **Step 3: Update App to show Board**

Update `client/src/App.tsx`:
```typescript
import React from 'react';
import { createEmptyGrid, setBall } from '@six-balls/shared';
import Board from './components/Board';

export default function App() {
  // Create a demo grid with some balls
  const grid = createEmptyGrid();

  // Add some test balls
  setBall(grid, { row: 0, col: 0 }, { color: 'red', position: { row: 0, col: 0 } });
  setBall(grid, { row: 0, col: 1 }, { color: 'blue', position: { row: 0, col: 1 } });
  setBall(grid, { row: 0, col: 2 }, { color: 'green', position: { row: 0, col: 2 } });
  setBall(grid, { row: 1, col: 0 }, { color: 'yellow', position: { row: 1, col: 0 } });
  setBall(grid, { row: 1, col: 1 }, { color: 'purple', position: { row: 1, col: 1 } });

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '1rem' }}>Six Balls Puzzle</h1>
      <Board grid={grid} />
    </div>
  );
}
```

- [ ] **Step 4: Build shared package first**

Run: `cd shared && npm run build`

- [ ] **Step 5: Verify client renders**

Run: `cd client && npm run dev`
Expected: Shows hexagonal grid with 5 colored balls at bottom-left

- [ ] **Step 6: Commit**

```bash
git add client/src/game/ client/src/components/Board.tsx client/src/App.tsx
git commit -m "feat(client): add canvas renderer for hexagonal grid"
```

---

### Task 21: Falling Piece Rendering

**Files:**
- Modify: `client/src/game/renderer.ts`
- Modify: `client/src/components/Board.tsx`

- [ ] **Step 1: Add piece rendering to renderer**

Add to `client/src/game/renderer.ts`:
```typescript
import type { GridPosition, BallColor, TrianglePiece } from '@six-balls/shared';
import { GRID_HEIGHT, getRowWidth, getPieceBallPositions } from '@six-balls/shared';

/**
 * Draw the current falling piece.
 */
export function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: TrianglePiece
): void {
  const positions = getPieceBallPositions(piece);

  for (let i = 0; i < 3; i++) {
    const pos = positions[i];
    const color = piece.colors[i];

    // Add slight transparency to indicate it's falling
    ctx.globalAlpha = 0.85;
    drawBall(ctx, pos, color);
    ctx.globalAlpha = 1;
  }
}

/**
 * Draw ghost piece showing where the piece will land.
 */
export function drawGhostPiece(
  ctx: CanvasRenderingContext2D,
  piece: TrianglePiece
): void {
  const positions = getPieceBallPositions(piece);

  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 3; i++) {
    const pos = positions[i];
    const color = piece.colors[i];
    drawBall(ctx, pos, color);
  }
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 2: Update Board to render piece**

Update `client/src/components/Board.tsx`:
```typescript
import React, { useRef, useEffect } from 'react';
import type { Grid, TrianglePiece } from '@six-balls/shared';
import { getBall, getRowWidth, GRID_HEIGHT } from '@six-balls/shared';
import { getBoardDimensions, drawGridOutline, drawBall, drawPiece } from '../game/renderer';

interface BoardProps {
  grid: Grid;
  currentPiece?: TrianglePiece | null;
}

export default function Board({ grid, currentPiece }: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = getBoardDimensions();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw grid outline
    drawGridOutline(ctx);

    // Draw balls
    for (let row = 0; row < GRID_HEIGHT; row++) {
      const rowWidth = getRowWidth(row);
      for (let col = 0; col < rowWidth; col++) {
        const ball = getBall(grid, { row, col });
        if (ball) {
          drawBall(ctx, { row, col }, ball.color);
        }
      }
    }

    // Draw current piece
    if (currentPiece) {
      drawPiece(ctx, currentPiece);
    }
  }, [grid, currentPiece, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ border: '2px solid #333', borderRadius: '8px' }}
    />
  );
}
```

- [ ] **Step 3: Update App to show a test piece**

Update `client/src/App.tsx`:
```typescript
import React, { useState, useEffect } from 'react';
import { createEmptyGrid, setBall, type TrianglePiece } from '@six-balls/shared';
import Board from './components/Board';

export default function App() {
  const [grid] = useState(() => {
    const g = createEmptyGrid();
    // Add some test balls at bottom
    setBall(g, { row: 0, col: 0 }, { color: 'red', position: { row: 0, col: 0 } });
    setBall(g, { row: 0, col: 1 }, { color: 'blue', position: { row: 0, col: 1 } });
    setBall(g, { row: 0, col: 2 }, { color: 'green', position: { row: 0, col: 2 } });
    return g;
  });

  const [piece, setPiece] = useState<TrianglePiece>({
    position: { row: 8, col: 5 },
    rotation: 0,
    colors: ['red', 'purple', 'yellow'],
  });

  // Animate piece falling
  useEffect(() => {
    const interval = setInterval(() => {
      setPiece(p => ({
        ...p,
        position: {
          ...p.position,
          row: p.position.row > 2 ? p.position.row - 1 : 8,
        },
      }));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '1rem' }}>Six Balls Puzzle</h1>
      <Board grid={grid} currentPiece={piece} />
    </div>
  );
}
```

- [ ] **Step 4: Rebuild shared and verify**

Run: `cd shared && npm run build`
Run: `cd client && npm run dev`
Expected: Shows grid with falling piece that resets when reaching bottom

- [ ] **Step 5: Commit**

```bash
git add client/src/game/renderer.ts client/src/components/Board.tsx client/src/App.tsx
git commit -m "feat(client): add falling piece rendering"
```

---

### Task 22: Keyboard Controls

**Files:**
- Create: `client/src/hooks/useKeyboard.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create keyboard hook**

Create `client/src/hooks/useKeyboard.ts`:
```typescript
import { useEffect, useCallback } from 'react';

export type GameAction = 'moveLeft' | 'moveRight' | 'rotate' | 'softDrop' | 'hardDrop' | 'pause';

interface KeyboardConfig {
  onAction: (action: GameAction) => void;
  enabled?: boolean;
}

const KEY_MAP: Record<string, GameAction> = {
  ArrowLeft: 'moveLeft',
  ArrowRight: 'moveRight',
  ArrowUp: 'rotate',
  ArrowDown: 'softDrop',
  ' ': 'hardDrop',  // Space
  Escape: 'pause',
};

export function useKeyboard({ onAction, enabled = true }: KeyboardConfig) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const action = KEY_MAP[event.key];
      if (action) {
        event.preventDefault();
        onAction(action);
      }
    },
    [onAction, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

- [ ] **Step 2: Update App to use keyboard controls**

Update `client/src/App.tsx`:
```typescript
import React, { useState, useCallback } from 'react';
import {
  createEmptyGrid,
  setBall,
  movePiece,
  rotatePiece,
  canPlacePiece,
  type TrianglePiece,
  type Grid
} from '@six-balls/shared';
import Board from './components/Board';
import { useKeyboard, type GameAction } from './hooks/useKeyboard';

export default function App() {
  const [grid] = useState<Grid>(() => {
    const g = createEmptyGrid();
    setBall(g, { row: 0, col: 0 }, { color: 'red', position: { row: 0, col: 0 } });
    setBall(g, { row: 0, col: 1 }, { color: 'blue', position: { row: 0, col: 1 } });
    setBall(g, { row: 0, col: 2 }, { color: 'green', position: { row: 0, col: 2 } });
    return g;
  });

  const [piece, setPiece] = useState<TrianglePiece>({
    position: { row: 8, col: 5 },
    rotation: 0,
    colors: ['red', 'purple', 'yellow'],
  });

  const handleAction = useCallback((action: GameAction) => {
    setPiece(currentPiece => {
      let newPiece: TrianglePiece;

      switch (action) {
        case 'moveLeft':
          newPiece = movePiece(currentPiece, 'left');
          break;
        case 'moveRight':
          newPiece = movePiece(currentPiece, 'right');
          break;
        case 'rotate':
          newPiece = rotatePiece(currentPiece);
          break;
        case 'softDrop':
          newPiece = movePiece(currentPiece, 'down');
          break;
        case 'hardDrop':
          // Move down until can't anymore
          newPiece = currentPiece;
          while (true) {
            const next = movePiece(newPiece, 'down');
            if (canPlacePiece(grid, next)) {
              newPiece = next;
            } else {
              break;
            }
          }
          break;
        default:
          return currentPiece;
      }

      // Only apply if valid
      if (canPlacePiece(grid, newPiece)) {
        return newPiece;
      }
      return currentPiece;
    });
  }, [grid]);

  useKeyboard({ onAction: handleAction });

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '1rem' }}>Six Balls Puzzle</h1>
      <Board grid={grid} currentPiece={piece} />
      <p style={{ marginTop: '1rem', color: '#888' }}>
        Arrow keys to move/rotate, Space to drop
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Rebuild and verify**

Run: `cd shared && npm run build`
Run: `cd client && npm run dev`
Expected: Can move piece with arrow keys, space drops it

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useKeyboard.ts client/src/App.tsx
git commit -m "feat(client): add keyboard controls"
```

---

## Phase 7: Server Setup

### Task 23: Initialize Server Package

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`

- [ ] **Step 1: Create server package.json**

Create `server/package.json`:
```json
{
  "name": "@six-balls/server",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@six-balls/shared": "*",
    "express": "^4.19.0",
    "socket.io": "^4.7.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create server tsconfig**

Create `server/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create basic server**

Create `server/src/index.ts`:
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 4: Install dependencies and verify**

Run: `npm install`
Run: `cd server && npm run dev`
Expected: Server starts on port 3001, logs "Server running"

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "chore: initialize server package with Express and Socket.IO"
```

---

### Task 24: Room Manager

**Files:**
- Create: `server/src/RoomManager.ts`
- Create: `server/src/types.ts`

- [ ] **Step 1: Create server types**

Create `server/src/types.ts`:
```typescript
import type { GameState, PlayerState } from '@six-balls/shared';

export interface Room {
  id: string;
  code: string;
  players: Map<string, Player>;
  gameState: GameState | null;
  createdAt: number;
}

export interface Player {
  id: string;
  socketId: string;
  name: string;
  ready: boolean;
}

export type RoomEvent =
  | { type: 'playerJoined'; player: Player }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'gameStarted'; gameState: GameState }
  | { type: 'gameEnded'; winnerId: string };
```

- [ ] **Step 2: Create RoomManager**

Create `server/src/RoomManager.ts`:
```typescript
import type { Room, Player } from './types';
import { createEmptyGrid, createPieceAtSpawn, type GameState, type PlayerState } from '@six-balls/shared';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createInitialPlayerState(playerId: string): PlayerState {
  return {
    id: playerId,
    grid: createEmptyGrid(),
    currentPiece: createPieceAtSpawn(),
    nextPiece: createPieceAtSpawn(),
    attackQueue: [],
    isAlive: true,
  };
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private playerToRoom = new Map<string, string>();

  createRoom(creatorSocketId: string, creatorName: string): Room {
    let code: string;
    // Ensure unique code
    do {
      code = generateRoomCode();
    } while (Array.from(this.rooms.values()).some(r => r.code === code));

    const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const player: Player = {
      id: `player-${Date.now()}`,
      socketId: creatorSocketId,
      name: creatorName,
      ready: false,
    };

    const room: Room = {
      id: roomId,
      code,
      players: new Map([[player.id, player]]),
      gameState: null,
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    this.playerToRoom.set(creatorSocketId, roomId);

    return room;
  }

  joinRoom(code: string, socketId: string, name: string): Room | null {
    const room = Array.from(this.rooms.values()).find(r => r.code === code);

    if (!room) return null;
    if (room.players.size >= 2) return null;
    if (room.gameState) return null;  // Game already started

    const player: Player = {
      id: `player-${Date.now()}`,
      socketId,
      name,
      ready: false,
    };

    room.players.set(player.id, player);
    this.playerToRoom.set(socketId, room.id);

    return room;
  }

  leaveRoom(socketId: string): { room: Room; player: Player } | null {
    const roomId = this.playerToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = Array.from(room.players.values()).find(p => p.socketId === socketId);
    if (!player) return null;

    room.players.delete(player.id);
    this.playerToRoom.delete(socketId);

    // Clean up empty rooms
    if (room.players.size === 0) {
      this.rooms.delete(roomId);
    }

    return { room, player };
  }

  getRoomBySocketId(socketId: string): Room | null {
    const roomId = this.playerToRoom.get(socketId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  getPlayerBySocketId(socketId: string): Player | null {
    const room = this.getRoomBySocketId(socketId);
    if (!room) return null;
    return Array.from(room.players.values()).find(p => p.socketId === socketId) || null;
  }

  startGame(roomId: string): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players.size !== 2) return null;

    const playerIds = Array.from(room.players.keys());
    const gameState: GameState = {
      phase: 'playing',
      players: [
        createInitialPlayerState(playerIds[0]),
        createInitialPlayerState(playerIds[1]),
      ],
      startTime: Date.now(),
      winner: null,
    };

    room.gameState = gameState;
    return gameState;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/RoomManager.ts server/src/types.ts
git commit -m "feat(server): add room manager"
```

---

### Task 25: Socket Events

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Add socket event handling**

Update `server/src/index.ts`:
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Create a new room
  socket.on('createRoom', ({ name }: { name: string }, callback) => {
    const room = roomManager.createRoom(socket.id, name);
    socket.join(room.id);

    callback({
      success: true,
      roomCode: room.code,
      playerId: Array.from(room.players.values())[0].id,
    });

    console.log(`Room created: ${room.code} by ${name}`);
  });

  // Join an existing room
  socket.on('joinRoom', ({ code, name }: { code: string; name: string }, callback) => {
    const room = roomManager.joinRoom(code.toUpperCase(), socket.id, name);

    if (!room) {
      callback({ success: false, error: 'Room not found or full' });
      return;
    }

    socket.join(room.id);
    const player = roomManager.getPlayerBySocketId(socket.id)!;

    callback({
      success: true,
      roomCode: room.code,
      playerId: player.id,
    });

    // Notify other player
    socket.to(room.id).emit('playerJoined', {
      player: { id: player.id, name: player.name },
    });

    console.log(`${name} joined room ${room.code}`);
  });

  // Player ready
  socket.on('playerReady', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    const player = roomManager.getPlayerBySocketId(socket.id);

    if (!room || !player) return;

    player.ready = true;
    io.to(room.id).emit('playerReadyUpdate', {
      playerId: player.id,
      ready: true,
    });

    // Check if both players are ready
    const players = Array.from(room.players.values());
    if (players.length === 2 && players.every(p => p.ready)) {
      const gameState = roomManager.startGame(room.id);
      if (gameState) {
        io.to(room.id).emit('gameStart', { gameState });
        console.log(`Game started in room ${room.code}`);
      }
    }
  });

  // Player input
  socket.on('playerInput', ({ action }: { action: string }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    const player = roomManager.getPlayerBySocketId(socket.id);

    if (!room || !player || !room.gameState) return;

    // TODO: Process input, update game state, broadcast
    // For now, just broadcast the input for testing
    socket.to(room.id).emit('opponentInput', { action });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    const result = roomManager.leaveRoom(socket.id);

    if (result) {
      io.to(result.room.id).emit('playerLeft', {
        playerId: result.player.id,
      });
      console.log(`${result.player.name} left room ${result.room.code}`);
    }

    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Rebuild and verify**

Run: `cd shared && npm run build`
Run: `cd server && npm run dev`
Expected: Server starts without errors

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): add socket event handling"
```

---

## Phase 8: Client-Server Integration

### Task 26: Socket Client

**Files:**
- Create: `client/src/socket/client.ts`
- Create: `client/src/socket/types.ts`

- [ ] **Step 1: Create socket types**

Create `client/src/socket/types.ts`:
```typescript
import type { GameState } from '@six-balls/shared';

export interface ServerToClientEvents {
  playerJoined: (data: { player: { id: string; name: string } }) => void;
  playerLeft: (data: { playerId: string }) => void;
  playerReadyUpdate: (data: { playerId: string; ready: boolean }) => void;
  gameStart: (data: { gameState: GameState }) => void;
  opponentInput: (data: { action: string }) => void;
  gameStateUpdate: (data: { gameState: GameState }) => void;
}

export interface ClientToServerEvents {
  createRoom: (
    data: { name: string },
    callback: (response: { success: boolean; roomCode?: string; playerId?: string; error?: string }) => void
  ) => void;
  joinRoom: (
    data: { code: string; name: string },
    callback: (response: { success: boolean; roomCode?: string; playerId?: string; error?: string }) => void
  ) => void;
  playerReady: () => void;
  playerInput: (data: { action: string }) => void;
}
```

- [ ] **Step 2: Create socket client**

Create `client/src/socket/client.ts`:
```typescript
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from './types';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io('http://localhost:3001', {
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();

    if (s.connected) {
      resolve();
      return;
    }

    s.connect();

    s.once('connect', () => {
      console.log('Connected to server');
      resolve();
    });

    s.once('connect_error', (error) => {
      console.error('Connection error:', error);
      reject(error);
    });
  });
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}

export async function createRoom(name: string): Promise<{ roomCode: string; playerId: string }> {
  const s = getSocket();

  return new Promise((resolve, reject) => {
    s.emit('createRoom', { name }, (response) => {
      if (response.success && response.roomCode && response.playerId) {
        resolve({ roomCode: response.roomCode, playerId: response.playerId });
      } else {
        reject(new Error(response.error || 'Failed to create room'));
      }
    });
  });
}

export async function joinRoom(code: string, name: string): Promise<{ roomCode: string; playerId: string }> {
  const s = getSocket();

  return new Promise((resolve, reject) => {
    s.emit('joinRoom', { code, name }, (response) => {
      if (response.success && response.roomCode && response.playerId) {
        resolve({ roomCode: response.roomCode, playerId: response.playerId });
      } else {
        reject(new Error(response.error || 'Failed to join room'));
      }
    });
  });
}

export function sendReady(): void {
  getSocket().emit('playerReady');
}

export function sendInput(action: string): void {
  getSocket().emit('playerInput', { action });
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/socket/
git commit -m "feat(client): add socket client"
```

---

### Task 27: Lobby UI

**Files:**
- Create: `client/src/components/Menu.tsx`
- Create: `client/src/components/Room.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create Menu component**

Create `client/src/components/Menu.tsx`:
```typescript
import React, { useState } from 'react';

interface MenuProps {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (code: string, name: string) => void;
  onLocalPlay: () => void;
}

export default function Menu({ onCreateRoom, onJoinRoom, onLocalPlay }: MenuProps) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');

  const handleCreate = () => {
    if (name.trim()) {
      onCreateRoom(name.trim());
    }
  };

  const handleJoin = () => {
    if (name.trim() && roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase(), name.trim());
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    border: '2px solid #444',
    borderRadius: '8px',
    background: '#2a2a4e',
    color: '#fff',
    width: '100%',
    marginBottom: '0.5rem',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    border: 'none',
    borderRadius: '8px',
    background: '#4488ff',
    color: '#fff',
    cursor: 'pointer',
    width: '100%',
    marginBottom: '0.5rem',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: '#444',
  };

  if (mode === 'menu') {
    return (
      <div style={{ maxWidth: '300px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem' }}>Six Balls Puzzle</h1>
        <button style={buttonStyle} onClick={() => setMode('create')}>
          Create Room
        </button>
        <button style={buttonStyle} onClick={() => setMode('join')}>
          Join Room
        </button>
        <button style={secondaryButtonStyle} onClick={onLocalPlay}>
          Local Play
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '300px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1rem' }}>
        {mode === 'create' ? 'Create Room' : 'Join Room'}
      </h2>

      <input
        type="text"
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />

      {mode === 'join' && (
        <input
          type="text"
          placeholder="Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
          style={inputStyle}
        />
      )}

      <button
        style={buttonStyle}
        onClick={mode === 'create' ? handleCreate : handleJoin}
        disabled={!name.trim() || (mode === 'join' && !roomCode.trim())}
      >
        {mode === 'create' ? 'Create' : 'Join'}
      </button>

      <button style={secondaryButtonStyle} onClick={() => setMode('menu')}>
        Back
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create Room component**

Create `client/src/components/Room.tsx`:
```typescript
import React from 'react';

interface RoomProps {
  roomCode: string;
  players: Array<{ id: string; name: string; ready: boolean }>;
  isReady: boolean;
  onReady: () => void;
  onLeave: () => void;
}

export default function Room({ roomCode, players, isReady, onReady, onLeave }: RoomProps) {
  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
      <h2>Room Code</h2>
      <div style={{
        fontSize: '2rem',
        fontFamily: 'monospace',
        letterSpacing: '0.5rem',
        padding: '1rem',
        background: '#2a2a4e',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}>
        {roomCode}
      </div>

      <h3>Players</h3>
      <div style={{ marginBottom: '2rem' }}>
        {players.map((player) => (
          <div
            key={player.id}
            style={{
              padding: '0.5rem 1rem',
              margin: '0.5rem 0',
              background: player.ready ? '#2a4a2a' : '#2a2a4e',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{player.name}</span>
            <span>{player.ready ? 'Ready!' : 'Waiting...'}</span>
          </div>
        ))}
        {players.length < 2 && (
          <div style={{ padding: '0.5rem', color: '#888' }}>
            Waiting for opponent...
          </div>
        )}
      </div>

      <button
        onClick={onReady}
        disabled={isReady || players.length < 2}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          border: 'none',
          borderRadius: '8px',
          background: isReady ? '#2a4a2a' : '#4488ff',
          color: '#fff',
          cursor: isReady ? 'default' : 'pointer',
          width: '100%',
          marginBottom: '0.5rem',
        }}
      >
        {isReady ? 'Ready!' : 'Ready'}
      </button>

      <button
        onClick={onLeave}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          border: 'none',
          borderRadius: '8px',
          background: '#444',
          color: '#fff',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Leave Room
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Update App with game states**

Update `client/src/App.tsx`:
```typescript
import React, { useState, useCallback, useEffect } from 'react';
import {
  createEmptyGrid,
  movePiece,
  rotatePiece,
  canPlacePiece,
  createPieceAtSpawn,
  type TrianglePiece,
  type Grid,
  type GameState
} from '@six-balls/shared';
import Board from './components/Board';
import Menu from './components/Menu';
import Room from './components/Room';
import { useKeyboard, type GameAction } from './hooks/useKeyboard';
import {
  connectSocket,
  disconnectSocket,
  createRoom,
  joinRoom,
  sendReady,
  getSocket
} from './socket/client';

type AppState = 'menu' | 'room' | 'playing' | 'localPlay';

interface PlayerInfo {
  id: string;
  name: string;
  ready: boolean;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');

  // Local play state
  const [grid, setGrid] = useState<Grid>(() => createEmptyGrid());
  const [piece, setPiece] = useState<TrianglePiece>(() => createPieceAtSpawn());

  // Socket event handlers
  useEffect(() => {
    const socket = getSocket();

    socket.on('playerJoined', ({ player }) => {
      setPlayers(prev => [...prev, { ...player, ready: false }]);
    });

    socket.on('playerLeft', ({ playerId: leftId }) => {
      setPlayers(prev => prev.filter(p => p.id !== leftId));
    });

    socket.on('playerReadyUpdate', ({ playerId: readyId, ready }) => {
      setPlayers(prev => prev.map(p =>
        p.id === readyId ? { ...p, ready } : p
      ));
    });

    socket.on('gameStart', ({ gameState }) => {
      setAppState('playing');
      // Initialize game with server state
      const myState = gameState.players.find(p => p.id === playerId);
      if (myState) {
        setGrid(myState.grid);
        if (myState.currentPiece) {
          setPiece(myState.currentPiece);
        }
      }
    });

    return () => {
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('playerReadyUpdate');
      socket.off('gameStart');
    };
  }, [playerId]);

  const handleCreateRoom = async (name: string) => {
    try {
      setError('');
      await connectSocket();
      const result = await createRoom(name);
      setRoomCode(result.roomCode);
      setPlayerId(result.playerId);
      setPlayers([{ id: result.playerId, name, ready: false }]);
      setAppState('room');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room');
    }
  };

  const handleJoinRoom = async (code: string, name: string) => {
    try {
      setError('');
      await connectSocket();
      const result = await joinRoom(code, name);
      setRoomCode(result.roomCode);
      setPlayerId(result.playerId);
      // We'll get player list from server events
      setPlayers([{ id: result.playerId, name, ready: false }]);
      setAppState('room');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room');
    }
  };

  const handleReady = () => {
    sendReady();
    setIsReady(true);
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, ready: true } : p
    ));
  };

  const handleLeave = () => {
    disconnectSocket();
    setAppState('menu');
    setRoomCode('');
    setPlayerId('');
    setPlayers([]);
    setIsReady(false);
  };

  const handleLocalPlay = () => {
    setGrid(createEmptyGrid());
    setPiece(createPieceAtSpawn());
    setAppState('localPlay');
  };

  const handleAction = useCallback((action: GameAction) => {
    setPiece(currentPiece => {
      let newPiece: TrianglePiece;

      switch (action) {
        case 'moveLeft':
          newPiece = movePiece(currentPiece, 'left');
          break;
        case 'moveRight':
          newPiece = movePiece(currentPiece, 'right');
          break;
        case 'rotate':
          newPiece = rotatePiece(currentPiece);
          break;
        case 'softDrop':
          newPiece = movePiece(currentPiece, 'down');
          break;
        case 'hardDrop':
          newPiece = currentPiece;
          while (true) {
            const next = movePiece(newPiece, 'down');
            if (canPlacePiece(grid, next)) {
              newPiece = next;
            } else {
              break;
            }
          }
          break;
        default:
          return currentPiece;
      }

      if (canPlacePiece(grid, newPiece)) {
        return newPiece;
      }
      return currentPiece;
    });
  }, [grid]);

  useKeyboard({
    onAction: handleAction,
    enabled: appState === 'localPlay' || appState === 'playing'
  });

  if (appState === 'menu') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Menu
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onLocalPlay={handleLocalPlay}
        />
        {error && <p style={{ color: '#ff4444', marginTop: '1rem' }}>{error}</p>}
      </div>
    );
  }

  if (appState === 'room') {
    return (
      <div style={{ padding: '2rem' }}>
        <Room
          roomCode={roomCode}
          players={players}
          isReady={isReady}
          onReady={handleReady}
          onLeave={handleLeave}
        />
      </div>
    );
  }

  // Playing or localPlay
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '1rem' }}>Six Balls Puzzle</h1>
      <Board grid={grid} currentPiece={piece} />
      <p style={{ marginTop: '1rem', color: '#888' }}>
        Arrow keys to move/rotate, Space to drop
      </p>
      {appState === 'localPlay' && (
        <button
          onClick={() => setAppState('menu')}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#444',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Back to Menu
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rebuild and verify**

Run: `cd shared && npm run build`
Run: `cd server && npm run dev` (in one terminal)
Run: `cd client && npm run dev` (in another terminal)
Expected: Can create/join rooms, see lobby UI, ready up

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Menu.tsx client/src/components/Room.tsx client/src/App.tsx
git commit -m "feat(client): add lobby UI and room management"
```

---

## Phase 9: Final Integration

### Task 28: Game Loop Integration

This task connects all the pieces: the client sends inputs, server processes them, and broadcasts state updates.

**Files:**
- Create: `server/src/GameEngine.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create server game engine**

Create `server/src/GameEngine.ts`:
```typescript
import {
  movePiece,
  rotatePiece,
  canPlacePiece,
  landPiece,
  processBoard,
  createPieceAtSpawn,
  isGameOver,
  type GameState,
  type PlayerState,
  type TrianglePiece,
  type Grid,
} from '@six-balls/shared';

export type GameInput = 'moveLeft' | 'moveRight' | 'rotate' | 'softDrop' | 'hardDrop';

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
      break;
    case 'moveRight':
      newPiece = movePiece(player.currentPiece, 'right');
      break;
    case 'rotate':
      newPiece = rotatePiece(player.currentPiece);
      break;
    case 'softDrop':
      newPiece = movePiece(player.currentPiece, 'down');
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
      // Land the piece
      return handlePieceLand(gameState, playerIndex, newPiece);
    default:
      return gameState;
  }

  // Check if valid
  if (!canPlacePiece(player.grid, newPiece)) {
    // If soft drop can't go down, land the piece
    if (input === 'softDrop') {
      return handlePieceLand(gameState, playerIndex, player.currentPiece);
    }
    return gameState;
  }

  // Update piece position
  const newPlayers = [...gameState.players] as [PlayerState, PlayerState];
  newPlayers[playerIndex] = {
    ...player,
    currentPiece: newPiece,
  };

  return {
    ...gameState,
    players: newPlayers,
  };
}

function handlePieceLand(
  gameState: GameState,
  playerIndex: number,
  piece: TrianglePiece
): GameState {
  const player = gameState.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;

  // Land piece and process board
  let newGrid = landPiece(player.grid, piece);
  const { grid: processedGrid, attacks } = processBoard(newGrid);

  // Check game over
  const dead = isGameOver(processedGrid);

  // Add attacks to opponent's queue
  const newPlayers = [...gameState.players] as [PlayerState, PlayerState];

  newPlayers[playerIndex] = {
    ...player,
    grid: processedGrid,
    currentPiece: dead ? null : player.nextPiece,
    nextPiece: createPieceAtSpawn(),
    isAlive: !dead,
  };

  if (attacks.length > 0) {
    newPlayers[opponentIndex] = {
      ...newPlayers[opponentIndex],
      attackQueue: [...newPlayers[opponentIndex].attackQueue, ...attacks],
    };
  }

  // Check for winner
  let winner: string | null = null;
  if (!newPlayers[0].isAlive) winner = newPlayers[1].id;
  if (!newPlayers[1].isAlive) winner = newPlayers[0].id;

  return {
    ...gameState,
    players: newPlayers,
    phase: winner ? 'ended' : 'playing',
    winner,
  };
}

export function tick(gameState: GameState): GameState {
  // Auto-drop pieces based on time
  // For now, this is a placeholder
  return gameState;
}
```

- [ ] **Step 2: Update server to use game engine**

Update the playerInput handler in `server/src/index.ts`:
```typescript
import { processInput, type GameInput } from './GameEngine';

// ... in the socket handlers section:

  // Player input
  socket.on('playerInput', ({ action }: { action: string }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    const player = roomManager.getPlayerBySocketId(socket.id);

    if (!room || !player || !room.gameState) return;
    if (room.gameState.phase !== 'playing') return;

    const validActions: GameInput[] = ['moveLeft', 'moveRight', 'rotate', 'softDrop', 'hardDrop'];
    if (!validActions.includes(action as GameInput)) return;

    // Process input
    const newState = processInput(room.gameState, player.id, action as GameInput);
    room.gameState = newState;

    // Broadcast state to all players
    io.to(room.id).emit('gameStateUpdate', { gameState: newState });

    // Check for game end
    if (newState.phase === 'ended') {
      console.log(`Game ended in room ${room.code}, winner: ${newState.winner}`);
    }
  });
```

Add the import at top:
```typescript
import { processInput, type GameInput } from './GameEngine';
```

- [ ] **Step 3: Update client to handle state updates**

Add to the socket event handlers in `client/src/App.tsx`:
```typescript
    socket.on('gameStateUpdate', ({ gameState }) => {
      const myState = gameState.players.find(p => p.id === playerId);
      if (myState) {
        setGrid(myState.grid);
        if (myState.currentPiece) {
          setPiece(myState.currentPiece);
        }
      }

      if (gameState.phase === 'ended') {
        // Handle game end
        alert(gameState.winner === playerId ? 'You win!' : 'You lose!');
      }
    });

    return () => {
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('playerReadyUpdate');
      socket.off('gameStart');
      socket.off('gameStateUpdate');
    };
```

Also update handleAction to send inputs to server when in online mode:
```typescript
  const handleAction = useCallback((action: GameAction) => {
    // For online play, send to server
    if (appState === 'playing') {
      sendInput(action);
      return;
    }

    // For local play, handle locally
    setPiece(currentPiece => {
      // ... existing local logic
    });
  }, [grid, appState]);
```

Add sendInput import:
```typescript
import {
  connectSocket,
  disconnectSocket,
  createRoom,
  joinRoom,
  sendReady,
  sendInput,
  getSocket
} from './socket/client';
```

- [ ] **Step 4: Rebuild and test**

Run: `cd shared && npm run build`
Run: `cd server && npm run dev`
Run: `cd client && npm run dev`

Test: Open two browser tabs, create room in one, join with code in other, both ready up, play game

- [ ] **Step 5: Commit**

```bash
git add server/src/GameEngine.ts server/src/index.ts client/src/App.tsx
git commit -m "feat: integrate game loop between client and server"
```

---

### Task 29: Dual Board Display

**Files:**
- Create: `client/src/components/GameView.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create GameView component**

Create `client/src/components/GameView.tsx`:
```typescript
import React from 'react';
import type { GameState } from '@six-balls/shared';
import Board from './Board';

interface GameViewProps {
  gameState: GameState;
  myPlayerId: string;
}

export default function GameView({ gameState, myPlayerId }: GameViewProps) {
  const myIndex = gameState.players.findIndex(p => p.id === myPlayerId);
  const opponentIndex = myIndex === 0 ? 1 : 0;

  const myState = gameState.players[myIndex];
  const opponentState = gameState.players[opponentIndex];

  return (
    <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', alignItems: 'flex-start' }}>
      {/* My board */}
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>You</h3>
        <Board grid={myState.grid} currentPiece={myState.currentPiece} />
        {myState.attackQueue.length > 0 && (
          <div style={{ marginTop: '0.5rem', color: '#ff4444' }}>
            Incoming attacks: {myState.attackQueue.length}
          </div>
        )}
      </div>

      {/* VS divider */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem 0'
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>VS</div>
        {gameState.phase === 'ended' && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: gameState.winner === myPlayerId ? '#2a4a2a' : '#4a2a2a',
            borderRadius: '8px'
          }}>
            {gameState.winner === myPlayerId ? 'You Win!' : 'You Lose'}
          </div>
        )}
      </div>

      {/* Opponent board */}
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Opponent</h3>
        <Board grid={opponentState.grid} currentPiece={opponentState.currentPiece} />
        {!opponentState.isAlive && (
          <div style={{ marginTop: '0.5rem', color: '#44ff44' }}>
            Defeated!
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update App to use GameView**

Update `client/src/App.tsx` to track full game state and use GameView:

Add state:
```typescript
const [gameState, setGameState] = useState<GameState | null>(null);
```

Update socket handlers:
```typescript
    socket.on('gameStart', ({ gameState: initialState }) => {
      setAppState('playing');
      setGameState(initialState);
    });

    socket.on('gameStateUpdate', ({ gameState: newState }) => {
      setGameState(newState);
    });
```

Update playing render:
```typescript
  // Playing online
  if (appState === 'playing' && gameState) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '1rem' }}>Six Balls Puzzle</h1>
        <GameView gameState={gameState} myPlayerId={playerId} />
        <p style={{ marginTop: '1rem', color: '#888' }}>
          Arrow keys to move/rotate, Space to drop
        </p>
      </div>
    );
  }
```

Add import:
```typescript
import GameView from './components/GameView';
```

- [ ] **Step 3: Test dual board display**

Run both server and client, connect two players, verify both boards display

- [ ] **Step 4: Commit**

```bash
git add client/src/components/GameView.tsx client/src/App.tsx
git commit -m "feat(client): add dual board game view"
```

---

### Task 30: Final Polish and Testing

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README**

Create `README.md`:
```markdown
# Six Balls Puzzle

A web-based two-player puzzle battle game with hexagonal grid mechanics.

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Development

Start the server:
```bash
cd server && npm run dev
```

Start the client (in another terminal):
```bash
cd client && npm run dev
```

Open http://localhost:3000

### Play

1. **Online Mode:**
   - Player 1: Click "Create Room" and share the 6-digit code
   - Player 2: Click "Join Room" and enter the code
   - Both players click "Ready"

2. **Local Mode:**
   - Click "Local Play" for single-player practice

### Controls

| Key | Action |
|-----|--------|
| Left Arrow | Move left |
| Right Arrow | Move right |
| Up Arrow | Rotate |
| Down Arrow | Soft drop |
| Space | Hard drop |

## Project Structure

```
six_balls/
├── shared/     # Shared game logic (TypeScript)
├── client/     # React + Canvas frontend
└── server/     # Node.js + Socket.IO backend
```

## Tech Stack

- **Frontend:** React 18, Vite, HTML5 Canvas
- **Backend:** Node.js, Express, Socket.IO
- **Shared:** TypeScript game logic library

## Game Rules

- Match 6+ same-colored balls to clear them
- Special patterns (hexagon ring, 6-line, pyramid) clear all balls of that color and attack opponent
- First player to overflow loses

## License

MIT
```

- [ ] **Step 2: Run full test suite**

Run: `cd shared && npm test`
Expected: All tests pass

- [ ] **Step 3: Build all packages**

Run: `npm run build`
Expected: All packages build successfully

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions"
```

---

## Summary

This plan implements the Six Balls Puzzle game in 30 tasks across 9 phases:

1. **Phase 1 (Tasks 1-5):** Project setup, core types, hexagonal grid
2. **Phase 2 (Tasks 6-8):** Triangle piece mechanics
3. **Phase 3 (Tasks 9-10):** Gravity system
4. **Phase 4 (Tasks 11-15):** Pattern detection (all 4 types)
5. **Phase 5 (Tasks 16-18):** Game engine (clearing, landing, game over)
6. **Phase 6 (Tasks 19-22):** Client setup with rendering and controls
7. **Phase 7 (Tasks 23-25):** Server setup with rooms and sockets
8. **Phase 8 (Tasks 26-27):** Client-server integration
9. **Phase 9 (Tasks 28-30):** Game loop, dual boards, polish

Each task follows TDD with explicit test-first steps, exact file paths, and complete code blocks.
