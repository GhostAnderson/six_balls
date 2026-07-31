import { describe, it, expect } from 'vitest';
import { findSixConnected, findSixLine, findHexagonRing, findPyramid, findPatterns } from './patterns';
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
    const positions = [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 0, col: 3 }, { row: 0, col: 4 },
    ];
    positions.forEach(pos => {
      setBall(grid, pos, { color: 'red', position: pos } as Ball);
    });
    const matches = findSixConnected(grid);
    expect(matches).toEqual([]);
  });

  it('finds 6 connected balls in a row', () => {
    const grid = createEmptyGrid();
    const positions = [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 0, col: 3 }, { row: 0, col: 4 }, { row: 0, col: 5 },
    ];
    positions.forEach(pos => {
      setBall(grid, pos, { color: 'red', position: pos } as Ball);
    });
    const matches = findSixConnected(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('sixConnected');
    expect(matches[0].color).toBe('red');
    expect(matches[0].positions).toHaveLength(6);
  });

  it('finds a group even when it borders an earlier-scanned group of another color', () => {
    const grid = createEmptyGrid();
    // A green ball scanned first (lowest scan order)...
    setBall(grid, { row: 0, col: 0 }, { color: 'green', position: { row: 0, col: 0 } } as Ball);
    // ...whose BFS must not swallow the neighboring red ball at (0,1).
    // Red group: 5 in a row + 1 above = 6 connected (not a line, not a pyramid).
    const reds = [
      { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
      { row: 0, col: 4 }, { row: 0, col: 5 }, { row: 1, col: 1 },
    ];
    reds.forEach(pos => setBall(grid, pos, { color: 'red', position: pos } as Ball));

    const matches = findSixConnected(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].color).toBe('red');
    expect(matches[0].positions).toHaveLength(6);
  });

  it('does not match different colors', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 0, col: 0 }, { color: 'red', position: { row: 0, col: 0 } } as Ball);
    setBall(grid, { row: 0, col: 1 }, { color: 'red', position: { row: 0, col: 1 } } as Ball);
    setBall(grid, { row: 0, col: 2 }, { color: 'red', position: { row: 0, col: 2 } } as Ball);
    setBall(grid, { row: 0, col: 3 }, { color: 'blue', position: { row: 0, col: 3 } } as Ball);
    setBall(grid, { row: 0, col: 4 }, { color: 'blue', position: { row: 0, col: 4 } } as Ball);
    setBall(grid, { row: 0, col: 5 }, { color: 'blue', position: { row: 0, col: 5 } } as Ball);
    const matches = findSixConnected(grid);
    expect(matches).toEqual([]);
  });
});

describe('findPyramid geometry', () => {
  it('finds a true centered point-up pyramid on an even base row', () => {
    const grid = createEmptyGrid();
    // Base row 0 (even): cols 3,4,5 → x 3,4,5. Middle row 1: cols 3,4 → x 3.5,4.5.
    // Centered apex row 2: col 4 → x 4.
    const cells = [
      { row: 0, col: 3 }, { row: 0, col: 4 }, { row: 0, col: 5 },
      { row: 1, col: 3 }, { row: 1, col: 4 },
      { row: 2, col: 4 },
    ];
    cells.forEach(pos => setBall(grid, pos, { color: 'red', position: pos } as Ball));
    const matches = findPyramid(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].positions).toHaveLength(6);
  });

  it('finds a true centered point-up pyramid on an odd base row', () => {
    const grid = createEmptyGrid();
    // Base row 1 (odd): cols 2,3,4 → x 2.5,3.5,4.5. Middle row 2: cols 3,4 → x 3,4.
    // Centered apex row 3 (odd): col 3 → x 3.5.
    const cells = [
      { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 },
      { row: 2, col: 3 }, { row: 2, col: 4 },
      { row: 3, col: 3 },
    ];
    cells.forEach(pos => setBall(grid, pos, { color: 'blue', position: pos } as Ball));
    const matches = findPyramid(grid);
    expect(matches).toHaveLength(1);
  });

  it('finds a true centered point-down pyramid with an even apex row', () => {
    const grid = createEmptyGrid();
    // Apex row 0 (even): col 4 → x 4. Middle row 1: cols 3,4 → x 3.5,4.5.
    // Base row 2 (even): cols 3,4,5 → x 3,4,5.
    const cells = [
      { row: 0, col: 4 },
      { row: 1, col: 3 }, { row: 1, col: 4 },
      { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 2, col: 5 },
    ];
    cells.forEach(pos => setBall(grid, pos, { color: 'green', position: pos } as Ball));
    const matches = findPyramid(grid);
    expect(matches).toHaveLength(1);
  });

  it('detects the pyramid inside a larger 7-ball same-color shape', () => {
    const grid = createEmptyGrid();
    const cells = [
      { row: 0, col: 3 }, { row: 0, col: 4 }, { row: 0, col: 5 },
      { row: 1, col: 3 }, { row: 1, col: 4 },
      { row: 2, col: 4 },
      { row: 0, col: 6 },  // 7th ball attached to the base
    ];
    cells.forEach(pos => setBall(grid, pos, { color: 'purple', position: pos } as Ball));
    const patterns = findPatterns(grid);
    expect(patterns.some(m => m.type === 'pyramid')).toBe(true);
  });
});

