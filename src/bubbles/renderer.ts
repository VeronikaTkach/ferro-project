import type { TBubble, TColorStop } from './types';
import { POP_DURATION } from './config';
import { clamp } from './physics';

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

export function drawBubble(
  ctx: CanvasRenderingContext2D,
  b: TBubble,
  now: number,
): void {
  const popP = b.popAt ? clamp((now - b.popAt) / POP_DURATION, 0, 1) : 0;
  const appearP = clamp((now - b.born) / 240, 0, 1);

  let alpha = 0.95 * appearP;
  if (b.popAt) alpha *= (1 - popP);

  const r = b.r * (b.popAt ? (1 - popP * 0.35) : 1);

  const grad = ctx.createLinearGradient(b.x - r, b.y - r, b.x + r, b.y + r);
  for (const s of b.strokeStops) grad.addColorStop(s.t, s.c);

  const inner = ctx.createRadialGradient(
    b.x - r * 0.25, b.y - r * 0.25, r * 0.1,
    b.x, b.y, r,
  );
  inner.addColorStop(0, `rgba(255,255,255,${0.55 * alpha})`);
  inner.addColorStop(0.45, `rgba(255,255,255,${0.18 * alpha})`);
  inner.addColorStop(1, `rgba(255,255,255,0)`);

  const hl = ctx.createRadialGradient(
    b.x - r * 0.3, b.y - r * 0.35, 0,
    b.x - r * 0.3, b.y - r * 0.35, r * 0.55,
  );
  hl.addColorStop(0, `rgba(255,255,255,${0.45 * alpha})`);
  hl.addColorStop(1, `rgba(255,255,255,0)`);

  const strokeW = (2.0 + Math.sin((now + b.id * 50) * 0.006) * 0.6) * (1 - popP * 0.7);

  ctx.save();

  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.fillStyle = inner;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(b.x - r * 0.15, b.y - r * 0.2, r * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = hl;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = grad;
  ctx.lineWidth = strokeW;
  ctx.globalAlpha = alpha;
  ctx.stroke();

  if (b.popAt) {
    ctx.globalAlpha = (1 - popP) * 0.35;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r + popP * 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}
