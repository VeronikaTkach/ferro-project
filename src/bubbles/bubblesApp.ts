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
} from './config';
import { rand, bounceOffWalls, resolveBubbleCollisions } from './physics';
import { randomIridescentStops, drawBubble } from './renderer';
import { hitBubble, isHoveringBubble, pop } from './input';

export function startBubblesApp(root: HTMLElement): () => void {
  root.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  root.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: false })!;
  let w = 0, h = 0, dpr = 1;

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
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drift: rand(0.6, 1.2),
      wobble: rand(0, Math.PI * 2),
      born: now,
      popAt: null,
      strokeStops: randomIridescentStops(),
    });

    if (bubbles.length > MAX_BUBBLES) {
      bubbles.shift();
    }
  }

  function toCanvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function setHoverCursor(hovering: boolean) {
    canvas.classList.toggle('is-hovering-bubble', hovering);
  }

  function setPressCursor(pressing: boolean) {
    canvas.classList.toggle('is-pressing', pressing);
  }

  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvasPoint(e);
    setHoverCursor(isHoveringBubble(bubbles, p.x, p.y));
  });

  canvas.addEventListener('pointerdown', (e) => {
    setPressCursor(true);

    const p = toCanvasPoint(e);
    const b = hitBubble(bubbles, p.x, p.y);
    if (b) pop(b, performance.now());
  });

  canvas.addEventListener('pointerup', () => {
    setPressCursor(false);
  });

  canvas.addEventListener('pointercancel', () => {
    setPressCursor(false);
  });

  canvas.addEventListener('pointerleave', () => {
    setHoverCursor(false);
    setPressCursor(false);
  });

  let last = performance.now();

  function tick(now: number) {
    requestAnimationFrame(tick);

    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;

    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);

    if (now >= nextSpawnAt) {
      spawn(now);
      nextSpawnAt = now + SPAWN_EVERY;
    }

    for (const b of bubbles) {
      b.wobble += dt * (0.9 + b.drift);

      const wx = Math.sin(b.wobble) * DRIFT * 0.12;
      const wy = Math.cos(b.wobble * 0.9) * DRIFT * 0.12;

      b.x += (b.vx + wx) * dt;
      b.y += (b.vy + wy) * dt;

      b.vx *= (1 - dt * 0.02);
      b.vy *= (1 - dt * 0.02);

      bounceOffWalls(b, w, h);
    }

    resolveBubbleCollisions(bubbles, w, h);

    for (const b of bubbles) {
      drawBubble(ctx, b, now);
    }

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
