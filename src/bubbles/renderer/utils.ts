import type { TColorStop } from '../types';

export function withClipCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fn: () => void,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  fn();
  ctx.restore();
}

export function makeIridescentGradient(
  ctx: CanvasRenderingContext2D,
  stops: TColorStop[],
  x: number,
  y: number,
  r: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  for (const s of stops) g.addColorStop(s.t, s.c);
  return g;
}