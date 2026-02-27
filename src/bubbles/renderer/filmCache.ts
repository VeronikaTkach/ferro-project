import type { TBubble } from '../types';
import { FILM_PAD } from './tunables';

// Насколько часто пересоздавать текстуру плёнки по радиусу.
// 6–10 обычно хорошо. 8 — золотая середина.
const FILM_R_QUANT = 8;

type TFilmEntry = {
  keyR: number;                 // “квантизированный” радиус, по которому создана текстура
  canvas: HTMLCanvasElement;
};

// Cached soap-film texture per bubble (regenerate when radius crosses a quantization threshold)
const filmCache = new WeakMap<TBubble, TFilmEntry>();

function quantizeR(r: number): number {
  const rr = Math.max(10, Math.round(r));
  return Math.max(10, Math.round(rr / FILM_R_QUANT) * FILM_R_QUANT);
}

// Детерминированный RNG (Mulberry32)
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function getFilmCanvas(b: TBubble, rNow: number): HTMLCanvasElement {
  const keyR = quantizeR(rNow);

  const cached = filmCache.get(b);
  if (cached && cached.keyR === keyR) return cached.canvas;

  const size = keyR * 2 + (FILM_PAD * 2);

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;

  const ctx = c.getContext('2d');
  if (!ctx) {
    filmCache.set(b, { keyR, canvas: c });
    return c;
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = keyR;

  ctx.clearRect(0, 0, size, size);

  // Clip circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Детерминированный random, чтобы плёнка не “прыгала” при регенерации
  const rng = mulberry32((b.id * 2654435761 + keyR * 1013904223) >>> 0);

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

  // 2) Soft linear sweep, deterministically rotated
  {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rng() * Math.PI * 2);
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

  filmCache.set(b, { keyR, canvas: c });
  return c;
}