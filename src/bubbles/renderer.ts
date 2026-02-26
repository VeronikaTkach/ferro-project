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

  // 1) Offset radial pastel wash (thin-film interference, subtle but visible on white)
  {
    const g = ctx.createRadialGradient(
      cx - r * 0.25,
      cy - r * 0.25,
      r * 0.12,
      cx,
      cy,
      r,
    );
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

  // 3) Tiny tint spot for a more organic look
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

function drawRippleDuringPop(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  r: number,
  alpha: number,
  t: number, // 0..1 pop progress
): void {
  if (t >= 0.55) return;

  const p = clamp(t / 0.55, 0, 1);
  const strength = (1 - p) * 0.55;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha * 0.22 * strength;

  for (let i = 0; i < 3; i++) {
    const rr = r * (0.35 + p * 0.8) + i * (r * 0.08);
    const g = ctx.createRadialGradient(px, py, rr * 0.65, px, py, rr);
    g.addColorStop(0.00, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, `rgba(255,255,255,${0.10 * strength})`);
    g.addColorStop(1.00, 'rgba(255,255,255,0)');

    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1, r * 0.06) * (1 - p * 0.4);

    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPopBurst(
  ctx: CanvasRenderingContext2D,
  b: TBubble,
  px: number,
  py: number,
  r: number,
  alpha: number,
  popP: number,
  strokeW: number,
): void {
  const t = popP;
  const fade = 1 - t;

  // Burst phase starts later (after ripple/shake)
  const burst = clamp((t - 0.45) / 0.55, 0, 1);

  // 1) Snap ring near the "break" moment
  if (t < 0.55) {
    const snap = clamp((t - 0.28) / 0.20, 0, 1);
    const rr = r + snap * 14;

    const ring = ctx.createLinearGradient(px - rr, py - rr, px + rr, py + rr);
    for (const s of b.strokeStops) ring.addColorStop(s.t, s.c);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha * 0.55 * (1 - snap * 0.5);
    ctx.strokeStyle = ring;
    ctx.lineWidth = Math.max(1, strokeW * 0.9);
    ctx.shadowBlur = rr * 0.10;
    ctx.shadowColor = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 2) Flying film shards (visible film pieces)
  {
    const shards = 26; // 12-30
    const maxOff = 260; // how far shards can travel
    const ease = 1 - Math.pow(1 - burst, 3); // fast-out easing
    const offBase = ease * maxOff;

    for (let i = 0; i < shards; i++) {
      const s = ((b.id * 2654435761) ^ (i * 1013904223)) >>> 0;

      const a = (s % 6283) / 1000; // 0..~2π
      const span = (0.12 + ((s >>> 8) % 80) / 1000) * Math.PI; // ~0.12π..0.20π
      const speedJitter = 0.6 + ((s >>> 20) % 100) / 100; // 0.6..2.0

      const off = offBase * speedJitter;

      // shard center
      const kick = r * (0.9 + burst * 0.6);
      const cx = px + Math.cos(a) * (off + kick);
      const cy = py + Math.sin(a) * (off + kick);

      // shard radius grows slightly while flying
      const rr = r * (0.22 + burst * 0.28);

      // thickness of the "film strip"
      const thick = Math.max(1.2, r * 0.085) * (1 - burst * 0.35);

      // slight twist for variety
      const twist = ((s >>> 24) % 200) / 200 - 0.5; // -0.5..0.5
      const a0 = a + twist * 0.55 * burst;
      const a1 = a0 + span;

      // iridescent gradient across the strip
      const g = ctx.createLinearGradient(cx - rr, cy, cx + rr, cy);
      g.addColorStop(0.00, `rgba(255,120,220,${0.30 * fade})`);
      g.addColorStop(0.35, `rgba(120,210,255,${0.30 * fade})`);
      g.addColorStop(0.70, `rgba(120,255,200,${0.30 * fade})`);
      g.addColorStop(1.00, `rgba(255,220,140,${0.30 * fade})`);

      // draw as a filled ring-segment (a "strip"), not just a line
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 1;

      // Soft glow behind the strip
      ctx.shadowBlur = rr * 0.06;
      ctx.shadowColor = 'rgba(255,255,255,0.85)';

      ctx.fillStyle = g;
      ctx.beginPath();
      // outer arc
      ctx.arc(cx, cy, rr + thick * 0.5, a0, a1);
      // inner arc back
      ctx.arc(cx, cy, rr - thick * 0.5, a1, a0, true);
      ctx.closePath();
      ctx.fill();

      // add a thin bright edge highlight to make it "film-like"
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

  // 3) Sparkles (tiny droplets)
  {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const s = ((b.id * 7919) + i * 104729) >>> 0;
      const ang = (s % 6283) / 1000;
      const sp = 22 + ((s >>> 10) % 30);
      const dist = burst * sp;

      const x = px + Math.cos(ang) * dist;
      const y = py + Math.sin(ang) * dist;

      const pr = Math.max(0.6, (1 - burst) * 2.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, pr * 3.2);
      g.addColorStop(0, `rgba(255,255,255,${0.55 * fade})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, pr * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
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

  // Base radius shrink (kept close to your existing behavior)
  const r = b.r * (b.popAt ? (1 - popP * 0.35) : 1);

  // Pop-time shake (early phase only), purely visual
  let px = b.x;
  let py = b.y;
  if (b.popAt) {
    const t = popP;
    const pre = clamp(t / 0.25, 0, 1);
    const relax = clamp((t - 0.25) / 0.15, 0, 1);
    const shake = pre * (1 - relax); // strong at start, quickly fades
    const amp = r * 0.015 * shake;
    const w = now * 0.06 + b.id * 13.37;
    px += Math.sin(w) * amp;
    py += Math.cos(w * 1.3) * amp;
  }

  // Iridescent rim gradient from precomputed stops
  const grad = ctx.createLinearGradient(px - r, py - r, px + r, py + r);
  for (const s of b.strokeStops) grad.addColorStop(s.t, s.c);

  // --- Interior layers (clipped to bubble) ---
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.clip();

  // [1] Glass body (less milky on white backgrounds)
  {
    const g = ctx.createRadialGradient(
      px - r * 0.28,
      py - r * 0.35,
      r * 0.08,
      px,
      py,
      r,
    );
    g.addColorStop(0.00, `rgba(255,255,255,${0.10 * alpha})`);
    g.addColorStop(0.45, `rgba(255,255,255,${0.03 * alpha})`);
    g.addColorStop(1.00, `rgba(0,0,0,${0.015 * alpha})`);

    ctx.fillStyle = g;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }

  // [2] Soap film texture (cached)
  {
    const film = getFilmCanvas(b);
    const pad = 3;
    ctx.globalAlpha = 1; // film texture already has built-in alpha
    ctx.drawImage(film, px - r - pad, py - r - pad, r * 2 + pad * 2, r * 2 + pad * 2);
  }

  // [2.5] Thin-film rim arc (adds realistic interference color)
  {
    const arcGrad = ctx.createLinearGradient(px - r, py, px + r, py);
    arcGrad.addColorStop(0.00, `rgba(255,120,200,${0.10 * alpha})`);
    arcGrad.addColorStop(0.30, `rgba(120,200,255,${0.10 * alpha})`);
    arcGrad.addColorStop(0.55, `rgba(120,255,200,${0.10 * alpha})`);
    arcGrad.addColorStop(0.80, `rgba(255,220,140,${0.10 * alpha})`);
    arcGrad.addColorStop(1.00, `rgba(255,120,200,${0.10 * alpha})`);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.shadowBlur = r * 0.03;
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(px, py, r * 0.82, -0.2 * Math.PI, 0.55 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  // Pop pre-ripple (adds surface wobble before the burst)
  if (b.popAt) {
    drawRippleDuringPop(ctx, px, py, r, alpha, popP);
  }

  // Subtle rim darkening inside the bubble (helps volume on white)
  {
    const rg = ctx.createRadialGradient(px, py, r * 0.65, px, py, r);
    rg.addColorStop(0.00, 'rgba(0,0,0,0)');
    rg.addColorStop(1.00, `rgba(0,0,0,${0.03 * alpha})`);
    ctx.fillStyle = rg;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }

  // [3] Inner depth shadow (bottom-right)
  {
    const g = ctx.createRadialGradient(
      px + r * 0.35,
      py + r * 0.35,
      r * 0.20,
      px + r * 0.25,
      py + r * 0.25,
      r,
    );
    g.addColorStop(0.00, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, `rgba(0,0,0,${0.03 * alpha})`);
    g.addColorStop(1.00, `rgba(0,0,0,${0.09 * alpha})`);

    ctx.fillStyle = g;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }

  // [4] Primary specular highlight (tight hotspot)
  {
    const hl = ctx.createRadialGradient(
      px - r * 0.35,
      py - r * 0.45,
      0,
      px - r * 0.35,
      py - r * 0.45,
      r * 0.55,
    );
    hl.addColorStop(0.00, `rgba(255,255,255,${0.80 * alpha})`);
    hl.addColorStop(0.18, `rgba(255,255,255,${0.22 * alpha})`);
    hl.addColorStop(1.00, 'rgba(255,255,255,0)');

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = hl;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // [5] Secondary broad highlight (soft sheen)
  {
    const hl2 = ctx.createRadialGradient(
      px - r * 0.10,
      py - r * 0.12,
      r * 0.10,
      px - r * 0.10,
      py - r * 0.12,
      r * 0.95,
    );
    hl2.addColorStop(0.00, `rgba(255,255,255,${0.16 * alpha})`);
    hl2.addColorStop(1.00, 'rgba(255,255,255,0)');

    ctx.fillStyle = hl2;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }

  ctx.restore();

  // --- Rim strokes (thin + glow) ---
  const strokeW =
    (1.05 + Math.sin((now + b.id * 50) * 0.006) * 0.25) * (1 - popP * 0.7);

  // Glow aura (soft)
  {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = grad;
    ctx.globalAlpha = alpha * 0.18;
    ctx.lineWidth = strokeW * 3.2;
    ctx.shadowBlur = r * 0.06;
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Main iridescent rim (thin & clean)
  {
    ctx.save();
    ctx.globalAlpha = alpha * 0.78;
    ctx.strokeStyle = grad;
    ctx.lineWidth = strokeW;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Soft white rim overlay (adds "glass" feel)
  {
    const rim = ctx.createLinearGradient(px - r, py - r, px + r, py + r);
    rim.addColorStop(0.00, `rgba(255,255,255,${0.45 * alpha})`);
    rim.addColorStop(0.40, `rgba(255,255,255,${0.14 * alpha})`);
    rim.addColorStop(1.00, `rgba(255,255,255,${0.06 * alpha})`);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(0.75, strokeW * 0.45);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Pop burst overlay: ripple + snap + flying film shards + sparkles
  if (b.popAt) {
    drawPopBurst(ctx, b, px, py, r, alpha, popP, strokeW);
  }
}