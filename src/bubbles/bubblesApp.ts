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
const PUSH_STRENGTH = 120;         // base push strength
const PUSH_VEL_INFLUENCE = 0.65;   // how much pointer velocity affects push

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
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.lastX = p.x;
    pointer.lastY = p.y;
    pointer.vx = 0;
    pointer.vy = 0;
    pointer.lastT = performance.now();

    down.active = true;
    down.x = p.x;
    down.y = p.y;
    down.bubble = hitBubble(bubbles, p.x, p.y);
    down.offX = 0;
    down.offY = 0;

    // Important: we don't pop on pointerdown.
    // We pop on pointerup if no drag happened.
  });

  function endPointer(e?: PointerEvent) {
    setPressCursor(false);

    // If we were dragging: release (no pop)
    if (draggingBubble) {
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
      if (b.popAt === null) pop(b, now);
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
      }

      // Growth steps (only if not popped)
      if (b.popAt === null) {
        const steps = Math.floor(age / GROW_INTERVAL);
        b.r = b.baseR * Math.pow(GROW_FACTOR, steps);
      }

      drawBubble(ctx, b, now);
    }

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