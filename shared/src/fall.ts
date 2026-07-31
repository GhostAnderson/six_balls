import { GRID_HEIGHT, type BallColor, type GridPosition } from './types';
import { getRowWidth, getBall, type Grid } from './grid';

/**
 * Continuous-space falling piece (the original-game model): the piece lives
 * in free space with a centroid position and rotates about its centroid.
 * Only when it locks do its balls snap into hex-grid cells.
 *
 * Units: x is in column units (even-row col c has center x = c; odd-row
 * col c has center x = c + 0.5). y is in row units, y-up, bottom row = 0.
 * Balls have radius 0.5, so touching balls are 1 unit apart.
 */
export interface FallingPiece {
  x: number;          // centroid x
  y: number;          // centroid y
  rotation: number;   // 0-5, each step 60° clockwise
  colors: [BallColor, BallColor, BallColor];
  /** Unique per spawned piece; lets the renderer reset per-piece animation state. */
  id?: number;
}

/** Circumradius of the equilateral 3-ball triangle (side = 1). */
export const PIECE_RADIUS = 1 / Math.sqrt(3);

/** Euclidean vertical distance between adjacent hex rows (side = 1). */
export const ROW_H = Math.sqrt(3) / 2;

const MIN_X = 0;
const MAX_X = 9;
const CONTACT = 0.999;   // center distance at which balls touch
const EPS = 1e-6;

/** Ball center offsets from the centroid for a given rotation (0-5) or continuous angle in degrees. */
export function ballOffsets(rotationOrDeg: number, continuousDeg = false): { x: number; y: number }[] {
  const angleDeg = continuousDeg ? rotationOrDeg : rotationOrDeg * 60;
  return [0, 1, 2].map(i => {
    const theta = ((90 - 120 * i - angleDeg) * Math.PI) / 180;
    return { x: PIECE_RADIUS * Math.cos(theta), y: PIECE_RADIUS * Math.sin(theta) };
  });
}

/** Absolute ball centers of a falling piece. */
export function ballPositions(piece: FallingPiece): { x: number; y: number }[] {
  return ballOffsets(piece.rotation).map(o => ({ x: piece.x + o.x, y: piece.y + o.y }));
}

/** Center of a settled grid cell in piece units (euclidean, y-up). */
export function cellCenter(pos: GridPosition): { x: number; y: number } {
  return { x: pos.col + (pos.row % 2 === 0 ? 0 : 0.5), y: pos.row * ROW_H };
}

function settledCenters(grid: Grid): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let row = 0; row < GRID_HEIGHT; row++) {
    for (let col = 0; col < getRowWidth(row); col++) {
      if (getBall(grid, { row, col })) out.push(cellCenter({ row, col }));
    }
  }
  return out;
}

/** Spawn a new piece centered above the field. */
export function spawnFalling(colors: [BallColor, BallColor, BallColor]): FallingPiece {
  return { x: 4.5, y: (GRID_HEIGHT + 0.8) * ROW_H, rotation: 0, colors };
}

/**
 * How far the piece can fall (in row units) before any ball contacts
 * the floor or a settled ball. 0 means it is already resting.
 */
export function maxDrop(grid: Grid, piece: FallingPiece): number {
  const balls = ballPositions(piece);
  const settled = settledCenters(grid);
  let md = Infinity;

  for (const b of balls) {
    md = Math.min(md, b.y);  // floor: rest when center reaches y = 0
    for (const s of settled) {
      const dx = b.x - s.x;
      if (Math.abs(dx) >= CONTACT) continue;
      if (s.y > b.y + EPS) continue;              // only balls below matter
      const contactY = s.y + Math.sqrt(CONTACT * CONTACT - dx * dx);
      md = Math.min(md, b.y - contactY);
    }
  }
  return Math.max(0, md);
}

function collides(grid: Grid, piece: FallingPiece, settled?: { x: number; y: number }[]): boolean {
  const balls = ballPositions(piece);
  const centers = settled ?? settledCenters(grid);
  for (const b of balls) {
    if (b.x < MIN_X - EPS || b.x > MAX_X + EPS || b.y < -EPS) return true;
    for (const s of centers) {
      const dx = b.x - s.x;
      const dy = b.y - s.y;
      if (dx * dx + dy * dy < CONTACT * CONTACT - EPS) return true;
    }
  }
  return false;
}

/**
 * Move the piece horizontally by dx (may be negative), sliding in small
 * substeps and stopping at walls or settled balls. Returns the new piece.
 */
export function moveX(grid: Grid, piece: FallingPiece, dx: number): FallingPiece {
  const settled = settledCenters(grid);
  const STEP = 0.05;
  const dir = Math.sign(dx);
  let remaining = Math.abs(dx);
  let current = piece;
  while (remaining > EPS) {
    const step = Math.min(STEP, remaining);
    const next = { ...current, x: current.x + dir * step };
    if (collides(grid, next, settled)) break;
    current = next;
    remaining -= step;
  }
  return current;
}

/**
 * Rotate 60° clockwise about the centroid, with small horizontal
 * wall-kick attempts. Returns the rotated piece, or null if blocked.
 */
export function tryRotate(grid: Grid, piece: FallingPiece): FallingPiece | null {
  const settled = settledCenters(grid);
  const rotated = { ...piece, rotation: (piece.rotation + 1) % 6 };
  for (const kick of [0, 0.3, -0.3, 0.55, -0.55]) {
    const candidate = { ...rotated, x: rotated.x + kick };
    if (!collides(grid, candidate, settled)) return candidate;
  }
  return null;
}

/**
 * Snap the piece's balls into grid cells at lock time: each ball takes the
 * nearest empty valid cell (lowest balls assigned first). Balls with no
 * available cell (completely full board) are dropped.
 */
export function snapToCells(grid: Grid, piece: FallingPiece): { pos: GridPosition; color: BallColor; src: { x: number; y: number } }[] {
  const balls = ballPositions(piece)
    .map((p, i) => ({ ...p, color: piece.colors[i] }))
    .sort((a, b) => a.y - b.y);

  const taken = new Set<string>();
  const placed: { pos: GridPosition; color: BallColor; src: { x: number; y: number } }[] = [];

  for (const b of balls) {
    let best: GridPosition | null = null;
    let bestD = Infinity;
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let col = 0; col < getRowWidth(row); col++) {
        const key = `${row},${col}`;
        if (taken.has(key) || getBall(grid, { row, col })) continue;
        const c = cellCenter({ row, col });
        const d = (c.x - b.x) ** 2 + (c.y - b.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { row, col };
        }
      }
    }
    if (best) {
      taken.add(`${best.row},${best.col}`);
      placed.push({ pos: best, color: b.color, src: { x: b.x, y: b.y } });
    }
  }
  return placed;
}
