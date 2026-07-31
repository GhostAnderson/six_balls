import { useRef, useEffect } from 'react';
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  type Grid, type TrianglePiece, type GridPosition, type FallingPiece, type Attack,
  getRowWidth, getPieceBallPositions, movePiece, canPlacePiece, getSpeedInterval,
  computeLandingSteps, type LandingSteps,
  ballOffsets, maxDrop, snapToCells, settleWithMoves,
} from '@six-balls/shared';
import type { LandingEvent } from '../game/localGame';

const HEX_SIZE = 36;
const BALL_RADIUS = 18;
const Y_SPACING = HEX_SIZE * Math.sqrt(3) / 2;
const PADDING_X = 48;
const PADDING_TOP = 78;      // headroom: rows 10-11 (spawn zone) live above the frame
const PADDING_BOTTOM = 4;
const TOTAL_ROWS = 12;
const CANVAS_W = PADDING_X * 2 + 9 * HEX_SIZE;

function rowY(row: number): number {
  return PADDING_TOP + (TOTAL_ROWS - 1 - row) * Y_SPACING;
}

const CANVAS_H = Math.ceil(rowY(0) + BALL_RADIUS + PADDING_BOTTOM);
const FRAME_TOP = Math.round((rowY(10) + rowY(9)) / 2);
const ENTRY_LIFT = Y_SPACING * 1.6;

const HEX_COLORS: Record<string, string> = {
  red: '#ff3355', purple: '#c44dff', yellow: '#ffb020', blue: '#3b7dff', green: '#3ed44e',
};
const COLOR_NUM: Record<string, number> = Object.fromEntries(
  Object.entries(HEX_COLORS).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
);
const NEON_MINE = 0x33e0ff;
const NEON_OPP = 0xff44dd;

export interface BoardProps {
  grid: Grid;
  currentPiece: TrianglePiece | null;
  startTime: number | null;
  isMyBoard?: boolean;
  /** Continuous-fall piece getter (local mode); replaces currentPiece rendering. */
  falling?: (() => FallingPiece | null) | null;
  /** Landing event from the continuous engine (local mode). */
  landing?: LandingEvent | null;
  /** Queued attacks waiting to drop on this board (shown hovering above the field). */
  pendingAttacks?: Attack[] | null;
}

function unitToPx(u: { x: number; y: number }): { x: number; y: number } {
  return { x: PADDING_X + u.x * HEX_SIZE, y: rowY(0) - u.y * HEX_SIZE };
}

function posToCanvas(pos: GridPosition): { x: number; y: number } {
  const x = PADDING_X + pos.col * HEX_SIZE + (pos.row % 2 === 0 ? 0 : HEX_SIZE / 2);
  return { x, y: rowY(pos.row) };
}

function pieceVisualOffsets(piece: TrianglePiece): { dx: number; dy: number }[] {
  const ref: TrianglePiece = { ...piece, position: { row: 10, col: 4 } };
  return getPieceBallPositions(ref).map(p => ({
    dx: (p.col - 4) * HEX_SIZE + (p.row % 2 === 0 ? 0 : HEX_SIZE / 2),
    dy: (10 - p.row) * Y_SPACING,
  }));
}

function anchorX(col: number): number {
  return PADDING_X + col * HEX_SIZE;
}

function entryLift(anchorY: number): number {
  const t = Math.max(0, Math.min(1, (rowY(8) - anchorY) / (2 * Y_SPACING)));
  return ENTRY_LIFT * t;
}

interface DrawSpec { x: number; y: number; color: string }
interface RollBall { fromX: number; fromY: number; toX: number; toY: number; color: string; delay?: number }
type Phase =
  | { kind: 'roll'; statics: DrawSpec[]; movers: RollBall[]; duration: number; moveDur: number; start?: number }
  | { kind: 'burst'; statics: DrawSpec[]; bursts: DrawSpec[]; duration: number; start?: number };

function posKey(p: GridPosition): string {
  return `${p.row},${p.col}`;
}

function gridsEqual(a: Grid, b: Grid): boolean {
  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < getRowWidth(row); col++) {
      if ((a[row][col]?.color ?? null) !== (b[row][col]?.color ?? null)) return false;
    }
  }
  return true;
}

type SimGrid = (string | null)[][];

