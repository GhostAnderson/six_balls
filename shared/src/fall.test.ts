import { describe, it, expect } from 'vitest';
import { ballOffsets, ballPositions, spawnFalling, maxDrop, moveX, tryRotate, snapToCells, PIECE_RADIUS } from './fall';
import { createEmptyGrid, setBall } from './grid';

const COLORS: ['red', 'blue', 'green'] = ['red', 'blue', 'green'];

describe('ballOffsets', () => {
  it('forms an equilateral triangle with side 1 at every rotation', () => {
    for (let r = 0; r < 6; r++) {
      const o = ballOffsets(r);
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;
        const d = Math.hypot(o[i].x - o[j].x, o[i].y - o[j].y);
        expect(d).toBeCloseTo(1, 6);
        // Centroid distance = circumradius
        expect(Math.hypot(o[i].x, o[i].y)).toBeCloseTo(PIECE_RADIUS, 6);
      }
    }
  });

  it('rotation 0 has the apex ball on top', () => {
    const o = ballOffsets(0);
    expect(o[0].y).toBeGreaterThan(o[1].y);
    expect(o[0].y).toBeGreaterThan(o[2].y);
    expect(o[0].x).toBeCloseTo(0, 6);
  });
});

describe('maxDrop', () => {
  it('lets a piece fall all the way to the floor on an empty grid', () => {
    const p = spawnFalling(COLORS);
    const drop = maxDrop(createEmptyGrid(), p);
    // Lowest balls (bottom pair at centroid - r/2) must end at y = 0
    const lowestY = Math.min(...ballPositions(p).map(b => b.y));
    expect(drop).toBeCloseTo(lowestY, 6);
  });

  it('stops on top of a settled ball', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 0, col: 4 }, { color: 'red', position: { row: 0, col: 4 } });
    const p = { ...spawnFalling(COLORS), x: 4.0 };
    const drop = maxDrop(grid, p);
    const dropped = { ...p, y: p.y - drop };
    // After dropping, no ball may overlap the settled ball at (4, 0)
    for (const b of ballPositions(dropped)) {
      expect(Math.hypot(b.x - 4, b.y - 0)).toBeGreaterThanOrEqual(0.998);
      expect(b.y).toBeGreaterThanOrEqual(-1e-6);
    }
    expect(drop).toBeLessThan(p.y);  // it stopped early
  });
});

describe('moveX', () => {
  it('clamps at the side walls so the piece can still reach the floor at the edges', () => {
    const grid = createEmptyGrid();
    let p = spawnFalling(COLORS);
    p = moveX(grid, p, -100);
    const minX = Math.min(...ballPositions(p).map(b => b.x));
    expect(minX).toBeGreaterThanOrEqual(-1e-6);
    // At the wall it can still fall to the bottom
    const drop = maxDrop(grid, p);
    const lowestY = Math.min(...ballPositions(p).map(b => b.y));
    expect(drop).toBeCloseTo(lowestY, 6);
  });

  it('moves continuously, not in grid steps', () => {
    const p = spawnFalling(COLORS);
    const moved = moveX(createEmptyGrid(), p, 0.13);
    expect(moved.x).toBeCloseTo(p.x + 0.13, 6);
  });
});

describe('tryRotate', () => {
  it('rotates about the centroid: the centroid never moves in open space', () => {
    const p = spawnFalling(COLORS);
    const r = tryRotate(createEmptyGrid(), p);
    expect(r).not.toBeNull();
    expect(r!.x).toBeCloseTo(p.x, 6);
    expect(r!.y).toBeCloseTo(p.y, 6);
    expect(r!.rotation).toBe(1);
  });
});

describe('snapToCells', () => {
  it('snaps a piece resting on the floor into 3 distinct bottom cells', () => {
    const grid = createEmptyGrid();
    let p = { ...spawnFalling(COLORS), x: 4.5 };
    p = { ...p, y: p.y - maxDrop(grid, p) };
    const placed = snapToCells(grid, p);
    expect(placed).toHaveLength(3);
    const keys = new Set(placed.map(c => `${c.pos.row},${c.pos.col}`));
    expect(keys.size).toBe(3);
    // Bottom pair in row 0, apex in row 1
    const rows = placed.map(c => c.pos.row).sort();
    expect(rows).toEqual([0, 0, 1]);
  });

  it('snaps correctly at the left wall', () => {
    const grid = createEmptyGrid();
    let p = spawnFalling(COLORS);
    p = moveX(grid, p, -100);
    p = { ...p, y: p.y - maxDrop(grid, p) };
    const placed = snapToCells(grid, p);
    expect(placed).toHaveLength(3);
    for (const c of placed) {
      expect(c.pos.col).toBeGreaterThanOrEqual(0);
    }
  });
});
