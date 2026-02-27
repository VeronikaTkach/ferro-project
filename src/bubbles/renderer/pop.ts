import type { TBubble } from '../types';
import { clamp } from '../physics';
import {
  BURST_START,
  RIPPLE_END,
  SHARDS_ALPHA,
  SHARDS_COUNT,
  SHARDS_KICK_EXTRA,
  SHARDS_KICK_MULT,
  SHARDS_MAX_OFF,
  SPARKLES_N,
} from './tunables';

export function drawPopBurst(
  ctx: CanvasRenderingContext2D,
  b: TBubble,
  x: number,
  y: number,
  r: number,
  alpha: number,
  popP: number,
  strokeW: number,
): void {
  const fade = 1 - popP;
  const burst = clamp((popP - BURST_START) / (1 - BURST_START), 0, 1);

  drawSnapRing(ctx, b, x, y, r, alpha, popP, strokeW);
  drawFilmShards(ctx, b, x, y, r, burst, fade);
  drawSparkles(ctx, b, x, y, burst, fade);
}

function drawSnapRing(
  ctx: CanvasRenderingContext2D,
  b: TBubble,
  x: number,
  y: number,
  r: number,
  alpha: number,
  popP: number,
  strokeW: number,
): void {
  if (popP >= RIPPLE_END) return;

  const snap = clamp((popP - 0.28) / 0.20, 0, 1);
  const rr = r + snap * 14;

  const ring = ctx.createLinearGradient(x - rr, y - rr, x + rr, y + rr);
  for (const s of b.strokeStops) ring.addColorStop(s.t, s.c);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha * 0.55 * (1 - snap * 0.5);
  ctx.strokeStyle = ring;
  ctx.lineWidth = Math.max(1, strokeW * 0.9);
  ctx.shadowBlur = rr * 0.10;
  ctx.shadowColor = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFilmShards(
  ctx: CanvasRenderingContext2D,
  b: TBubble,
  x: number,
  y: number,
  r: number,
  burst: number,
  fade: number,
): void {
  const ease = 1 - Math.pow(1 - burst, 3);
  const offBase = ease * SHARDS_MAX_OFF;

  for (let i = 0; i < SHARDS_COUNT; i++) {
    const s = ((b.id * 2654435761) ^ (i * 1013904223)) >>> 0;

    const a = (s % 6283) / 1000;
    const span = (0.12 + ((s >>> 8) % 80) / 1000) * Math.PI;
    const speedJitter = 0.6 + ((s >>> 20) % 100) / 100;

    const off = offBase * speedJitter;
    const kick = r * (SHARDS_KICK_MULT + burst * SHARDS_KICK_EXTRA);

    const cx = x + Math.cos(a) * (off + kick);
    const cy = y + Math.sin(a) * (off + kick);

    const rr = r * (0.22 + burst * 0.28);
    const thick = Math.max(1.2, r * 0.085) * (1 - burst * 0.35);

    const twist = ((s >>> 24) % 200) / 200 - 0.5;
    const a0 = a + twist * 0.55 * burst;
    const a1 = a0 + span;

    const g = ctx.createLinearGradient(cx - rr, cy, cx + rr, cy);
    g.addColorStop(0.00, `rgba(255,120,220,${SHARDS_ALPHA * fade})`);
    g.addColorStop(0.35, `rgba(120,210,255,${SHARDS_ALPHA * fade})`);
    g.addColorStop(0.70, `rgba(120,255,200,${SHARDS_ALPHA * fade})`);
    g.addColorStop(1.00, `rgba(255,220,140,${SHARDS_ALPHA * fade})`);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowBlur = rr * 0.06;
    ctx.shadowColor = 'rgba(255,255,255,0.85)';

    // Filled ring-segment strip (film piece)
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rr + thick * 0.5, a0, a1);
    ctx.arc(cx, cy, rr - thick * 0.5, a1, a0, true);
    ctx.closePath();
    ctx.fill();

    // Bright edge highlight
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.9 * fade;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(0.8, thick * 0.18);
    ctx.beginPath();
    ctx.arc(cx, cy, rr + thick * 0.25, a0, a1);
    ctx.stroke();

    ctx.restore();
  }
}

function drawSparkles(
  ctx: CanvasRenderingContext2D,
  b: TBubble,
  x: number,
  y: number,
  burst: number,
  fade: number,
): void {
  for (let i = 0; i < SPARKLES_N; i++) {
    const s = ((b.id * 7919) + i * 104729) >>> 0;
    const ang = (s % 6283) / 1000;
    const sp = 22 + ((s >>> 10) % 30);
    const dist = burst * sp;

    const px = x + Math.cos(ang) * dist;
    const py = y + Math.sin(ang) * dist;

    const pr = Math.max(0.6, (1 - burst) * 2.2);
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr * 3.2);
    g.addColorStop(0, `rgba(255,255,255,${0.55 * fade})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}