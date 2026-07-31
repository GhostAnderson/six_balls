import type { GameState, PlayerState, Attack } from '@six-balls/shared';
import Board from './Board';
import type { LocalGameEngine } from '../game/localGame';
import { NEON_CYAN, NEON_MAGENTA, TEXT_DIM } from '../themes/starfield';

const BALL_HEX: Record<string, string> = {
  red: '#ff3355', purple: '#c44dff', yellow: '#ffb020', blue: '#3b7dff', green: '#3ed44e',
};

function MiniDot({ color, size = 7 }: { color: string; size?: number }) {
  const base = BALL_HEX[color] ?? '#cccccc';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 32% 30%, #ffffffcc, ${base} 60%)`,
      boxShadow: `0 0 ${Math.max(4, size / 2)}px ${base}aa`,
      flexShrink: 0,
    }} />
  );
}

function NextPiecePreview({ nextPiece }: { nextPiece: PlayerState['nextPiece'] }) {
  // Pieces always spawn at rotation 0: apex on top, two balls below,
  // packed as an equilateral triangle (bottom pair touching, apex in the notch).
  const D = 16;           // ball diameter
  const ROW = D * 0.87;   // hex-packed vertical spacing
  const [apex, right, left] = nextPiece.colors;
  const balls = [
    { color: apex, x: D / 2, y: 0 },
    { color: left, x: 0, y: ROW },
    { color: right, x: D, y: ROW },
  ];
  return (
    <div style={{ position: 'relative', width: D * 2, height: ROW + D, margin: '0 auto' }}>
      {balls.map((b, i) => (
        <div key={i} style={{ position: 'absolute', left: b.x, top: b.y }}>
          <MiniDot color={b.color} size={D} />
        </div>
      ))}
    </div>
  );
}

function AttackDiagram({ attack }: { attack: Attack | null }) {
  if (!attack) {
    return (
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '11px', padding: '8px 0' }}>
        · · · <br />safe!
      </div>
    );
  }

  const COUNT_LABEL = `${attack.count}× incoming`;

  if (attack.type === 'hexagonRings') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: '2px' }}>
            <MiniDot color="red" /><MiniDot color="red" />
          </div>
          <div style={{ display: 'flex', gap: '2px' }}>
            <MiniDot color="red" />
            <div style={{ width: 7, height: 7, borderRadius: '50%', border: '1px dashed #ff335588', flexShrink: 0 }} />
            <MiniDot color="red" />
          </div>
          <div style={{ display: 'flex', gap: '2px' }}>
            <MiniDot color="red" /><MiniDot color="red" />
          </div>
        </div>
        <div style={{ fontSize: '8px', color: TEXT_DIM }}>{COUNT_LABEL}</div>
      </div>
    );
  }

  if (attack.type === 'rows') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: '1px', justifyContent: 'center' }}>
            {(['purple', 'blue', 'purple', 'yellow', 'purple'] as const).map((c, i) => <MiniDot key={i} color={c} />)}
          </div>
          <div style={{ display: 'flex', gap: '1px', justifyContent: 'center' }}>
            {(['green', 'red', 'blue', 'green', 'yellow'] as const).map((c, i) => <MiniDot key={i} color={c} />)}
          </div>
        </div>
        <div style={{ fontSize: '8px', color: TEXT_DIM }}>{COUNT_LABEL}</div>
      </div>
    );
  }

  if (attack.type === 'triangles') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: '2px' }}><MiniDot color="yellow" /></div>
          <div style={{ display: 'flex', gap: '2px' }}><MiniDot color="yellow" /><MiniDot color="yellow" /></div>
          <div style={{ display: 'flex', gap: '2px' }}><MiniDot color="yellow" /><MiniDot color="yellow" /><MiniDot color="yellow" /></div>
        </div>
        <div style={{ fontSize: '8px', color: TEXT_DIM }}>{COUNT_LABEL}</div>
      </div>
    );
  }

  return null;
}

const PANEL: React.CSSProperties = {
  background: 'rgba(10,16,50,0.55)',
  borderRadius: '12px',
  border: '1.5px solid rgba(255,255,255,0.55)',
  padding: '8px 6px',
  boxShadow: '0 0 14px rgba(120,160,255,0.18)',
};

function HudColumn({ player, label, accent }: { player: PlayerState; label: string; accent: string }) {
  const nextAttack = player.attackQueue[0] ?? null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '88px', flexShrink: 0 }}>
      <div style={{ fontWeight: 800, fontSize: '12px', color: accent, letterSpacing: '2px', textAlign: 'center', textShadow: `0 0 8px ${accent}` }}>
        {label}
      </div>

      <div style={PANEL}>
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)', fontWeight: 700, letterSpacing: '1px', textAlign: 'center', marginBottom: 6 }}>NEXT</div>
        <NextPiecePreview nextPiece={player.nextPiece} />
      </div>

      <div style={{ ...PANEL, border: nextAttack ? `1.5px solid ${NEON_MAGENTA}` : '1.5px dashed rgba(255,255,255,0.25)', boxShadow: nextAttack ? `0 0 14px ${NEON_MAGENTA}55` : 'none' }}>
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)', fontWeight: 700, letterSpacing: '1px', textAlign: 'center', marginBottom: 6 }}>INCOMING</div>
        <AttackDiagram attack={nextAttack} />
      </div>
    </div>
  );
}

interface GameViewProps {
  gameState: GameState;
  myPlayerId: string;
  /** Continuous local engine (local 2P mode); enables free-space piece rendering. */
  localEngine?: LocalGameEngine | null;
}

export default function GameView({ gameState, myPlayerId, localEngine = null }: GameViewProps) {
  const myIndex = gameState.players.findIndex(p => p.id === myPlayerId);
  const myIdx = (myIndex !== -1 ? myIndex : 0) as 0 | 1;
  const oppIdx = (myIdx === 0 ? 1 : 0) as 0 | 1;
  const myPlayer = gameState.players[myIdx];
  const opponent = gameState.players[oppIdx];
  const startTime = gameState.startTime;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '12px', padding: '16px 24px', flexWrap: 'wrap' }}>

      <HudColumn player={myPlayer} label={localEngine ? 'P1' : 'YOU'} accent={NEON_CYAN} />

      <Board
        grid={myPlayer.grid}
        currentPiece={myPlayer.currentPiece}
        startTime={startTime}
        isMyBoard={true}
        falling={localEngine ? () => localEngine.getFalling(myIdx) : null}
        landing={localEngine ? localEngine.landings[myIdx] : null}
        pendingAttacks={myPlayer.attackQueue}
      />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', padding: '0 4px' }}>
        <div style={{ fontWeight: 900, fontSize: '20px', color: 'rgba(255,255,255,0.85)', letterSpacing: '2px', textShadow: '0 0 12px rgba(255,255,255,0.6)' }}>VS</div>
      </div>

      <Board
        grid={opponent.grid}
        currentPiece={opponent.currentPiece}
        startTime={startTime}
        isMyBoard={false}
        falling={localEngine ? () => localEngine.getFalling(oppIdx) : null}
        landing={localEngine ? localEngine.landings[oppIdx] : null}
        pendingAttacks={opponent.attackQueue}
      />

      <HudColumn player={opponent} label={localEngine ? 'P2' : 'OPP'} accent={NEON_MAGENTA} />

    </div>
  );
}