function simDraw(sim: SimGrid, skip?: Set<string>): DrawSpec[] {
  const out: DrawSpec[] = [];
  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < getRowWidth(row); col++) {
      const color = sim[row][col];
      if (!color || skip?.has(`${row},${col}`)) continue;
      out.push({ ...posToCanvas({ row, col }), color });
    }
  }
  return out;
}

/** Build the phase list that replays a landing: roll into notches, burst, cascade. */
function buildLandingPhases(prevGrid: Grid, steps: LandingSteps, fromPx: { x: number; y: number }[]): Phase[] {
  const phases: Phase[] = [];
  const sim: SimGrid = prevGrid.map(r => r.map(c => (c ? c.color : null)));

  const moveMap = new Map(steps.settleMoves.map(m => [posKey(m.from), m.to]));
  const movers: RollBall[] = steps.placed.map((p, i) => {
    const to = moveMap.get(posKey(p.pos)) ?? p.pos;
    const toXY = posToCanvas(to);
    const from = fromPx[i] ?? toXY;
    return { fromX: from.x, fromY: from.y, toX: toXY.x, toY: toXY.y, color: p.color };
  });
  phases.push({ kind: 'roll', statics: simDraw(sim), movers, duration: 230, moveDur: 230 });
  for (const p of steps.placed) {
    const to = moveMap.get(posKey(p.pos)) ?? p.pos;
    sim[to.row][to.col] = p.color;
  }

  for (const round of steps.clearRounds) {
    const clearedKeys = new Set(round.cleared.map(c => posKey(c.pos)));
    phases.push({
      kind: 'burst',
      statics: simDraw(sim, clearedKeys),
      bursts: round.cleared.map(c => ({ ...posToCanvas(c.pos), color: c.color })),
      duration: 380,
    });
    for (const c of round.cleared) sim[c.pos.row][c.pos.col] = null;

    if (round.settleMoves.length > 0) {
      const movingKeys = new Set(round.settleMoves.map(m => posKey(m.from)));
      phases.push({
        kind: 'roll',
        statics: simDraw(sim, movingKeys),
        movers: round.settleMoves.map(m => {
          const from = posToCanvas(m.from);
          const to = posToCanvas(m.to);
          return { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, color: m.color };
        }),
        duration: 220,
        moveDur: 220,
      });
      for (const m of round.settleMoves) {
        sim[m.from.row][m.from.col] = null;
        sim[m.to.row][m.to.col] = m.color;
      }
    }
  }

  return phases;
}

/**
 * Animation for grid changes that are not a piece landing (attack garbage):
 * burst vanished balls, then rain new ones from above with a staggered shower.
 */
function buildDiffPhases(prevGrid: Grid, next: Grid): Phase[] {
  const statics: DrawSpec[] = [];
  const removed: DrawSpec[] = [];
  const rained: RollBall[] = [];
  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < getRowWidth(row); col++) {
      const before = prevGrid[row][col]?.color ?? null;
      const after = next[row][col]?.color ?? null;
      const xy = posToCanvas({ row, col });
      if (before && before === after) {
        statics.push({ ...xy, color: before });
      } else {
        if (before) removed.push({ ...xy, color: before });
        if (after) {
          rained.push({
            fromX: xy.x, fromY: Math.max(8, xy.y - 320),
            toX: xy.x, toY: xy.y, color: after,
            // Bottom rows land first; within a row, a hash scatters drops evenly L/R
            delay: row * 100 + ((col * 7 + row * 13) % 23),
          });
        }
      }
    }
  }
  const phases: Phase[] = [];
  if (removed.length > 0) phases.push({ kind: 'burst', statics, bursts: removed, duration: 380 });
  if (rained.length > 0) {
    // Order the shower by hash so drops land evenly across the board, 90ms apart
    const STEP = 90;
    rained.sort((a, b) => a.delay! - b.delay!);
    rained.forEach((m, i) => { m.delay = i * STEP; });
    const MOVE = 320;
    const maxDelay = (rained.length - 1) * STEP;
    phases.push({ kind: 'roll', statics, movers: rained, duration: MOVE + maxDelay, moveDur: MOVE });
  }
  return phases;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Pre-render a glossy marble. */
