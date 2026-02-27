import type { TBubble } from '../types';
import { clamp } from '../physics';
import {
  BODY_BLACK_EDGE,
  BODY_WHITE_0,
  BODY_WHITE_1,
  DEPTH_BLACK_1,
  DEPTH_BLACK_2,
  FILM_ARC_ALPHA,
  FILM_ARC_W_MULT,
  FILM_PAD,
  HL1_A0,
  HL1_A1,
  HL2_A0,
  RIM_DARK_ALPHA,
  RIPPLE_END,
} from './tunables';
import { getFilmCanvas } from './filmCache';

export function drawInterior(
  ctx: CanvasRenderingContext2D,
  b: TBubble,
  x: number,
  y: number,
  r: number,
  alpha: number,
  popP: number,
  isPopping: boolean,
): void {
  drawGlassBody(ctx, x, y, r, alpha);
  drawFilmTexture(ctx, b, x, y, r);
  drawFilmArc(ctx, x, y, r, alpha);

  if (isPopping) drawRippleDuringPop(ctx, x, y, r, alpha, popP);

  drawRimDarkeningInside(ctx, x, y, r, alpha);
  drawDepthShadow(ctx, x, y, r, alpha);
  drawHighlights(ctx, x, y, r, alpha);
}

function drawGlassBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
): void {
  const g = ctx.createRadialGradient(x - r * 0.28, y - r * 0.35, r * 0.08, x, y, r);
  g.addColorStop(0.00, `rgba(255,255,255,${BODY_WHITE_0 * alpha})`);
  g.addColorStop(0.45, `rgba(255,255,255,${BODY_WHITE_1 * alpha})`);
  g.addColorStop(1.00, `rgba(0,0,0,${BODY_BLACK_EDGE * alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawFilmTexture(
  ctx: CanvasRenderingContext2D,
  b: TBubble,
  x: number,
  y: number,
  r: number,
): void {
  const film = getFilmCanvas(b, r);
  ctx.globalAlpha = 1;
  ctx.drawImage(
    film,
    x - r - FILM_PAD,
    y - r - FILM_PAD,
    r * 2 + FILM_PAD * 2,
    r * 2 + FILM_PAD * 2
  );
}

function drawFilmArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
): void {
  const arcGrad = ctx.createLinearGradient(x - r, y, x + r, y);
  arcGrad.addColorStop(0.00, `rgba(255,120,200,${FILM_ARC_ALPHA * alpha})`);
  arcGrad.addColorStop(0.30, `rgba(120,200,255,${FILM_ARC_ALPHA * alpha})`);
  arcGrad.addColorStop(0.55, `rgba(120,255,200,${FILM_ARC_ALPHA * alpha})`);
  arcGrad.addColorStop(0.80, `rgba(255,220,140,${FILM_ARC_ALPHA * alpha})`);
  arcGrad.addColorStop(1.00, `rgba(255,120,200,${FILM_ARC_ALPHA * alpha})`);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = arcGrad;
  ctx.lineWidth = Math.max(1, r * FILM_ARC_W_MULT);
  ctx.shadowBlur = r * 0.03;
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.82, -0.2 * Math.PI, 0.55 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawRippleDuringPop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
  popP: number,
): void {
  if (popP >= RIPPLE_END) return;

  const p = clamp(popP / RIPPLE_END, 0, 1);
  const strength = (1 - p) * 0.55;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha * 0.22 * strength;

  for (let i = 0; i < 3; i++) {
    const rr = r * (0.35 + p * 0.8) + i * (r * 0.08);
    const g = ctx.createRadialGradient(x, y, rr * 0.65, x, y, rr);
    g.addColorStop(0.00, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, `rgba(255,255,255,${0.10 * strength})`);
    g.addColorStop(1.00, 'rgba(255,255,255,0)');

    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1, r * 0.06) * (1 - p * 0.4);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRimDarkeningInside(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
): void {
  const rg = ctx.createRadialGradient(x, y, r * 0.65, x, y, r);
  rg.addColorStop(0.00, 'rgba(0,0,0,0)');
  rg.addColorStop(1.00, `rgba(0,0,0,${RIM_DARK_ALPHA * alpha})`);
  ctx.fillStyle = rg;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawDepthShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
): void {
  const g = ctx.createRadialGradient(
    x + r * 0.35,
    y + r * 0.35,
    r * 0.20,
    x + r * 0.25,
    y + r * 0.25,
    r,
  );
  g.addColorStop(0.00, 'rgba(0,0,0,0)');
  g.addColorStop(0.65, `rgba(0,0,0,${DEPTH_BLACK_1 * alpha})`);
  g.addColorStop(1.00, `rgba(0,0,0,${DEPTH_BLACK_2 * alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawHighlights(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
): void {
  // Primary hotspot
  {
    const hl = ctx.createRadialGradient(
      x - r * 0.35,
      y - r * 0.45,
      0,
      x - r * 0.35,
      y - r * 0.45,
      r * 0.55,
    );
    hl.addColorStop(0.00, `rgba(255,255,255,${HL1_A0 * alpha})`);
    hl.addColorStop(0.18, `rgba(255,255,255,${HL1_A1 * alpha})`);
    hl.addColorStop(1.00, 'rgba(255,255,255,0)');

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = hl;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Secondary broad sheen
  {
    const hl2 = ctx.createRadialGradient(
      x - r * 0.10,
      y - r * 0.12,
      r * 0.10,
      x - r * 0.10,
      y - r * 0.12,
      r * 0.95,
    );
    hl2.addColorStop(0.00, `rgba(255,255,255,${HL2_A0 * alpha})`);
    hl2.addColorStop(1.00, 'rgba(255,255,255,0)');

    ctx.fillStyle = hl2;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}