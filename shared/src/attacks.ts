import { BALL_COLORS, GRID_HEIGHT, type Attack, type BallColor } from './types';
import { getBall, setBall, getRowWidth, type Grid } from './grid';
import { findFallDestination } from './gravity';
import { processBoard } from './game-engine';

interface RNGLike {
  next(): number;
  pickOne<T>(items: readonly T[]): T;
}

const defaultRNG: RNGLike = {
  next: Math.random,
  pickOne: <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)],
};

const TOP_ROW = GRID_HEIGHT - 1;

/**
 * Drop a single garbage ball into the grid (mutates `grid`).
 * Picks a random entry column, preferring destinations that do not
 * land in the top row (which would cause overflow).
 */
function dropGarbageBall(grid: Grid, color: BallColor, rng: RNGLike): void {
  const candidates: { row: number; col: number }[] = [];
  const safe: { row: number; col: number }[] = [];

  for (let col = 0; col < getRowWidth(TOP_ROW); col++) {
    const entry = { row: TOP_ROW, col };
    if (getBall(grid, entry) !== null) continue;
    const dest = findFallDestination(grid, entry);
    candidates.push(dest);
    if (dest.row < TOP_ROW) safe.push(dest);
  }

  const pool = safe.length > 0 ? safe : candidates;
  if (pool.length === 0) return; // top row completely full; nowhere to drop

  const dest = pool[Math.floor(rng.next() * pool.length)];
  setBall(grid, dest, { color, position: dest });
}

/** Number of balls in one unit of the given attack type. */
function unitBallCount(type: Attack['type'], unitIndex: number): number {
  switch (type) {
    case 'hexagonRings':
      return 6;
    case 'rows':
      // Alternate full even/odd row widths (10, 9, 10, ...)
      return getRowWidth(unitIndex % 2 === 0 ? 0 : 1);
    case 'triangles':
      // A full 1+2+3 pyramid of garbage
      return 6;
  }
}

/**
 * Resolve an attack queue against a grid: drop garbage balls unit by unit,
 * settling and clearing patterns after each unit (per game design).
 * Clears triggered by garbage do not generate counter-attacks.
 * Returns a new grid; the input grid is not modified.
 */
export function applyAttacks(grid: Grid, attacks: Attack[], rng: RNGLike = defaultRNG): Grid {
  let current: Grid = grid.map(row => [...row]);

  for (const attack of attacks) {
    for (let unit = 0; unit < attack.count; unit++) {
      const balls = unitBallCount(attack.type, unit);
      for (let i = 0; i < balls; i++) {
        dropGarbageBall(current, rng.pickOne(BALL_COLORS), rng);
      }
      current = processBoard(current).grid;
    }
  }

  return current;
}