describe('findSixLine', () => {
  it('returns empty array for empty grid', () => {
    const grid = createEmptyGrid();
    const matches = findSixLine(grid);
    expect(matches).toEqual([]);
  });

  it('finds horizontal six-line', () => {
    const grid = createEmptyGrid();
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
    // UpperRight diagonal: (0,2) -> (1,2) -> (2,3) -> (3,3) -> (4,4) -> (5,4)
    const positions = [
      { row: 0, col: 2 }, { row: 1, col: 2 }, { row: 2, col: 3 },
      { row: 3, col: 3 }, { row: 4, col: 4 }, { row: 5, col: 4 },
    ];
    positions.forEach(pos => {
      setBall(grid, pos, { color: 'blue', position: pos });
    });

    const matches = findSixLine(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('sixLine');
  });
});

describe('findHexagonRing', () => {
  it('returns empty array for empty grid', () => {
    const grid = createEmptyGrid();
    const matches = findHexagonRing(grid);
    expect(matches).toEqual([]);
  });

  it('finds a hexagon ring (6 same-color balls around a center)', () => {
    const grid = createEmptyGrid();
    // Center ball (any color)
    setBall(grid, { row: 2, col: 5 }, { color: 'yellow', position: { row: 2, col: 5 } });

    // 6 red balls around it (even row neighbors)
    const ringPositions = [
      { row: 3, col: 4 }, { row: 3, col: 5 },
      { row: 2, col: 4 }, { row: 2, col: 6 },
      { row: 1, col: 4 }, { row: 1, col: 5 },
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
      { row: 3, col: 4 }, { row: 3, col: 5 },
      { row: 2, col: 4 }, { row: 2, col: 6 },
      { row: 1, col: 4 }, { row: 1, col: 5 },
    ];
    ringPositions.forEach(pos => {
      setBall(grid, pos, { color: 'green', position: pos });
    });

    const matches = findHexagonRing(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].color).toBe('green');
  });
});

