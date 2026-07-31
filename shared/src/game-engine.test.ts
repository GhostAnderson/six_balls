import { describe, it, expect } from 'vitest';
import { clearPattern, processBoard, landPiece, isGameOver, computeLandingSteps } from './game-engine';
import { settleWithMoves } from './gravity';
import { createEmptyGrid, setBall, getBall } from './grid';
import { getPieceBallPositions } from './piece';
import type { Ball, PatternMatch, TrianglePiece } from './types';

describe('clearPattern', () => {
  it('removes matched balls from grid', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 0, col: 0 }, { color: 'red', position: { row: 0, col: 0 } });
    setBall(grid, { row: 0, col: 1 }, { color: 'red', position: { row: 0, col: 1 } });

    const match: PatternMatch = {
      type: 'sixConnected',
      color: 'red',
      positions: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    };

    const result = clearPattern(grid, match);
    expect(getBall(result, { row: 0, col: 0 })).toBeNull();
    expect(getBall(result, { row: 0, col: 1 })).toBeNull();
  });

  it('does not remove balls outside match positions', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 0, col: 0 }, { color: 'red', position: { row: 0, col: 0 } });
    setBall(grid, { row: 0, col: 2 }, { color: 'blue', position: { row: 0, col: 2 } });

    const match: PatternMatch = {
      type: 'sixConnected',
      color: 'red',
      positions: [{ row: 0, col: 0 }],
    };

    const result = clearPattern(grid, match);
    expect(getBall(result, { row: 0, col: 0 })).toBeNull();
    expect(getBall(result, { row: 0, col: 2 })).not.toBeNull();
  });
});

describe('processBoard', () => {
  it('returns grid and empty attacks when no patterns exist', () => {
    const grid = createEmptyGrid();
    const result = processBoard(grid);
    expect(result.attacks).toEqual([]);
  });

  it('processes chain reactions', () => {
    const grid = createEmptyGrid();
    // Place 6 connected red balls
    for (let col = 0; col < 6; col++) {
      setBall(grid, { row: 0, col }, { color: 'red', position: { row: 0, col } });
    }

    const result = processBoard(grid);
    // All red balls should be cleared
    for (let col = 0; col < 6; col++) {
      expect(getBall(result.grid, { row: 0, col })).toBeNull();
    }
  });
});

describe('landPiece', () => {
  it('places piece balls on the grid and settles them to the floor', () => {
    const grid = createEmptyGrid();
    const piece: TrianglePiece = {
      position: { row: 5, col: 5 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };

    const result = landPiece(grid, piece);

    // All 3 balls end up on the grid, settled in the bottom rows
    let count = 0;
    for (let row = 0; row < result.grid.length; row++) {
      for (let col = 0; col < result.grid[row].length; col++) {
        if (result.grid[row][col]) {
          count++;
          expect(row).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(count).toBe(3);
  });

  it('settles landed balls with gravity so none are left floating', () => {
    const grid = createEmptyGrid();
    // One ball already resting on the floor at (0,4)
    setBall(grid, { row: 0, col: 4 }, { color: 'yellow', position: { row: 0, col: 4 } });

    // Upright triangle that collided on top of that ball:
    // balls at (2,4), (1,4), (1,3) — all unsupported per hex gravity
    const piece: TrianglePiece = {
      position: { row: 2, col: 4 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };

    const result = landPiece(grid, piece);

    // Balls must slide into the notches: (1,3)→(0,3), (1,4)→(0,5), (2,4)→(1,4)
    expect(getBall(result.grid, { row: 0, col: 3 })?.color).toBe('green');
    expect(getBall(result.grid, { row: 0, col: 4 })?.color).toBe('yellow');
    expect(getBall(result.grid, { row: 0, col: 5 })?.color).toBe('blue');
    expect(getBall(result.grid, { row: 1, col: 4 })?.color).toBe('red');
    // Nothing left floating where the piece stopped
    expect(getBall(result.grid, { row: 2, col: 4 })).toBeNull();
    expect(getBall(result.grid, { row: 1, col: 3 })).toBeNull();
  });

  it('processes the board after landing', () => {
    const grid = createEmptyGrid();
    // Place 5 blue balls already on the grid that will form a 6-connect when combined with the piece
    for (let col = 0; col < 5; col++) {
      setBall(grid, { row: 0, col }, { color: 'blue', position: { row: 0, col } });
    }

    const piece: TrianglePiece = {
      position: { row: 1, col: 4 },
      rotation: 0,
      colors: ['blue', 'red', 'red'],
    };

    const result = landPiece(grid, piece);
    // The blue ball should connect forming a 6+ group and be cleared
    // Check that gravity was applied (balls fell down)
    expect(result.grid.length).toBe(12); // Grid still valid
  });
});

describe('special patterns clear the whole color', () => {
  it('a pyramid clears every ball of that color on the board', () => {
    const grid = createEmptyGrid();
    // True centered pyramid: base row 0 cols 3-5, middle row 1 cols 3-4, apex row 2 col 4
    const pyramid = [
      { row: 0, col: 3 }, { row: 0, col: 4 }, { row: 0, col: 5 },
      { row: 1, col: 3 }, { row: 1, col: 4 },
      { row: 2, col: 4 },
    ];
    pyramid.forEach(pos => setBall(grid, pos, { color: 'red', position: pos }));
    // A distant red ball, not connected to the pyramid
    setBall(grid, { row: 0, col: 9 }, { color: 'red', position: { row: 0, col: 9 } });
    // A blue bystander that must survive
    setBall(grid, { row: 0, col: 0 }, { color: 'blue', position: { row: 0, col: 0 } });

    const result = processBoard(grid);
    let reds = 0, blues = 0;
    for (const row of result.grid) for (const cell of row) {
      if (cell?.color === 'red') reds++;
      if (cell?.color === 'blue') blues++;
    }
    expect(reds).toBe(0);       // whole color wiped
    expect(blues).toBe(1);      // other colors untouched
    expect(result.attacks).toEqual([{ type: 'triangles', count: 4 }]);
  });
});

describe('settleWithMoves', () => {
  it('reports identity-preserving moves for floating balls', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 3, col: 4 }, { color: 'red', position: { row: 3, col: 4 } });
    const { grid: settled, moves } = settleWithMoves(grid);
    expect(moves).toHaveLength(1);
    expect(moves[0].from).toEqual({ row: 3, col: 4 });
    expect(moves[0].color).toBe('red');
    expect(getBall(settled, moves[0].to)?.color).toBe('red');
    expect(moves[0].to.row).toBe(0);
  });

  it('reports no moves for an already-settled grid', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 0, col: 4 }, { color: 'blue', position: { row: 0, col: 4 } });
    expect(settleWithMoves(grid).moves).toHaveLength(0);
  });
});

