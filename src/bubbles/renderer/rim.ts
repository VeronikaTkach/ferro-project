import {
  GLOW_ALPHA,
  GLOW_BLUR_MULT,
  GLOW_W_MULT,
  RIM_BASE_W,
  RIM_W_WOBBLE,
  RIM_W_WOBBLE_FREQ,
} from './tunables';

export function computeRimWidth(now: number, id: number, popP: number): number {
  const wobble = Math.sin((now + id * 50) * RIM_W_WOBBLE_FREQ) * RIM_W_WOBBLE;
  return (RIM_BASE_W + wobble) * (1 - popP * 0.7);
}

export function drawRim(
  ctx: CanvasRenderingContext2D,
  grad: CanvasGradient,
  x: number,
  y: number,
  r: number,
  alpha: number,
  strokeW: number,
): void {
  drawGlowAura(ctx, grad, x, y, r, alpha, strokeW);
  drawIridescentRim(ctx, grad, x, y, r, alpha, strokeW);
  drawWhiteRimOverlay(ctx, x, y, r, alpha, strokeW);
}

function drawGlowAura(
  ctx: CanvasRenderingContext2D,
  grad: CanvasGradient,
  x: number,
  y: number,
  r: number,
  alpha: number,
  strokeW: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = grad;
  ctx.globalAlpha = alpha * GLOW_ALPHA;
  ctx.lineWidth = strokeW * GLOW_W_MULT;
  ctx.shadowBlur = r * GLOW_BLUR_MULT;
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawIridescentRim(
  ctx: CanvasRenderingContext2D,
  grad: CanvasGradient,
  x: number,
  y: number,
  r: number,
  alpha: number,
  strokeW: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha * 0.78;
  ctx.strokeStyle = grad;
  ctx.lineWidth = strokeW;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawWhiteRimOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
  strokeW: number,
): void {
  const rim = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  rim.addColorStop(0.00, `rgba(255,255,255,${0.45 * alpha})`);
  rim.addColorStop(0.40, `rgba(255,255,255,${0.14 * alpha})`);
  rim.addColorStop(1.00, `rgba(255,255,255,${0.06 * alpha})`);

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(0.75, strokeW * 0.45);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}