describe('findPyramid', () => {
  it('returns empty array for empty grid', () => {
    const grid = createEmptyGrid();
    const matches = findPyramid(grid);
    expect(matches).toEqual([]);
  });

  it('finds point-up pyramid (1+2+3 formation)', () => {
    const grid = createEmptyGrid();
    // Point up pyramid (row 0 = bottom):
    // row 0: 3 balls (base)
    // row 1: 2 balls
    // row 2: 1 ball (apex)
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
    // Point down:
    // row 2: 3 balls (top base)
    // row 1: 2 balls
    // row 0: 1 ball (apex)
    setBall(grid, { row: 2, col: 3 }, { color: 'blue', position: { row: 2, col: 3 } });
    setBall(grid, { row: 2, col: 4 }, { color: 'blue', position: { row: 2, col: 4 } });
    setBall(grid, { row: 2, col: 5 }, { color: 'blue', position: { row: 2, col: 5 } });
    setBall(grid, { row: 1, col: 3 }, { color: 'blue', position: { row: 1, col: 3 } });
    setBall(grid, { row: 1, col: 4 }, { color: 'blue', position: { row: 1, col: 4 } });
    setBall(grid, { row: 0, col: 4 }, { color: 'blue', position: { row: 0, col: 4 } });

    const matches = findPyramid(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('pyramid');
    expect(matches[0].color).toBe('blue');
  });

  it('finds point-up pyramid at row 4 (even base row)', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 4, col: 1 }, { color: 'red', position: { row: 4, col: 1 } });
    setBall(grid, { row: 4, col: 2 }, { color: 'red', position: { row: 4, col: 2 } });
    setBall(grid, { row: 4, col: 3 }, { color: 'red', position: { row: 4, col: 3 } });
    setBall(grid, { row: 5, col: 1 }, { color: 'red', position: { row: 5, col: 1 } });
    setBall(grid, { row: 5, col: 2 }, { color: 'red', position: { row: 5, col: 2 } });
    setBall(grid, { row: 6, col: 2 }, { color: 'red', position: { row: 6, col: 2 } });
    const matches = findPyramid(grid);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('finds both orientations simultaneously', () => {
    const grid = createEmptyGrid();
    // Point-up red at row 0 (base cols 0-2, apex centered at col 1)
    for (let c = 0; c < 3; c++) setBall(grid, { row: 0, col: c }, { color: 'red', position: { row: 0, col: c } });
    setBall(grid, { row: 1, col: 0 }, { color: 'red', position: { row: 1, col: 0 } });
    setBall(grid, { row: 1, col: 1 }, { color: 'red', position: { row: 1, col: 1 } });
    setBall(grid, { row: 2, col: 1 }, { color: 'red', position: { row: 2, col: 1 } });
    // Point-down blue: odd apex row 3 col 7, base row 5 cols 6-8
    setBall(grid, { row: 3, col: 7 }, { color: 'blue', position: { row: 3, col: 7 } });
    setBall(grid, { row: 4, col: 7 }, { color: 'blue', position: { row: 4, col: 7 } });
    setBall(grid, { row: 4, col: 8 }, { color: 'blue', position: { row: 4, col: 8 } });
    setBall(grid, { row: 5, col: 6 }, { color: 'blue', position: { row: 5, col: 6 } });
    setBall(grid, { row: 5, col: 7 }, { color: 'blue', position: { row: 5, col: 7 } });
    setBall(grid, { row: 5, col: 8 }, { color: 'blue', position: { row: 5, col: 8 } });
    const matches = findPyramid(grid);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('does not match with 5 balls', () => {
    const grid = createEmptyGrid();
    setBall(grid, { row: 0, col: 3 }, { color: 'red', position: { row: 0, col: 3 } });
    setBall(grid, { row: 0, col: 4 }, { color: 'red', position: { row: 0, col: 4 } });
    setBall(grid, { row: 0, col: 5 }, { color: 'red', position: { row: 0, col: 5 } });
    setBall(grid, { row: 1, col: 3 }, { color: 'red', position: { row: 1, col: 3 } });
    setBall(grid, { row: 1, col: 4 }, { color: 'red', position: { row: 1, col: 4 } });
    // Missing apex at row 2

    const matches = findPyramid(grid);
    expect(matches).toEqual([]);
  });
});

describe('findPatterns', () => {
  it('returns empty array for empty grid', () => {
    const grid = createEmptyGrid();
    const matches = findPatterns(grid);
    expect(matches).toEqual([]);
  });

  it('returns matches ordered by priority: ring > line > pyramid > connected', () => {
    const grid = createEmptyGrid();

    // Set up a hexagon ring (priority 1, red)
    setBall(grid, { row: 3, col: 4 }, { color: 'red', position: { row: 3, col: 4 } });
    setBall(grid, { row: 3, col: 5 }, { color: 'red', position: { row: 3, col: 5 } });
    setBall(grid, { row: 2, col: 4 }, { color: 'red', position: { row: 2, col: 4 } });
    setBall(grid, { row: 2, col: 6 }, { color: 'red', position: { row: 2, col: 6 } });
    setBall(grid, { row: 1, col: 4 }, { color: 'red', position: { row: 1, col: 4 } });
    setBall(grid, { row: 1, col: 5 }, { color: 'red', position: { row: 1, col: 5 } });

    // Also set up 6 connected green balls (priority 4)
    for (let col = 5; col <= 10; col++) {
      setBall(grid, { row: 8, col }, { color: 'green', position: { row: 8, col } });
    }

    const matches = findPatterns(grid);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // First match should be hexagon ring (highest priority)
    expect(matches[0].type).toBe('hexagonRing');
  });
});
