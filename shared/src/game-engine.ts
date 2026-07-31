import { GRID_HEIGHT, type PatternMatch, type Attack, type Ball, type BallColor, type GridPosition, type TrianglePiece } from './types';
import { getPieceBallPositions, canPlacePiece } from './piece';
import { getBall, setBall, getRowWidth, type Grid } from './grid';
import { applyGravity, settleWithMoves, type BallMove } from './gravity';
import { findPatterns } from './patterns';

/**
 * Clear balls at matched positions on the grid.
 * Returns a new grid with those positions set to null.
 */
export function clearPattern(grid: Grid, match: PatternMatch): Grid {
  // Create a shallow copy with spread
  const newGrid: Grid = grid.map(row => [...row]);

  for (const pos of match.positions) {
    setBall(newGrid, pos, null);
  }

  return newGrid;
}

/**
 * Determine attack type and count from a pattern match.
 */
function getAttackFromPattern(match: PatternMatch): Attack[] {
  switch (match.type) {
    case 'hexagonRing':
      return [{ type: 'hexagonRings', count: 5 }];
    case 'sixLine':
      return [{ type: 'rows', count: 2 }];
    case 'pyramid':
      return [{ type: 'triangles', count: 4 }];
    case 'sixConnected':
      return [];  // No attack for basic six-connected
  }
}

/**
 * Positions to clear for a set of matches. Special patterns (ring, line,
 * pyramid) wipe every ball of their color on the board; plain six-connected
 * clears only the group itself.
 */
function expandClearPositions(grid: Grid, patterns: PatternMatch[]): { pos: GridPosition; color: BallColor }[] {
  const out: { pos: GridPosition; color: BallColor }[] = [];
  const seen = new Set<string>();
  const add = (pos: GridPosition, color: BallColor) => {
    const key = `${pos.row},${pos.col}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ pos, color });
    }
  };

  const fullColors = new Set<BallColor>();
  for (const p of patterns) {
    if (p.type !== 'sixConnected') fullColors.add(p.color);
    for (const pos of p.positions) {
      const ball = getBall(grid, pos);
      if (ball) add(pos, ball.color);
    }
  }
  if (fullColors.size > 0) {
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let col = 0; col < getRowWidth(row); col++) {
        const ball = getBall(grid, { row, col });
        if (ball && fullColors.has(ball.color)) add({ row, col }, ball.color);
      }
    }
  }
  return out;
}

/**
 * Process the full board: find patterns, clear them, apply gravity, chain.
 * Returns final grid and accumulated attacks to send to opponent.
 */
export function processBoard(grid: Grid): { grid: Grid; attacks: Attack[] } {
  let currentGrid = grid;
  const allAttacks: Attack[] = [];

  // Chain loop: keep finding patterns until no more
  let iterations = 0;
  const MAX_ITERATIONS = 100; // Safety limit

  while (iterations < MAX_ITERATIONS) {
    const patterns = findPatterns(currentGrid);

    if (patterns.length === 0) {
      break;
    }

    // Clear all patterns (special patterns wipe their whole color)
    const toClear = expandClearPositions(currentGrid, patterns);
    const afterClear: Grid = currentGrid.map(row => [...row]);
    for (const c of toClear) {
      setBall(afterClear, c.pos, null);
    }
    for (const pattern of patterns) {
      allAttacks.push(...getAttackFromPattern(pattern));
    }

    // Apply gravity
    currentGrid = applyGravity(afterClear);
    iterations++;
  }

  return { grid: currentGrid, attacks: allAttacks };
}

/**
 * Land a piece: place its 3 balls on the grid, then process the board
 * (find patterns, clear, apply gravity, chain).
 */
export function landPiece(grid: Grid, piece: TrianglePiece): { grid: Grid; attacks: Attack[] } {
  const steps = computeLandingSteps(grid, piece);
  return { grid: steps.finalGrid, attacks: steps.attacks };
}

/** One round of pattern clearing during landing resolution. */
export interface ClearRound {
  cleared: { pos: GridPosition; color: BallColor }[];
  settleMoves: BallMove[];
}

/**
 * Full step-by-step account of what happens when a piece lands,
 * so the renderer can animate each phase (settle → burst → cascade).
 */
export interface LandingSteps {
  /** Where each of the 3 piece balls locked (pre-gravity), in colors order. */
  placed: { pos: GridPosition; color: BallColor }[];
  /** Identity-preserving gravity moves right after placement. */
  settleMoves: BallMove[];
  /** Each chain round: which balls burst, then which balls fell. */
  clearRounds: ClearRound[];
  finalGrid: Grid;
  attacks: Attack[];
}

/**
 * Compute the complete landing resolution for a piece: placement,
 * gravity settle, and every clear/cascade round. Pure and deterministic —
 * the client renderer calls this with the same inputs as the engine to
 * reconstruct animation steps.
 */
export function computeLandingSteps(grid: Grid, piece: TrianglePiece): LandingSteps {
  const positions = getPieceBallPositions(piece);
  return resolvePlacement(grid, positions.map((pos, i) => ({ pos, color: piece.colors[i] })));
}

/**
 * Resolve placing a set of balls onto the grid (from a landed piece or a
 * snapped continuous-fall piece): settle, then clear/cascade to a fixpoint.
 */
export function resolvePlacement(grid: Grid, placed: { pos: GridPosition; color: BallColor }[]): LandingSteps {
  const newGrid: Grid = grid.map(row => [...row]);

  for (const p of placed) {
    const ball: Ball = { color: p.color, position: p.pos };
    setBall(newGrid, p.pos, ball);
  }

  // Balls split from the piece and settle independently before matching
  const initial = settleWithMoves(newGrid);
  let current = initial.grid;

  const clearRounds: ClearRound[] = [];
  const attacks: Attack[] = [];
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (iterations < MAX_ITERATIONS) {
    const patterns = findPatterns(current);
    if (patterns.length === 0) break;

    const cleared = expandClearPositions(current, patterns);
    const afterClear: Grid = current.map(row => [...row]);
    for (const c of cleared) {
      setBall(afterClear, c.pos, null);
    }
    for (const pattern of patterns) {
      attacks.push(...getAttackFromPattern(pattern));
    }

    const settled = settleWithMoves(afterClear);
    clearRounds.push({ cleared, settleMoves: settled.moves });
    current = settled.grid;
    iterations++;
  }

  return { placed, settleMoves: initial.moves, clearRounds, finalGrid: current, attacks };
}

/**
 * Check if the game is over due to overflow.
 * Returns true if any ball exists in the top row (row 11), or if the
 * next piece (when provided) cannot spawn because its cells are occupied.
 */
export function isGameOver(grid: Grid, nextPiece?: TrianglePiece): boolean {
  // Check top row (GRID_HEIGHT - 1) for any balls
  for (let col = 0; col < getRowWidth(GRID_HEIGHT - 1); col++) {
    if (getBall(grid, { row: GRID_HEIGHT - 1, col }) !== null) {
      return true;
    }
  }
  if (nextPiece && !canPlacePiece(grid, nextPiece)) {
    return true;
  }
  return false;
}

/**
 * Get auto-fall interval in ms based on elapsed game time.
 */
export function getSpeedInterval(elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  if (seconds < 45) return 1000;
  if (seconds < 90) return 850;
  if (seconds < 150) return 700;
  if (seconds < 240) return 550;
  return 400;
}
