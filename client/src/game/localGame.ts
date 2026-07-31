import {
  resolvePlacement, isGameOver, applyAttacks, createEmptyGrid, createRNG, createPieceAtSpawn,
  getSpeedInterval, spawnFalling, maxDrop, moveX, tryRotate, snapToCells, ROW_H,
  type GameState, type PlayerState, type TrianglePiece, type FallingPiece, type LandingSteps,
} from '@six-balls/shared';

export type HeldControl = 'left' | 'right' | 'soft';

/** Emitted once per lock so the renderer can play the landing animation. */
export interface LandingEvent {
  steps: LandingSteps;
  /** Ball centers (piece units) at the moment of lock, in colors order. */
  lockedBalls: { x: number; y: number }[];
  nonce: number;
}

const H_SPEED = 7;        // columns per second while holding left/right
const SOFT_MULT = 12;     // fall speed multiplier while holding down

interface LocalPlayerSim {
  falling: FallingPiece | null;
  controls: Record<HeldControl, boolean>;
  /** When set, the next piece spawns at this timestamp (frozen during garbage rain). */
  spawnAt: number | null;
}

export class LocalGameEngine {
  state: GameState;
  sims: [LocalPlayerSim, LocalPlayerSim];
  landings: [LandingEvent | null, LandingEvent | null] = [null, null];
  /** Bumps on every discrete change (lock, game over) so React can re-render cheaply. */
  version = 0;
  private lastTick = Date.now();
  private nonce = 0;
  private spawnSerial = 0;

  private newPiece(colors: TrianglePiece['colors']): FallingPiece {
    return { ...spawnFalling(colors), id: ++this.spawnSerial };
  }

  constructor() {
    const rng = createRNG(Date.now());
    const seq: TrianglePiece[] = Array.from({ length: 200 }, () => createPieceAtSpawn(rng));
    this.state = {
      phase: 'playing',
      players: [this.makePlayer('player1', seq, 0), this.makePlayer('player2', seq, 0)],
      startTime: Date.now(),
      winner: null,
      pieceSequence: seq,
    };
    this.sims = [
      { falling: this.newPiece(seq[0].colors), controls: { left: false, right: false, soft: false }, spawnAt: null },
      { falling: this.newPiece(seq[0].colors), controls: { left: false, right: false, soft: false }, spawnAt: null },
    ];
  }

  private makePlayer(id: string, seq: TrianglePiece[], idx: number): PlayerState {
    return {
      id, grid: createEmptyGrid(),
      currentPiece: null,           // continuous sim replaces grid-bound falling pieces
      nextPiece: seq[idx + 1],
      pieceIndex: idx,
      attackQueue: [], isAlive: true,
    };
  }

  getFalling(pi: 0 | 1): FallingPiece | null {
    return this.sims[pi].falling;
  }

  setControl(pi: 0 | 1, control: HeldControl, pressed: boolean) {
    this.sims[pi].controls[control] = pressed;
  }

  rotate(pi: 0 | 1) {
    if (this.state.phase !== 'playing') return;
    const sim = this.sims[pi];
    if (!sim.falling) return;
    const rotated = tryRotate(this.state.players[pi].grid, sim.falling);
    if (rotated) sim.falling = rotated;
  }

  hardDrop(pi: 0 | 1) {
    if (this.state.phase !== 'playing') return;
    const sim = this.sims[pi];
    if (!sim.falling) return;
    const grid = this.state.players[pi].grid;
    sim.falling = { ...sim.falling, y: sim.falling.y - maxDrop(grid, sim.falling) };
    this.lock(pi);
  }

  /** Advance the simulation. Call every animation frame. */
  tick(now: number) {
    const dt = Math.min((now - this.lastTick) / 1000, 0.1);
    this.lastTick = now;
    if (this.state.phase !== 'playing') return;

    for (const pi of [0, 1] as const) {
      const sim = this.sims[pi];
      const player = this.state.players[pi];
      if (!player.isAlive) continue;
      if (!sim.falling) {
        // Frozen while garbage rains down; spawn the next piece when it ends
        if (sim.spawnAt !== null && now >= sim.spawnAt) {
          sim.falling = this.newPiece(this.state.pieceSequence[player.pieceIndex].colors);
          sim.spawnAt = null;
        }
        continue;
      }
      const grid = player.grid;

      // Horizontal: continuous slide while held
      const dir = (sim.controls.right ? 1 : 0) - (sim.controls.left ? 1 : 0);
      if (dir !== 0) {
        sim.falling = moveX(grid, sim.falling, dir * H_SPEED * dt);
      }

      // Vertical: continuous fall (rows/sec converted to euclidean units)
      const elapsed = now - (this.state.startTime ?? now);
      const baseSpeed = (1000 / getSpeedInterval(elapsed)) * ROW_H;
      const speed = sim.controls.soft ? baseSpeed * SOFT_MULT : baseSpeed;
      const want = speed * dt;
      const allowed = maxDrop(grid, sim.falling);
      if (want < allowed) {
        sim.falling = { ...sim.falling, y: sim.falling.y - want };
      } else {
        sim.falling = { ...sim.falling, y: sim.falling.y - allowed };
        this.lock(pi);
      }
    }
  }

  private lock(pi: 0 | 1) {
    const sim = this.sims[pi];
    const p = this.state.players[pi];
    const oi = pi === 0 ? 1 : 0;
    if (!sim.falling) return;

    const placed = snapToCells(p.grid, sim.falling);
    const lockedBalls = placed.map(c => c.src);
    const steps = resolvePlacement(p.grid, placed);

    // Queued attacks rain down after the landing settles
    const grid = p.attackQueue.length > 0 ? applyAttacks(steps.finalGrid, p.attackQueue) : steps.finalGrid;
    // While the garbage rain animation plays, the attacked player loses control.
    // Timings mirror the renderer: 380ms burst + 320ms fall + 90ms per-ball stagger.
    let freezeMs = 0;
    if (p.attackQueue.length > 0) {
      let added = 0;
      let removed = 0;
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          const before = steps.finalGrid[row][col]?.color ?? null;
          const after = grid[row][col]?.color ?? null;
          if (before && before !== after) removed++;
          if (after && after !== before) added++;
        }
      }
      freezeMs = (removed > 0 ? 380 : 0) + (added > 0 ? 320 + (added - 1) * 90 : 0) + 150;
    }
    const ni = p.pieceIndex + 1;
    const dead = isGameOver(grid, this.state.pieceSequence[ni]);

    const np2 = [...this.state.players] as [PlayerState, PlayerState];
    np2[pi] = {
      ...p, grid,
      currentPiece: null,
      nextPiece: this.state.pieceSequence[ni + 1],
      pieceIndex: ni,
      attackQueue: [],
      isAlive: !dead,
    };
    if (steps.attacks.length > 0) {
      np2[oi] = { ...np2[oi], attackQueue: [...np2[oi].attackQueue, ...steps.attacks] };
    }

    let w: string | null = null;
    if (!np2[0].isAlive) w = np2[1].id;
    if (!np2[1].isAlive) w = np2[0].id;
    this.state = { ...this.state, players: np2, phase: w ? 'ended' : 'playing', winner: w };

    if (dead || w) {
      sim.falling = null;
      sim.spawnAt = null;
    } else if (freezeMs > 0) {
      sim.falling = null;
      sim.spawnAt = Date.now() + freezeMs;
    } else {
      sim.falling = this.newPiece(this.state.pieceSequence[ni].colors);
    }
    this.landings[pi] = { steps, lockedBalls, nonce: ++this.nonce };
    this.version++;
  }
}
