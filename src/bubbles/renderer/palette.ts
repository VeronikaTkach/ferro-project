import type { TColorStop } from '../types';

const PALETTE = [
  'rgba(255, 80, 80, 0.95)',
  'rgba(255, 210, 80, 0.95)',
  'rgba(120, 255, 140, 0.95)',
  'rgba(80, 210, 255, 0.95)',
  'rgba(190, 120, 255, 0.95)',
  'rgba(255, 120, 220, 0.95)',
];

export function randomIridescentStops(): TColorStop[] {
  const stops: TColorStop[] = [];
  const n = 4 + Math.floor(Math.random() * 3); // 4..6
  for (let i = 0; i < n; i++) {
    stops.push({
      t: i / (n - 1),
      c: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    });
  }
  stops.sort(() => Math.random() - 0.5);
  return stops.map((s, i) => ({ t: i / (stops.length - 1), c: s.c }));
}