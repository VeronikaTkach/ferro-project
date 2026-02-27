import type { TBubble } from './types';
import {
  WALL_BOUNCE,
  WALL_PUSH,
  COLLISION_BOUNCE,
  COLLISION_SEPARATION,
  MAX_R,
} from './config';

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function dist2(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function bounceOffWalls(b: TBubble, w: number, h: number, bounceFactor = 1): void {
  const minX = b.r;
  const maxX = w - b.r;
  const minY = b.r;
  const maxY = h - b.r;

  const B = WALL_BOUNCE * bounceFactor;

  if (b.x < minX) {
    b.x = minX + WALL_PUSH;
    b.vx = Math.abs(b.vx) * B;
  } else if (b.x > maxX) {
    b.x = maxX - WALL_PUSH;
    b.vx = -Math.abs(b.vx) * B;
  }

  if (b.y < minY) {
    b.y = minY + WALL_PUSH;
    b.vy = Math.abs(b.vy) * B;
  } else if (b.y > maxY) {
    b.y = maxY - WALL_PUSH;
    b.vy = -Math.abs(b.vy) * B;
  }
}

export function resolveBubbleCollisions(
  bubbles: TBubble[],
  w: number,
  h: number,
): void {
  // Размер ячейки: диаметр max пузыря — хороший дефолт.
  // Можно увеличить до MAX_R * 2.2 если захочешь меньше ячеек.
  const cellSize = Math.max(24, MAX_R * 2);

  // Map cellKey -> indices
  const grid = new Map<number, number[]>();

  const inv = 1 / cellSize;

  function key(cx: number, cy: number): number {
    // Упакуем 2 int16-ish в один int32.
    // Для больших координат тоже ок, пока cx,cy в адекватных пределах.
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }

  // 1) Build grid
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (b.popAt !== null) continue;

    const cx = Math.floor(b.x * inv);
    const cy = Math.floor(b.y * inv);
    const k = key(cx, cy);

    const arr = grid.get(k);
    if (arr) arr.push(i);
    else grid.set(k, [i]);
  }

  // 2) Check collisions within neighbor cells
  for (let i = 0; i < bubbles.length; i++) {
    const a = bubbles[i];
    if (a.popAt !== null) continue;

    const acx = Math.floor(a.x * inv);
    const acy = Math.floor(a.y * inv);

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const k = key(acx + ox, acy + oy);
        const bucket = grid.get(k);
        if (!bucket) continue;

        for (let bi = 0; bi < bucket.length; bi++) {
          const j = bucket[bi];
          if (j <= i) continue; // избегаем дублей и self

          const b = bubbles[j];
          if (b.popAt !== null) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const rr = a.r + b.r;
          const d2 = dx * dx + dy * dy;

          if (d2 >= rr * rr) continue;

          const d = Math.sqrt(d2) || 0.0001;
          const nx = dx / d;
          const ny = dy / d;

          // Separation
          const overlap = rr - d;
          const push = overlap * 0.5 * COLLISION_SEPARATION;

          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;

          // Velocity impulse along normal
          const avn = a.vx * nx + a.vy * ny;
          const bvn = b.vx * nx + b.vy * ny;

          if (bvn - avn > 0) continue;

          const impulse = (avn - bvn) * COLLISION_BOUNCE;

          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;

          // Keep inside bounds
          bounceOffWalls(a, w, h);
          bounceOffWalls(b, w, h);
        }
      }
    }
  }
}
