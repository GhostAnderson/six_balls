import type { CSSProperties } from 'react';

/** Deep-space neon backdrop matching the original 6-Ball Puzzle look. */
export const STARFIELD_BG: CSSProperties = {
  backgroundColor: '#070b26',
  backgroundImage: [
    'radial-gradient(1px 1px at 25px 35px, rgba(255,255,255,0.9), transparent 55%)',
    'radial-gradient(1px 1px at 165px 120px, rgba(255,255,255,0.7), transparent 55%)',
    'radial-gradient(1.5px 1.5px at 90px 210px, rgba(170,220,255,0.9), transparent 55%)',
    'radial-gradient(1px 1px at 210px 60px, rgba(255,255,255,0.5), transparent 55%)',
    'radial-gradient(1px 1px at 60px 160px, rgba(255,200,255,0.6), transparent 55%)',
    'radial-gradient(2px 2px at 300px 240px, rgba(255,255,255,0.75), transparent 55%)',
    'radial-gradient(1px 1px at 340px 90px, rgba(160,200,255,0.6), transparent 55%)',
    'radial-gradient(ellipse 120% 90% at 50% -20%, #223a8f 0%, #131d54 45%, #070b26 100%)',
  ].join(', '),
  backgroundSize: '260px 260px, 300px 300px, 340px 340px, 380px 380px, 420px 420px, 460px 460px, 500px 500px, 100% 100%',
};

export const NEON_CYAN = '#33e0ff';
export const NEON_MAGENTA = '#ff44dd';
export const TEXT_DIM = '#8fa3e8';
