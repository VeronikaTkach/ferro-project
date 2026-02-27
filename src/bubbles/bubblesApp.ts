import type { TBubble } from './types';
import {
  BACKGROUND,
  SPAWN_EVERY,
  POP_DURATION,
  BASE_SPEED,
  DRIFT,
  MIN_R,
  MAX_R,
  MAX_BUBBLES,
  LIFETIME,
  GROW_FACTOR,
  GROW_INTERVAL,
  AGE_DRAG_MAX,
  AGE_DRIFT_BOOST,
  AGE_BUOYANCY_MAX,
  AGE_JITTER_MAX,
  AGE_WALL_BOUNCE_DAMP,
} from './config';
import { rand, clamp, bounceOffWalls, resolveBubbleCollisions } from './physics';
import { randomIridescentStops, drawBubble } from './renderer';
import { hitBubble, isHoveringBubble, pop } from './input';

/* ─────────────────────────────────────────────────────────────────────────────
   Interaction tunables
───────────────────────────────────────────────────────────────────────────── */

const DRAG_START_PX = 8;           // how far pointer must move to start dragging
const PUSH_RADIUS = 140;           // influence radius for "wind" push
const PUSH_STRENGTH = 120;         // base push strength (px/s^2-ish feel)
const PUSH_VEL_INFLUENCE = 0.65;   // how much pointer velocity affects push

/* Combo / rainbow dust */
const COMBO_WINDOW_MS = 5000;      // 3 pops within 5s
const DUST_LIFE_MS = 3000;         // dust lives 3 seconds
const DUST_PARTICLES = 90;

/* ─────────────────────────────────────────────────────────────────────────────
   Rainbow dust (simple particle system)
───────────────────────────────────────────────────────────────────────────── */

type TDustParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  r: number;
  c: string;
};

const DUST_COLORS = [
  'rgba(255, 80, 80, 0.95)',
  'rgba(255, 210, 80, 0.95)',
  'rgba(120, 255, 140, 0.95)',
  'rgba(80, 210, 255, 0.95)',
  'rgba(190, 120, 255, 0.95)',
  'rgba(255, 120, 220, 0.95)',
];

function spawnRainbowDust(out: TDustParticle[], x: number, y: number, now: number, baseR: number) {
  const n = DUST_PARTICLES;
  const speedMin = 90 + baseR * 0.35;
  const speedMax = 260 + baseR * 0.8;

  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(speedMin, speedMax);
    const rr = rand(0.7, 2.2) + baseR * 0.01;

    out.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      born: now,
      life: DUST_LIFE_MS,
      r: rr,
      c: DUST_COLORS[(Math.random() * DUST_COLORS.length) | 0],
    });
  }
}

