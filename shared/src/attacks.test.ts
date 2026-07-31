import { describe, it, expect } from 'vitest';
import { applyAttacks } from './attacks';
import { createEmptyGrid, getBall, setBall, type Grid } from './grid';
import { createRNG } from './rng';
import { applyGravity } from './gravity';
import { findPatterns } from './patterns';
import { BALL_COLORS, GRID_HEIGHT, type Attack } from './types';

/** RNG whose colors cycle through the palette (never 6 of one color in <30 balls). */
function cyclingRNG(seed = 1) {
  const real = createRNG(seed);
  let i = 0;
  return {
    next: real.next,
    pickOne<T>(items: readonly T[]): T {
      return items[i++ % items.length];
    },
  };
}

function countBalls(grid: Grid): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell) n++;
  return n;
}

/** Fill a cell with a color scheme that can never form a pattern (no two adjacent same). */
function fillInert(grid: Grid, row: number, col: number) {
  const color = (['blue', 'green', 'yellow'] as const)[(row + col) % 3];
  setBall(grid, { row, col }, { color, position: { row, col } });
}

describe('applyAttacks', () => {
  it('drops a 6-ball pyramid per triangle unit', () => {
    const attacks: Attack[] = [{ type: 'triangles', count: 4 }];
    const result = applyAttacks(createEmptyGrid(), attacks, cyclingRNG());
    expect(countBalls(result)).toBe(24);
  });

  it('drops one full row of balls per row unit (10 + 9 for count 2)', () => {
    const attacks: Attack[] = [{ type: 'rows', count: 2 }];
    const result = applyAttacks(createEmptyGrid(), attacks, cyclingRNG());
    expect(countBalls(result)).toBe(19);
  });

  it('drops 6 balls per hexagon ring unit', () => {
    const attacks: Attack[] = [{ type: 'hexagonRings', count: 5 }];
    const result = applyAttacks(createEmptyGrid(), attacks, cyclingRNG());
    expect(countBalls(result)).toBe(30);
  });

  it('leaves every dropped ball settled (no floating balls)', () => {
    const attacks: Attack[] = [{ type: 'hexagonRings', count: 5 }];
    const result = applyAttacks(createEmptyGrid(), attacks, cyclingRNG());
    expect(applyGravity(result)).toEqual(result);
  });

  it('prefers safe positions that do not overflow the top row', () => {
    // Fill rows 0-10 completely, except one hole at (10, 3)
    const grid = createEmptyGrid();
    for (let row = 0; row <= 10; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (row === 10 && col === 3) continue;
        fillInert(grid, row, col);
      }
    }
    const attacks: Attack[] = [{ type: 'triangles', count: 1 }];
    const result = applyAttacks(grid, attacks, cyclingRNG());
    // The only safe destination must be used before any top-row overflow
    expect(getBall(result, { row: 10, col: 3 })).not.toBeNull();
  });

  it('clears patterns formed by dropped garbage and leaves no pattern behind', () => {
    // All-red garbage guarantees big same-color clusters
    const allRed = { next: createRNG(7).next, pickOne: <T>(items: readonly T[]): T => items[0] };
    const grid = createEmptyGrid();
    for (let col = 0; col < 5; col++) {
      setBall(grid, { row: 0, col }, { color: BALL_COLORS[0], position: { row: 0, col } });
    }
    const attacks: Attack[] = [{ type: 'triangles', count: 4 }];
    const result = applyAttacks(grid, attacks, allRed);
    // Board must be at a clear fixpoint
    expect(findPatterns(result)).toEqual([]);
    // 29 red balls on a 10-wide board must have formed and cleared at least one group
    expect(countBalls(result)).toBeLessThan(29);
  });

  it('is deterministic for the same RNG seed', () => {
    const attacks: Attack[] = [{ type: 'rows', count: 2 }];
    const a = applyAttacks(createEmptyGrid(), attacks, createRNG(42));
    const b = applyAttacks(createEmptyGrid(), attacks, createRNG(42));
    expect(a).toEqual(b);
  });

  it('does not modify the input grid', () => {
    const grid = createEmptyGrid();
    const before = JSON.stringify(grid);
    applyAttacks(grid, [{ type: 'triangles', count: 2 }], cyclingRNG());
    expect(JSON.stringify(grid)).toBe(before);
  });

  it('handles a full board without crashing (balls overflow into top row)', () => {
    const grid = createEmptyGrid();
    for (let row = 0; row <= 10; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        fillInert(grid, row, col);
      }
    }
    const result = applyAttacks(grid, [{ type: 'triangles', count: 1 }], cyclingRNG());
    // Board was full below the top row; garbage lands in row 11 (overflow = game over)
    let topRowBalls = 0;
    for (const cell of result[GRID_HEIGHT - 1]) if (cell) topRowBalls++;
    expect(topRowBalls).toBeGreaterThan(0);
  });
});