function makeBallCanvas(colorKey: string): HTMLCanvasElement {
  const base = HEX_COLORS[colorKey] ?? '#cccccc';
  const rVal = parseInt(base.slice(1, 3), 16);
  const gVal = parseInt(base.slice(3, 5), 16);
  const bVal = parseInt(base.slice(5, 7), 16);
  const hi = `rgb(${Math.min(255, rVal + 140)},${Math.min(255, gVal + 140)},${Math.min(255, bVal + 140)})`;
  const dark = `rgb(${Math.floor(rVal * 0.45)},${Math.floor(gVal * 0.45)},${Math.floor(bVal * 0.45)})`;
  const R = BALL_RADIUS;
  const S = (R + 2) * 2;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;
  const c = S / 2;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(c - R * 0.3, c - R * 0.38, R * 0.08, c, c, R);
  grad.addColorStop(0, hi);
  grad.addColorStop(0.55, base);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c - R * 0.35, c - R * 0.42, R * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  return cv;
}

/** Pre-render a soft colored halo (drawn additively beneath each ball). */
function makeGlowCanvas(colorKey: string): HTMLCanvasElement {
  const base = HEX_COLORS[colorKey] ?? '#cccccc';
  const R = BALL_RADIUS * 2.4;
  const S = Math.ceil(R * 2);
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createRadialGradient(S / 2, S / 2, BALL_RADIUS * 0.4, S / 2, S / 2, R);
  grad.addColorStop(0, base + '66');
  grad.addColorStop(0.45, base + '2a');
  grad.addColorStop(1, base + '00');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  return cv;
}

/** Burst effect (drawn on an additive layer): pop, ring wave, particles. */
function drawBurst(g: Graphics, x: number, y: number, colorKey: string, t: number) {
  const color = COLOR_NUM[colorKey] ?? 0xcccccc;
  if (t < 0.55) {
    const scale = t < 0.25 ? 1 + 0.45 * (t / 0.25) : 1.45 - 0.35 * ((t - 0.25) / 0.3);
    g.circle(x, y, BALL_RADIUS * scale).fill({ color, alpha: 0.9 });
  }
  const ringAlpha = 0.8 * (1 - t);
  if (ringAlpha > 0) {
    g.circle(x, y, BALL_RADIUS * (0.4 + t * 2.4)).stroke({ width: 3, color, alpha: ringAlpha });
  }
  if (t < 0.5) {
    const pt = t / 0.5;
    for (let i = 0; i < 10; i++) {
      const angle = (i * 36 * Math.PI) / 180;
      const dist = (24 + (i % 3) * 6) * pt;
      const pAlpha = pt < 0.7 ? 0.9 : 0.9 * (1 - (pt - 0.7) / 0.3);
      g.circle(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, 4.5 * (1 - pt * 0.5))
        .fill({ color, alpha: pAlpha });
    }
  }
}

function drawDashedCircle(g: Graphics, x: number, y: number, r: number) {
  const SEGMENTS = 10;
  const span = (Math.PI * 2) / SEGMENTS;
  for (let i = 0; i < SEGMENTS; i++) {
    const a0 = i * span;
    g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
    g.arc(x, y, r, a0, a0 + span * 0.55);
  }
  g.stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
}

/**
 * Hovering preview of queued garbage above the field. Each attack type has
 * its own silhouette: hexagon rings, full-row strips, or small triangles.
 */
function drawGarbagePreview(g: Graphics, attacks: Attack[], now: number) {
  const D = 11;
  let x = 16;
  let y = 16;
  const bob = (px: number) => Math.sin(now / 340 + px * 0.06) * 2;
  const dot = (dx: number, dy: number) => {
    g.circle(x + dx, y + dy + bob(x + dx), 4.6)
      .fill({ color: 0xdfe6ff, alpha: 0.5 })
      .stroke({ width: 1, color: 0xffffff, alpha: 0.35 });
  };
  const advance = (w: number) => {
    x += w;
    if (x > CANVAS_W - 110) { x = 16; y += 26; }
  };

  for (const a of attacks) {
    for (let u = 0; u < a.count; u++) {
      if (y > FRAME_TOP - 24) return;   // out of headroom space
      if (a.type === 'triangles') {
        // Full 1+2+3 pyramid silhouette
        dot(D, 0);
        dot(D / 2, D * 0.87); dot(D * 1.5, D * 0.87);
        dot(0, D * 1.74); dot(D, D * 1.74); dot(D * 2, D * 1.74);
        advance(D * 3 + 8);
      } else if (a.type === 'hexagonRings') {
        for (let k = 0; k < 6; k++) {
          const ang = (k * 60 * Math.PI) / 180;
          dot(D + Math.cos(ang) * D, D * 0.8 + Math.sin(ang) * D);
        }
        advance(D * 3 + 8);
      } else {
        for (let i = 0; i < 8; i++) dot(i * D, D * 0.4);
        advance(D * 8 + 12);
      }
    }
  }
}