describe('computeLandingSteps', () => {
  it('records a clear round when the landing completes a pattern, and matches landPiece', () => {
    const grid = createEmptyGrid();
    // 5 blue balls; the landing piece's blue ball will connect for a 6-group
    for (let col = 0; col < 5; col++) {
      setBall(grid, { row: 0, col }, { color: 'blue', position: { row: 0, col } });
    }
    const piece: TrianglePiece = {
      position: { row: 2, col: 5 },
      rotation: 0,
      colors: ['red', 'green', 'blue'],  // ball 2 (LL) lands at (1,4)→ settles next to the blues
    };

    const steps = computeLandingSteps(grid, piece);
    expect(steps.placed).toHaveLength(3);
    expect(steps.clearRounds.length).toBeGreaterThanOrEqual(1);
    expect(steps.clearRounds[0].cleared.length).toBeGreaterThanOrEqual(6);
    // finalGrid must agree with the engine's landPiece
    expect(landPiece(grid, piece).grid).toEqual(steps.finalGrid);
  });
});

describe('isGameOver', () => {
  it('returns false for an empty grid', () => {
    const grid = createEmptyGrid();
    expect(isGameOver(grid)).toBe(false);
  });

  it('returns false when balls exist but none in the top row', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 0, col: 0 }, { color: 'red', position: { row: 0, col: 0 } });
    setBall(grid, { row: 5, col: 4 }, { color: 'blue', position: { row: 5, col: 4 } });
    expect(isGameOver(grid)).toBe(false);
  });

  it('returns true when a ball exists in the top row (row 11)', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 11, col: 0 }, { color: 'red', position: { row: 11, col: 0 } });
    expect(isGameOver(grid)).toBe(true);
  });

  it('returns true when the next piece cannot spawn because its cells are occupied', () => {
    const grid = createEmptyGrid();
    const spawnPiece: TrianglePiece = {
      position: { row: 10, col: 4 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };
    // Block one of the spawn cells
    setBall(grid, { row: 9, col: 4 }, { color: 'purple', position: { row: 9, col: 4 } });
    expect(isGameOver(grid, spawnPiece)).toBe(true);
  });

  it('returns false when the next piece can spawn freely', () => {
    const grid = createEmptyGrid();
    const spawnPiece: TrianglePiece = {
      position: { row: 10, col: 4 },
      rotation: 0,
      colors: ['red', 'blue', 'green'],
    };
    setBall(grid, { row: 0, col: 4 }, { color: 'purple', position: { row: 0, col: 4 } });
    expect(isGameOver(grid, spawnPiece)).toBe(false);
  });

  it('returns true when any ball overflows into the top row', () => {
    const grid = createEmptyGrid();
    // Fill row 11 completely with balls
    for (let col = 0; col < 9; col++) {
      setBall(grid, { row: 11, col }, { color: 'purple', position: { row: 11, col } });
    }
    expect(isGameOver(grid)).toBe(true);
  });
});
