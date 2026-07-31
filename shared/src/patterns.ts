import type { GridPosition, PatternMatch } from './types';
import { getBall, getNeighbors, getRowWidth, isValidPosition, type Grid } from './grid';
import { GRID_HEIGHT } from './types';

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

    const currentBall = getBall(grid, current);
    // Only same-colored balls join the group and get marked visited;
    // rejected border cells must stay available for their own group's scan.
    if (!currentBall || currentBall.color !== color) continue;

    visited.add(currentKey);
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

type LineDirection = 'horizontal' | 'diagonalUpRight' | 'diagonalUpLeft';

function getNextInLine(pos: GridPosition, direction: LineDirection): GridPosition {
  const isEvenRow = pos.row % 2 === 0;

  switch (direction) {
    case 'horizontal':
      return { row: pos.row, col: pos.col + 1 };
    case 'diagonalUpRight':
      if (isEvenRow) {
        return { row: pos.row + 1, col: pos.col };
      } else {
        return { row: pos.row + 1, col: pos.col + 1 };
      }
    case 'diagonalUpLeft':
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

/**
 * Get all 6 neighbor positions for a center position.
 * Returns null for out-of-bounds positions.
 */
function getAllNeighborPositions(center: GridPosition): (GridPosition | null)[] {
  const isEvenRow = center.row % 2 === 0;

  const offsets = isEvenRow
    ? [
        { dRow: 1, dCol: -1 },  { dRow: 1, dCol: 0 },
        { dRow: 0, dCol: -1 },  { dRow: 0, dCol: 1 },
        { dRow: -1, dCol: -1 }, { dRow: -1, dCol: 0 },
      ]
    : [
        { dRow: 1, dCol: 0 },  { dRow: 1, dCol: 1 },
        { dRow: 0, dCol: -1 }, { dRow: 0, dCol: 1 },
        { dRow: -1, dCol: 0 }, { dRow: -1, dCol: 1 },
      ];

  return offsets.map(offset => {
    const pos = { row: center.row + offset.dRow, col: center.col + offset.dCol };
    return isValidPosition(pos) ? pos : null;
  });
}

/**
/* ------------------------------------------------------------------ */
/*  Pyramid (1+2+3 triangle)                                           */
/* ------------------------------------------------------------------ */

/**
 * Compute the 6 positions of a point-up pyramid (base at bottom, apex upward),
 * given the base-left corner (baseRow, baseCol).  The returned positions are
 * hex-neighbor aware, adjusting for row parity.
 *
 * Even baseRow (base x: c, c+1, c+2):
 *   row+0 (even): ▌c …… c+1 …… c+2▐
 *   row+1 (odd):    ▌c …… c+1▐        (x: c+0.5, c+1.5)
 *   row+2 (even):      ▌c+1▐          (x: c+1, centered)
 *
 * Odd baseRow (base x: c+0.5, c+1.5, c+2.5):
 *   row+0 (odd):  ▌c …… c+1 …… c+2▐
 *   row+1 (even):   ▌c+1 …… c+2▐      (x: c+1, c+2)
 *   row+2 (odd):       ▌c+1▐          (x: c+1.5, centered)
 */
function getPointUpPyramid(baseRow: number, baseCol: number): GridPosition[] | null {
  const isEven = baseRow % 2 === 0;
  const positions: GridPosition[] = isEven
    ? [
        { row: baseRow, col: baseCol },
        { row: baseRow, col: baseCol + 1 },
        { row: baseRow, col: baseCol + 2 },
        { row: baseRow + 1, col: baseCol },
        { row: baseRow + 1, col: baseCol + 1 },
        { row: baseRow + 2, col: baseCol + 1 },
      ]
    : [
        { row: baseRow, col: baseCol },
        { row: baseRow, col: baseCol + 1 },
        { row: baseRow, col: baseCol + 2 },
        { row: baseRow + 1, col: baseCol + 1 },
        { row: baseRow + 1, col: baseCol + 2 },
        { row: baseRow + 2, col: baseCol + 1 },
      ];
  if (positions.some(p => !isValidPosition(p))) return null;
  return positions;
}

/**
 * Compute the 6 positions of a point-down pyramid (apex at bottom, base
 * upward), given the bottom apex (apexRow, apexCol).  Hex-neighbor aware.
 *
 * Even apexRow (apex x: c):
 *   row+0 (even):        ▌c▐
 *   row+1 (odd):     ▌c-1 …… c▐        (x: c-0.5, c+0.5)
 *   row+2 (even): ▌c-1 …… c …… c+1▐    (x: c-1, c, c+1, centered)
 *
 * Odd apexRow (apex x: c+0.5):
 *   row+0 (odd):         ▌c▐
 *   row+1 (even):     ▌c …… c+1▐       (x: c, c+1)
 *   row+2 (odd):  ▌c-1 …… c …… c+1▐    (x: c-0.5, c+0.5, c+1.5, centered)
 */
function getPointDownPyramid(apexRow: number, apexCol: number): GridPosition[] | null {
  const isEven = apexRow % 2 === 0;
  const positions: GridPosition[] = isEven
    ? [
        { row: apexRow, col: apexCol },
        { row: apexRow + 1, col: apexCol - 1 },
        { row: apexRow + 1, col: apexCol },
        { row: apexRow + 2, col: apexCol - 1 },
        { row: apexRow + 2, col: apexCol },
        { row: apexRow + 2, col: apexCol + 1 },
      ]
    : [
        { row: apexRow, col: apexCol },
        { row: apexRow + 1, col: apexCol },
        { row: apexRow + 1, col: apexCol + 1 },
        { row: apexRow + 2, col: apexCol - 1 },
        { row: apexRow + 2, col: apexCol },
        { row: apexRow + 2, col: apexCol + 1 },
      ];
  if (positions.some(p => !isValidPosition(p))) return null;
  return positions;
}

/**
 * Find all pyramid patterns (1+2+3 triangle formations, point-up and
 * point-down).  Every position in the triangle must be same-colored.
 */
export function findPyramid(grid: Grid): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const foundPyramids = new Set<string>();

  const keyFunc = (ps: GridPosition[]) =>
    [...ps]
      .sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col))
      .map(p => `${p.row},${p.col}`)
      .join('|');

  for (let row = 0; row < GRID_HEIGHT - 2; row++) {
    const width = getRowWidth(row);
    for (let col = 0; col < width; col++) {
      // Point-up pyramid: (row, col) is the base-left corner
      const up = getPointUpPyramid(row, col);
      if (up) {
        const color = getBall(grid, up[0])?.color;
        if (color && up.every(p => getBall(grid, p)?.color === color)) {
          const key = keyFunc(up);
          if (!foundPyramids.has(key)) {
            foundPyramids.add(key);
            matches.push({ type: 'pyramid', color, positions: up });
          }
        }
      }

      // Point-down pyramid: (row, col) is the bottom apex
      const down = getPointDownPyramid(row, col);
      if (down) {
        const color = getBall(grid, down[0])?.color;
        if (color && down.every(p => getBall(grid, p)?.color === color)) {
          const key = keyFunc(down);
          if (!foundPyramids.has(key)) {
            foundPyramids.add(key);
            matches.push({ type: 'pyramid', color, positions: down });
          }
        }
      }
    }
  }

  return matches;
}

