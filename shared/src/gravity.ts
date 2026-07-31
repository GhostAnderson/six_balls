import type { Ball, BallColor, GridPosition } from './types';
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
 * Find where a ball at `pos` would come to rest under hex gravity.
 */
export function findFallDestination(grid: Grid, pos: GridPosition): GridPosition {
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

    const leftEmpty = isValidPosition(lowerLeft) && getBall(grid, lowerLeft) === null;
    const rightEmpty = isValidPosition(lowerRight) && getBall(grid, lowerRight) === null;

    // When both paths are open, always prefer right (gravity rule 2).
    if (leftEmpty && rightEmpty) {
      current = lowerRight;
    } else if (rightEmpty) {
      current = lowerRight;
    } else if (leftEmpty) {
      current = lowerLeft;
    } else {
      return current;
    }
  }
}

/** A ball displacement produced by gravity, preserving ball identity. */
export interface BallMove {
  from: GridPosition;
  to: GridPosition;
  color: BallColor;
}

/**
 * Apply gravity and report which ball moved where (identity-preserving),
 * so the renderer can animate each ball along its own path.
 */
export function settleWithMoves(grid: Grid): { grid: Grid; moves: BallMove[] } {
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

  // Sort balls by row (process bottom balls first for right-side priority)
  balls.sort((a, b) => a.position.row - b.position.row);

  const moves: BallMove[] = [];
  for (const ball of balls) {
    const dest = findFallDestination(newGrid, ball.position);
    setBall(newGrid, dest, { color: ball.color, position: dest });
    if (dest.row !== ball.position.row || dest.col !== ball.position.col) {
      moves.push({ from: ball.position, to: dest, color: ball.color });
    }
  }

  return { grid: newGrid, moves };
}

/**
 * Apply gravity to the grid, making all balls fall to stable positions.
 * Returns a new grid with balls in their final positions.
 */
export function applyGravity(grid: Grid): Grid {
  return settleWithMoves(grid).grid;
}
