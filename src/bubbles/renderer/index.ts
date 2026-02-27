import type { TBubble } from '../types';
import { POP_DURATION } from '../config';
import { clamp } from '../physics';

import { randomIridescentStops } from './palette';
import { makeIridescentGradient, withClipCircle } from './utils';
import { drawInterior } from './interior';
import { computeRimWidth, drawRim } from './rim';
import { drawPopBurst } from './pop';

const APPEAR_MS = 240;

export { randomIridescentStops };

export function drawBubble(
  ctx: CanvasRenderingContext2D,
  b: TBubble,
  now: number,
): void {
  const popP = b.popAt ? clamp((now - b.popAt) / POP_DURATION, 0, 1) : 0;
  const appearP = clamp((now - b.born) / APPEAR_MS, 0, 1);
  const isPopping = !!b.popAt;

  let alpha = 0.95 * appearP;
  if (isPopping) alpha *= (1 - popP);

  const r = b.r * (isPopping ? (1 - popP * 0.35) : 1);

  // Visual-only shake during early pop phase
  let px = b.x;
  let py = b.y;
  if (isPopping) {
    const pre = clamp(popP / 0.25, 0, 1);
    const relax = clamp((popP - 0.25) / 0.15, 0, 1);
    const shake = pre * (1 - relax);
    const amp = r * 0.015 * shake;
    const w = now * 0.06 + b.id * 13.37;
    px += Math.sin(w) * amp;
    py += Math.cos(w * 1.3) * amp;
  }

  const rimGrad = makeIridescentGradient(ctx, b.strokeStops, px, py, r);
  const strokeW = computeRimWidth(now, b.id, popP);

  // Interior layers (clipped)
  withClipCircle(ctx, px, py, r, () => {
    drawInterior(ctx, b, px, py, r, alpha, popP, isPopping);
  });

  // Rim (outside clip)
  drawRim(ctx, rimGrad, px, py, r, alpha, strokeW);

  // Burst overlay (outside clip, shards can fly away)
  if (isPopping) {
    drawPopBurst(ctx, b, px, py, r, alpha, popP, strokeW);
  }
}