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

/**
 * Cached soap-film texture per bubble.
 * We pre-render a subtle interference texture into an offscreen canvas once,
 * then scale it each frame. This avoids heavy per-frame allocations.
 */
const filmCache = new WeakMap<TBubble, HTMLCanvasElement>();

function getFilmCanvas(b: TBubble): HTMLCanvasElement {
  const cached = filmCache.get(b);
  if (cached) return cached;

  const baseR = Math.max(10, Math.round(b.r));
  const size = baseR * 2 + 6;

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;

  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const cx = size / 2;
  const cy = size / 2;
  const r = baseR;

  ctx.clearRect(0, 0, size, size);

  // Clip to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // 1) Offset radial pastel wash (very subtle)
  {
    const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.12, cx, cy, r);
    g.addColorStop(0.00, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.20, 'rgba(150,210,255,0.14)');
    g.addColorStop(0.48, 'rgba(220,190,255,0.12)');
    g.addColorStop(0.75, 'rgba(255,220,190,0.1)');
    g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = g;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }

  // 2) Soft linear sweep, rotated randomly (interference vibe)
  {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.random() * Math.PI * 2);
    ctx.translate(-cx, -cy);

    const g = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    g.addColorStop(0.00, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.22, 'rgba(140,255,220,0.09)');
    g.addColorStop(0.52, 'rgba(255,170,220,0.09)');
    g.addColorStop(0.82, 'rgba(140,180,255,0.09)');
    g.addColorStop(1.00, 'rgba(255,255,255,0.00)');

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  // 3) Tiny extra tint spot for organic look
  {
    const g = ctx.createRadialGradient(
      cx + r * 0.35,
      cy + r * 0.15,
      r * 0.05,
      cx + r * 0.20,
      cy + r * 0.20,
      r * 0.95,
    );
    g.addColorStop(0.00, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.35, 'rgba(255,255,170,0.05)');
    g.addColorStop(0.70, 'rgba(170,255,210,0.04)');
    g.addColorStop(1.00, 'rgba(255,255,255,0.00)');

    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();

  filmCache.set(b, c);
  return c;
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

  // Iridescent rim gradient (existing stops)
  const grad = ctx.createLinearGradient(b.x - r, b.y - r, b.x + r, b.y + r);
  for (const s of b.strokeStops) grad.addColorStop(s.t, s.c);

  // --- Interior layers (clipped) ---
  ctx.save();
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.clip();

  // [1] Glass body (milky thickness): center brighter, edge slightly darker
  {
    const g = ctx.createRadialGradient(
      b.x - r * 0.25,
      b.y - r * 0.35,
      r * 0.12,
      b.x,
      b.y,
      r,
    );
    g.addColorStop(0.00, `rgba(255,255,255,${0.20 * alpha})`);
    g.addColorStop(0.45, `rgba(255,255,255,${0.07 * alpha})`);
    g.addColorStop(1.00, `rgba(0,0,0,${0.015 * alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(b.x - r, b.y - r, r * 2, r * 2);
  }

  // [2] Soap film texture (cached) — scaled to current radius
  {
    const film = getFilmCanvas(b);
    const pad = 3;
    ctx.globalAlpha = 1; // alpha is baked into texture colors; keep stable
    ctx.drawImage(
      film,
      b.x - r - pad,
      b.y - r - pad,
      r * 2 + pad * 2,
      r * 2 + pad * 2,
    );
  }

  // [2.5] Thin-film rim arc (gives that real soap rainbow)
  {
    const arcGrad = ctx.createLinearGradient(b.x - r, b.y, b.x + r, b.y);
    arcGrad.addColorStop(0.00, `rgba(255,120,200,${0.10 * alpha})`);
    arcGrad.addColorStop(0.30, `rgba(120,200,255,${0.10 * alpha})`);
    arcGrad.addColorStop(0.55, `rgba(120,255,200,${0.10 * alpha})`);
    arcGrad.addColorStop(0.80, `rgba(255,220,140,${0.10 * alpha})`);
    arcGrad.addColorStop(1.00, `rgba(255,120,200,${0.10 * alpha})`);

    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.beginPath();
    // дуга сверху-справа (как часто в фото)
    ctx.arc(b.x, b.y, r * 0.82, -0.2 * Math.PI, 0.55 * Math.PI);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  // Rim darkening inside (very subtle) — helps volume on white
  {
    const rg = ctx.createRadialGradient(b.x, b.y, r * 0.65, b.x, b.y, r);
    rg.addColorStop(0.00, `rgba(0,0,0,0)`);
    rg.addColorStop(1.00, `rgba(0,0,0,${0.03 * alpha})`);
    ctx.fillStyle = rg;
    ctx.fillRect(b.x - r, b.y - r, r * 2, r * 2);
  }

  // [3] Inner depth shadow (bottom-right) to add volume
  {
    const g = ctx.createRadialGradient(
      b.x + r * 0.35,
      b.y + r * 0.35,
      r * 0.20,
      b.x + r * 0.25,
      b.y + r * 0.25,
      r,
    );
    g.addColorStop(0.00, `rgba(0,0,0,0)`);
    g.addColorStop(0.65, `rgba(0,0,0,${0.03 * alpha})`);
    g.addColorStop(1.00, `rgba(0,0,0,${0.09 * alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(b.x - r, b.y - r, r * 2, r * 2);
  }

  // [4] Primary specular highlight (tight hot spot)
  {
    const hl = ctx.createRadialGradient(
      b.x - r * 0.35,
      b.y - r * 0.45,
      0,
      b.x - r * 0.35,
      b.y - r * 0.45,
      r * 0.55,
    );
    hl.addColorStop(0.00, `rgba(255,255,255,${0.80 * alpha})`);
    hl.addColorStop(0.18, `rgba(255,255,255,${0.22 * alpha})`);
    hl.addColorStop(1.00, `rgba(255,255,255,0)`);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = hl;
    ctx.fillRect(b.x - r, b.y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // [5] Secondary broad highlight (soft sheen)
  {
    const hl2 = ctx.createRadialGradient(
      b.x - r * 0.10,
      b.y - r * 0.12,
      r * 0.10,
      b.x - r * 0.10,
      b.y - r * 0.12,
      r * 0.95,
    );
    hl2.addColorStop(0.00, `rgba(255,255,255,${0.16 * alpha})`);
    hl2.addColorStop(1.00, `rgba(255,255,255,0)`);
    ctx.fillStyle = hl2;
    ctx.fillRect(b.x - r, b.y - r, r * 2, r * 2);
  }

  ctx.restore();

  // --- Rim strokes (more natural) ---
  const strokeW =
    (1.05 + Math.sin((now + b.id * 50) * 0.006) * 0.25) * (1 - popP * 0.7);

  // Glow (soft aura) — draw a few thin strokes with blur
  {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = grad;
    ctx.globalAlpha = alpha * 0.18;       // сила свечения
    ctx.lineWidth = strokeW * 3.2;        // ширина ауры
    ctx.shadowBlur = r * 0.06;            // мягкость (зависит от размера пузыря)
    ctx.shadowColor = 'rgba(255,255,255,0.9)';

    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // [6] Iridescent rim — thin & clean
  ctx.save();
  ctx.globalAlpha = alpha * 0.78; // чуть ниже, чтобы не было "маркером"
  ctx.strokeStyle = grad;
  ctx.lineWidth = strokeW;
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // [7] Soft white rim overlay (top-left brighter) — добавляет "стекло"
  {
    const rim = ctx.createLinearGradient(b.x - r, b.y - r, b.x + r, b.y + r);
    rim.addColorStop(0.00, `rgba(255,255,255,${0.45 * alpha})`);
    rim.addColorStop(0.40, `rgba(255,255,255,${0.14 * alpha})`);
    rim.addColorStop(1.00, `rgba(255,255,255,${0.06 * alpha})`);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1, strokeW * 0.45);
    ctx.stroke();
    ctx.restore();
  }

  // Pop ring (оставляем как у тебя)
  if (b.popAt) {
    ctx.save();
    ctx.globalAlpha = (1 - popP) * 0.30;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r + popP * 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}