function drawRainbowDust(ctx: CanvasRenderingContext2D, dust: TDustParticle[], now: number, dt: number) {
  if (!dust.length) return;

  // Update
  for (const p of dust) {
    const age = now - p.born;
    const t = clamp(age / p.life, 0, 1);

    // gentle drag + slight downward gravity; fades out
    p.vx *= 1 - dt * 0.9;
    p.vy *= 1 - dt * 0.9;
    p.vy += 120 * dt;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // grow a tiny bit then shrink
    const swell = 1 + Math.sin(Math.PI * clamp(t, 0, 1)) * 0.35;
    p.r = Math.max(0.3, p.r * 0.995 * swell);
  }

  // Render (screen for “радужность”)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (const p of dust) {
    const age = now - p.born;
    const t = clamp(age / p.life, 0, 1);
    const a = (1 - t) * 0.85;

    // soft glow dot
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4.2);
    g.addColorStop(0.0, p.c.replace(/[\d.]+\)\s*$/, `${a})`)); // quick alpha replace
    g.addColorStop(1.0, 'rgba(255,255,255,0)');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 3.0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Cleanup
  for (let i = dust.length - 1; i >= 0; i--) {
    if (now - dust[i].born >= dust[i].life) dust.splice(i, 1);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   App
───────────────────────────────────────────────────────────────────────────── */

export function startBubblesApp(root: HTMLElement): () => void {
  root.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  root.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: false })!;
  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  let bubbles: TBubble[] = [];
  let idSeq = 1;
  let nextSpawnAt = performance.now();

  // Dust particles
  const dust: TDustParticle[] = [];

  // Combo tracking
  let popTimes: number[] = [];

  function registerPopAndMaybeTriggerCombo(b: TBubble, now: number) {
    popTimes.push(now);
    popTimes = popTimes.filter((t) => now - t <= COMBO_WINDOW_MS);

    if (popTimes.length >= 3) {
      // Trigger on the 3rd pop (or more), then reset to avoid constant retriggering
      spawnRainbowDust(dust, b.x, b.y, now, b.r);
      popTimes = [];
    }
  }

  function spawn(now: number) {
    const r = rand(MIN_R, MAX_R);
    const angle = rand(0, Math.PI * 2);
    const speed = rand(BASE_SPEED * 0.75, BASE_SPEED * 1.2);

    const jitter = Math.min(18, r * 0.25);
    const x = w * 0.5 + rand(-jitter, jitter);
    const y = h * 0.5 + rand(-jitter, jitter);

    bubbles.push({
      id: idSeq++,
      x,
      y,
      r,
      baseR: r,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drift: rand(0.6, 1.2),
      wobble: rand(0, Math.PI * 2),
      born: now,
      popAt: null,
      strokeStops: randomIridescentStops(),
    });

    if (bubbles.length > MAX_BUBBLES) bubbles.shift();
  }

  function toCanvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function setHoverCursor(hovering: boolean) {
    canvas.classList.toggle('is-hovering-bubble', hovering);
  }

  function setPressCursor(pressing: boolean) {
    canvas.classList.toggle('is-pressing', pressing);
  }

  // Pointer state for push + drag
  const pointer = {
    active: false,
    id: -1,
    x: 0,
    y: 0,
    lastX: 0,
    lastY: 0,
    vx: 0, // px/s
    vy: 0,
    lastT: performance.now(),
  };

  // Drag candidate / dragging
  let down = {
    active: false,
    t: 0,
    x: 0,
    y: 0,
    bubble: null as TBubble | null,
    offX: 0,
    offY: 0,
  };

  let draggingBubble: TBubble | null = null;

  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvasPoint(e);

    // update pointer velocity for push & throwing
    const now = performance.now();
    const dt = Math.max(0.001, (now - pointer.lastT) / 1000);
    pointer.vx = (p.x - pointer.lastX) / dt;
    pointer.vy = (p.y - pointer.lastY) / dt;
    pointer.lastX = p.x;
    pointer.lastY = p.y;
    pointer.lastT = now;

    pointer.x = p.x;
    pointer.y = p.y;
    pointer.active = true;

    // If we are dragging -> move bubble, no hover cursor logic
    if (draggingBubble && down.active) {
      draggingBubble.x = p.x + down.offX;
      draggingBubble.y = p.y + down.offY;

      // keep it "held", but store velocities for throw on release
      draggingBubble.vx = pointer.vx;
      draggingBubble.vy = pointer.vy;

      setHoverCursor(false);
      return;
    }

    // if not dragging: show hover
    setHoverCursor(isHoveringBubble(bubbles, p.x, p.y));

    // If pointer is down and has a candidate bubble, check if drag should start
    if (down.active && down.bubble && !draggingBubble) {
      const dx = p.x - down.x;
      const dy = p.y - down.y;
      const dist = Math.hypot(dx, dy);

      if (dist >= DRAG_START_PX) {
        // Start dragging
        draggingBubble = down.bubble;

        // lock pointer capture so we still get events outside canvas
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }

        // Offset so bubble doesn't snap its center to pointer
        down.offX = draggingBubble.x - p.x;
        down.offY = draggingBubble.y - p.y;

        setPressCursor(true);
        setHoverCursor(false);
      }
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    setPressCursor(true);

    const p = toCanvasPoint(e);

    pointer.active = true;
    pointer.id = e.pointerId;
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.lastX = p.x;
    pointer.lastY = p.y;
    pointer.vx = 0;
    pointer.vy = 0;
    pointer.lastT = performance.now();

    down.active = true;
    down.t = performance.now();
    down.x = p.x;
    down.y = p.y;
    down.bubble = hitBubble(bubbles, p.x, p.y);
    down.offX = 0;
    down.offY = 0;

    // (важно) не лопаем на pointerdown — лопаем на pointerup, если это был “тап”, а не drag
  });

  function endPointer(e?: PointerEvent) {
    setPressCursor(false);

    // If we were dragging: release (no pop)
    if (draggingBubble) {
      // "Throw" already encoded in bubble.vx/vy from pointer velocity
      draggingBubble = null;
      down.active = false;
      down.bubble = null;

      if (e) {
        try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      return;
    }

    // If we had a bubble and didn't drag: it's a tap -> pop
    if (down.active && down.bubble) {
      const b = down.bubble;
      const now = performance.now();

      if (b.popAt === null) {
        pop(b, now);
        registerPopAndMaybeTriggerCombo(b, now);
      }
    }

    down.active = false;
    down.bubble = null;

    if (e) {
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  }

  canvas.addEventListener('pointerup', (e) => endPointer(e));
  canvas.addEventListener('pointercancel', (e) => endPointer(e));

  canvas.addEventListener('pointerleave', () => {
    setHoverCursor(false);
    // pointer might still be down (captured), but for UX it’s ok to reset hover
  });

  let last = performance.now();

  function tick(now: number) {
    requestAnimationFrame(tick);

    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;

    // Clear
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);

    // Spawn
    if (now >= nextSpawnAt) {
      spawn(now);
      nextSpawnAt = now + SPAWN_EVERY;
    }

    // ---- Update physics with age mechanics + push wind ----
    for (const b of bubbles) {
      // Skip movement updates for popped bubbles (they still render while popping)
      if (b.popAt !== null) continue;

      // If bubble is being dragged, we don't integrate it normally (position is set from pointer)
      if (draggingBubble && b === draggingBubble) continue;

      // Age progress 0..1 (ageP=0 at birth -> start speed stays exactly as before)
      const age = now - b.born;
      const ageP = clamp(age / LIFETIME, 0, 1);
      const ageE = ageP * ageP; // subtle early

      // Drift/wobble boost
      const driftBoost = 1 + ageE * (AGE_DRIFT_BOOST - 1);
      b.wobble += dt * (0.9 + b.drift) * driftBoost;

      // Wobble offsets
      const wx = Math.sin(b.wobble) * DRIFT * 0.12 * driftBoost;
      const wy = Math.cos(b.wobble * 0.9) * DRIFT * 0.12 * driftBoost;

      // Buoyancy upward (y axis is down)
      const buoy = AGE_BUOYANCY_MAX * ageE;

      // Random jitter grows with age
      const jitter = AGE_JITTER_MAX * ageE;
      if (jitter > 0) {
        b.vx += rand(-jitter, jitter) * dt;
        b.vy += rand(-jitter, jitter) * dt;
      }

      // PUSH ("wind") from pointer movement near bubbles
      if (pointer.active) {
        const dx = b.x - pointer.x;
        const dy = b.y - pointer.y;
        const d = Math.hypot(dx, dy);

        if (d > 0.0001 && d < PUSH_RADIUS) {
          const nx = dx / d;
          const ny = dy / d;

          const falloff = 1 - d / PUSH_RADIUS; // 0..1
          const pointerSpeed = Math.hypot(pointer.vx, pointer.vy);

          // base push + extra from fast pointer move
          const push = (PUSH_STRENGTH * falloff) * (1 + (pointerSpeed / 800) * PUSH_VEL_INFLUENCE);

          b.vx += nx * push * dt;
          b.vy += ny * push * dt;
        }
      }

      // Integrate
      b.x += (b.vx + wx) * dt;
      b.y += (b.vy + wy - buoy) * dt;

      // Drag increases with age; base drag remains identical at birth
      const baseDrag = 0.02;
      const drag = baseDrag + AGE_DRAG_MAX * ageE;

      b.vx *= (1 - dt * drag);
      b.vy *= (1 - dt * drag);

      // Soften wall bounces near end-of-life (1 at birth -> unchanged)
      const wallBounceFactor = 1 - ageE * (1 - AGE_WALL_BOUNCE_DAMP);

      // NOTE: requires bounceOffWalls signature to accept optional 4th param (bounceFactor)
      bounceOffWalls(b, w, h, wallBounceFactor);
    }

    // Collisions
    resolveBubbleCollisions(bubbles, w, h);

    // ---- Lifetime / growth / auto-pop + render ----
    for (const b of bubbles) {
      const age = now - b.born;

      // Auto-pop after lifetime
      if (b.popAt === null && age >= LIFETIME) {
        pop(b, now);
        registerPopAndMaybeTriggerCombo(b, now);
      }

      // Growth steps (only if not popped)
      if (b.popAt === null) {
        const steps = Math.floor(age / GROW_INTERVAL);
        b.r = b.baseR * Math.pow(GROW_FACTOR, steps);
      }

      drawBubble(ctx, b, now);
    }

    // Dust render on top
    drawRainbowDust(ctx, dust, now, dt);

    // Remove finished popped bubbles
    bubbles = bubbles.filter((b) => {
      const poppedDone = b.popAt !== null && (now - b.popAt) >= POP_DURATION;
      return !poppedDone;
    });
  }

  requestAnimationFrame(tick);

  return () => {
    window.removeEventListener('resize', resize);
    canvas.remove();
  };
}