export default function Board({
  grid, currentPiece, startTime, isMyBoard = false,
  falling = null, landing = null, pendingAttacks = null,
}: BoardProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  const gridRef = useRef(grid);
  const currentPieceRef = useRef(currentPiece);
  const startTimeRef = useRef(startTime);
  const prevGridRef = useRef<Grid>(grid);
  const phaseQueueRef = useRef<Phase[]>([]);
  const fallingRef = useRef(falling);
  fallingRef.current = falling;
  const pendingRef = useRef(pendingAttacks);
  pendingRef.current = pendingAttacks;
  const landingNonceRef = useRef(0);
  const displayAngleRef = useRef(0);
  const targetAngleRef = useRef(0);
  const lastRotationRef = useRef(0);
  const lastPieceIdRef = useRef<number | null>(null);

  // Online-mode fall interpolation (grid-stepped)
  const fallAnimRef = useRef<{ fromY: number; toY: number; t0: number; dur: number } | null>(null);
  const xAnimRef = useRef<{ fromX: number; toX: number; t0: number } | null>(null);
  const X_DUR = 90;

  function drawnAnchorY(piece: TrianglePiece, now: number): number {
    const fa = fallAnimRef.current;
    if (!fa) return rowY(piece.position.row);
    const t = Math.min((now - fa.t0) / fa.dur, 1);
    return fa.fromY + (fa.toY - fa.fromY) * t;
  }

  function drawnAnchorX(piece: TrianglePiece, now: number): number {
    const xa = xAnimRef.current;
    if (!xa) return anchorX(piece.position.col);
    const t = Math.min((now - xa.t0) / X_DUR, 1);
    return xa.fromX + (xa.toX - xa.fromX) * easeOut(t);
  }

  useEffect(() => {
    const prevPiece = currentPieceRef.current;
    const prevGrid = prevGridRef.current;
    const now = Date.now();

    if (!prevPiece || !currentPiece) {
      fallAnimRef.current = null;
      xAnimRef.current = null;
    } else {
      const dr = prevPiece.position.row - currentPiece.position.row;
      const dc = currentPiece.position.col - prevPiece.position.col;
      if (dr === 1 && dc === 0 && prevPiece.rotation === currentPiece.rotation) {
        const interval = startTime ? getSpeedInterval(now - startTime) : 1000;
        fallAnimRef.current = {
          fromY: drawnAnchorY(prevPiece, now),
          toY: rowY(currentPiece.position.row),
          t0: now,
          dur: interval,
        };
      } else if (dr === 0 && dc !== 0) {
        xAnimRef.current = { fromX: drawnAnchorX(prevPiece, now), toX: anchorX(currentPiece.position.col), t0: now };
      } else if (dr < 0) {
        fallAnimRef.current = null;
        xAnimRef.current = null;
      }
    }

    if (landing && landing.nonce !== landingNonceRef.current) {
      landingNonceRef.current = landing.nonce;
      const fromPx = landing.lockedBalls.map(unitToPx);
      let phases = buildLandingPhases(prevGrid, landing.steps, fromPx);
      if (!gridsEqual(landing.steps.finalGrid, grid)) {
        phases = phases.concat(buildDiffPhases(landing.steps.finalGrid, grid));
      }
      phaseQueueRef.current = phases;
    } else if (prevGrid !== grid && !gridsEqual(prevGrid, grid)) {
      let animated = false;
      if (prevPiece) {
        let locked = prevPiece;
        while (true) {
          const next = movePiece(locked, 'down');
          if (canPlacePiece(prevGrid, next)) locked = next; else break;
        }
        const steps = computeLandingSteps(prevGrid, locked);
        if (gridsEqual(steps.finalGrid, grid)) {
          const offs = pieceVisualOffsets(locked);
          const ax = anchorX(locked.position.col);
          const ay = rowY(locked.position.row);
          const fromPx = offs.map(o => ({ x: ax + o.dx, y: ay + o.dy }));
          phaseQueueRef.current = buildLandingPhases(prevGrid, steps, fromPx);
          animated = true;
        }
      }
      if (!animated) phaseQueueRef.current = buildDiffPhases(prevGrid, grid);
    }

    currentPieceRef.current = currentPiece;
    prevGridRef.current = grid;
    startTimeRef.current = startTime;
    gridRef.current = grid;
  }, [grid, currentPiece, startTime, landing]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let destroyed = false;
    let app: Application | null = null;

    (async () => {
      const a = new Application();
      await a.init({
        width: CANVAS_W, height: CANVAS_H,
        backgroundAlpha: 0, antialias: true,
        autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (destroyed) { a.destroy(true); return; }
      app = a;
      host.appendChild(a.canvas);

      const root = new Container();
      a.stage.addChild(root);

      // Neon frame: layered strokes give a controlled glow (no fullscreen filter)
      const frameG = new Graphics();
      const neon = isMyBoard ? NEON_MINE : NEON_OPP;
      frameG.roundRect(3, FRAME_TOP, CANVAS_W - 6, CANVAS_H - FRAME_TOP - 3, 6)
        .fill({ color: 0x060a22, alpha: 0.4 });
      for (const [w, alpha] of [[12, 0.08], [6, 0.2], [3, 1]] as const) {
        frameG.roundRect(3, FRAME_TOP, CANVAS_W - 6, CANVAS_H - FRAME_TOP - 3, 6)
          .stroke({ width: w, color: neon, alpha });
      }
      for (const [w, alpha] of [[10, 0.1], [5, 0.28], [2.5, 1]] as const) {
        frameG.moveTo(0, FRAME_TOP).lineTo(CANVAS_W, FRAME_TOP)
          .stroke({ width: w, color: 0xffffff, alpha });
      }
      root.addChild(frameG);

      const garbageG = new Graphics();
      root.addChild(garbageG);

      const ghostG = new Graphics();
      root.addChild(ghostG);

      const glowLayer = new Container();
      glowLayer.blendMode = 'add';
      root.addChild(glowLayer);

      const ballLayer = new Container();
      root.addChild(ballLayer);

      const fxG = new Graphics();
      fxG.blendMode = 'add';
      root.addChild(fxG);

      const ballTex: Record<string, Texture> = {};
      const glowTex: Record<string, Texture> = {};
      for (const key of Object.keys(HEX_COLORS)) {
        ballTex[key] = Texture.from(makeBallCanvas(key));
        glowTex[key] = Texture.from(makeGlowCanvas(key));
      }

      const ballPool: Sprite[] = [];
      const glowPool: Sprite[] = [];
      function ensure(pool: Sprite[], layer: Container, i: number): Sprite {
        while (pool.length <= i) {
          const s = new Sprite();
          s.anchor.set(0.5);
          layer.addChild(s);
          pool.push(s);
        }
        return pool[i];
      }

      let used = 0;
      function putBall(x: number, y: number, color: string, glowScale = 1, glowAlpha = 0.5) {
        const b = ensure(ballPool, ballLayer, used);
        b.visible = true;
        b.texture = ballTex[color] ?? ballTex.red;
        b.position.set(x, y);
        const gl = ensure(glowPool, glowLayer, used);
        gl.visible = true;
        gl.texture = glowTex[color] ?? glowTex.red;
        gl.position.set(x, y);
        gl.scale.set(glowScale);
        gl.alpha = glowAlpha;
        used++;
      }

      a.ticker.add(() => {
        const now = Date.now();
        const piece = currentPieceRef.current;
        const g = gridRef.current;
        used = 0;
        fxG.clear();
        ghostG.clear();
        garbageG.clear();

        // Queued garbage hovering above the field
        const pending = pendingRef.current;
        if (pending && pending.length > 0) {
          drawGarbagePreview(garbageG, pending, now);
        }

        // Static balls / landing animation phases
        const queue = phaseQueueRef.current;
        const phase = queue[0];
        if (phase) {
          if (phase.start === undefined) phase.start = now;
          const elapsed = now - phase.start;
          const t = Math.min(elapsed / phase.duration, 1);
          for (const b of phase.statics) putBall(b.x, b.y, b.color);
          if (phase.kind === 'roll') {
            for (const m of phase.movers) {
              const mt = Math.min(Math.max((elapsed - (m.delay ?? 0)) / phase.moveDur, 0), 1);
              const e = easeOut(mt);
              putBall(m.fromX + (m.toX - m.fromX) * e, m.fromY + (m.toY - m.fromY) * e, m.color);
            }
          } else {
            for (const b of phase.bursts) drawBurst(fxG, b.x, b.y, b.color, t);
          }
          if (t >= 1) queue.shift();
        } else {
          for (let row = 0; row < TOTAL_ROWS; row++) {
            for (let col = 0; col < getRowWidth(row); col++) {
              const ball = g[row][col];
              if (!ball) continue;
              const { x, y } = posToCanvas({ row, col });
              putBall(x, y, ball.color);
            }
          }
        }

        // Falling piece
        const f = fallingRef.current ? fallingRef.current() : null;
        if (f) {
          const dropped = { ...f, y: f.y - maxDrop(g, f) };
          const placedGhost = snapToCells(g, dropped);
          const temp = g.map(r => [...r]);
          for (const c of placedGhost) {
            temp[c.pos.row][c.pos.col] = { color: c.color, position: c.pos };
          }
          const ghostMoves = new Map(settleWithMoves(temp).moves.map(m => [posKey(m.from), m.to]));
          for (const c of placedGhost) {
            const pos = ghostMoves.get(posKey(c.pos)) ?? c.pos;
            const { x, y } = posToCanvas(pos);
            drawDashedCircle(ghostG, x, y, BALL_RADIUS - 1);
          }

          if (f.id !== lastPieceIdRef.current) {
            // New piece: snap the angle state, no carried-over spin
            lastPieceIdRef.current = f.id ?? null;
            lastRotationRef.current = f.rotation;
            targetAngleRef.current = f.rotation * 60;
            displayAngleRef.current = f.rotation * 60;
          } else {
            const steps = (f.rotation - lastRotationRef.current + 6) % 6;
            if (steps > 0) {
              targetAngleRef.current += steps * 60;
              lastRotationRef.current = f.rotation;
            }
          }
          const diff = targetAngleRef.current - displayAngleRef.current;
          displayAngleRef.current += Math.max(-16, Math.min(16, diff));

          const c = unitToPx({ x: f.x, y: f.y });
          const offs = ballOffsets(displayAngleRef.current, true);
          for (let i = 0; i < 3; i++) {
            const bx = c.x + offs[i].x * HEX_SIZE;
            const by = c.y - offs[i].y * HEX_SIZE;
            putBall(bx, by, f.colors[i], 1.3, 0.85);
            fxG.circle(bx, by, BALL_RADIUS + 3).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
          }
        } else if (piece) {
          let ghost = piece;
          while (true) {
            const next = movePiece(ghost, 'down');
            if (canPlacePiece(g, next)) ghost = next; else break;
          }
          if (ghost.position.row !== piece.position.row) {
            const gPos = getPieceBallPositions(ghost);
            for (let i = 0; i < 3; i++) {
              const { x, y } = posToCanvas(gPos[i]);
              drawDashedCircle(ghostG, x, y, BALL_RADIUS - 1);
            }
          }

          const ax = drawnAnchorX(piece, now);
          const ay = drawnAnchorY(piece, now);
          const lift = entryLift(ay);
          const offs = pieceVisualOffsets(piece);
          for (let i = 0; i < 3; i++) {
            const bx = ax + offs[i].dx;
            const by = ay + offs[i].dy - lift;
            putBall(bx, by, piece.colors[i], 1.3, 0.85);
            fxG.circle(bx, by, BALL_RADIUS + 3).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
          }
        }

        for (let i = used; i < ballPool.length; i++) {
          ballPool[i].visible = false;
          glowPool[i].visible = false;
        }
      });
    })();

    return () => {
      destroyed = true;
      if (app) {
        app.destroy(true, { children: true, texture: true });
        app = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyBoard]);

  return (
    <div
      ref={hostRef}
      style={{ width: CANVAS_W, height: CANVAS_H, display: 'block' }}
    />
  );
}