/**
 * Find all hexagon ring patterns (6 same-colored balls around any center).
 */
export function findHexagonRing(grid: Grid): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const foundRings = new Set<string>();

  for (let row = 1; row < GRID_HEIGHT - 1; row++) {
    const width = getRowWidth(row);
    for (let col = 1; col < width - 1; col++) {
      const center = { row, col };
      const neighborPositions = getAllNeighborPositions(center);

      const validNeighbors = neighborPositions.filter((p): p is GridPosition => p !== null);
      if (validNeighbors.length !== 6) continue;

      const neighborBalls = validNeighbors.map(pos => getBall(grid, pos));
      if (neighborBalls.some(b => b === null)) continue;

      const firstColor = neighborBalls[0]!.color;
      if (!neighborBalls.every(b => b!.color === firstColor)) continue;

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

/**
 * Find all patterns on the grid, returning only the highest-priority match
 * when multiple patterns overlap. Priority order (highest first):
 * 1. hexagonRing
 * 2. sixLine
 * 3. pyramid
 * 4. sixConnected
 */
export function findPatterns(grid: Grid): PatternMatch[] {
  const hexagonRings = findHexagonRing(grid);
  const sixLines = findSixLine(grid);
  const pyramids = findPyramid(grid);
  const sixConnected = findSixConnected(grid);

  // Collect all positions used by higher-priority matches
  const usedPositions = new Set<string>();
  const keyFunc = (pos: GridPosition) => `${pos.row},${pos.col}`;

  const results: PatternMatch[] = [];

  // Priority 1: Hexagon rings
  for (const match of hexagonRings) {
    results.push(match);
    match.positions.forEach(p => usedPositions.add(keyFunc(p)));
  }

  // Priority 2: Six lines (exclude positions already used)
  for (const match of sixLines) {
    if (match.positions.some(p => usedPositions.has(keyFunc(p)))) continue;
    results.push(match);
    match.positions.forEach(p => usedPositions.add(keyFunc(p)));
  }

  // Priority 3: Pyramids
  for (const match of pyramids) {
    if (match.positions.some(p => usedPositions.has(keyFunc(p)))) continue;
    results.push(match);
    match.positions.forEach(p => usedPositions.add(keyFunc(p)));
  }

  // Priority 4: Six connected (lowest priority)
  for (const match of sixConnected) {
    if (match.positions.some(p => usedPositions.has(keyFunc(p)))) continue;
    results.push(match);
    match.positions.forEach(p => usedPositions.add(keyFunc(p)));
  }

  return results;
}
