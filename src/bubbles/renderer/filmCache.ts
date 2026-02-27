import type { TBubble } from '../types';
import { FILM_PAD } from './tunables';

// Cached soap-film texture per bubble (pre-render once, scale each frame)
const filmCache = new WeakMap<TBubble, HTMLCanvasElement>();

export function getFilmCanvas(b: TBubble): HTMLCanvasElement {
  const cached = filmCache.get(b);
  if (cached) return cached;

  const baseR = Math.max(10, Math.round(b.r));
  const size = baseR * 2 + (FILM_PAD * 2);

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;

  const ctx = c.getContext('2d');
  if (!ctx) {
    filmCache.set(b, c);
    return c;
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = baseR;

  ctx.clearRect(0, 0, size, size);

  // Build film texture once, clipped to a circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // 1) Offset radial pastel wash
  {
    const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.12, cx, cy, r);
    g.addColorStop(0.00, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.20, 'rgba(150,210,255,0.14)');
    g.addColorStop(0.48, 'rgba(220,190,255,0.12)');
    g.addColorStop(0.75, 'rgba(255,220,190,0.10)');
    g.addColorStop(1.00, 'rgba(255,255,255,0.00)');

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }

  // 2) Soft linear sweep, randomly rotated
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

  // 3) Tiny tint spot
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