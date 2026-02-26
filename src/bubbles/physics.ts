import type { TBubble } from './types';
import {
  WALL_BOUNCE,
  WALL_PUSH,
  COLLISION_BOUNCE,
  COLLISION_SEPARATION,
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

export function bounceOffWalls(b: TBubble, w: number, h: number): void {
  const minX = b.r;
  const maxX = w - b.r;
  const minY = b.r;
  const maxY = h - b.r;

  if (b.x < minX) {
    b.x = minX + WALL_PUSH;
    b.vx = Math.abs(b.vx) * WALL_BOUNCE;
  } else if (b.x > maxX) {
    b.x = maxX - WALL_PUSH;
    b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
  }

  if (b.y < minY) {
    b.y = minY + WALL_PUSH;
    b.vy = Math.abs(b.vy) * WALL_BOUNCE;
  } else if (b.y > maxY) {
    b.y = maxY - WALL_PUSH;
    b.vy = -Math.abs(b.vy) * WALL_BOUNCE;
  }
}

export function resolveBubbleCollisions(
  bubbles: TBubble[],
  w: number,
  h: number,
): void {
  for (let i = 0; i < bubbles.length; i++) {
    const a = bubbles[i];
    if (a.popAt !== null) continue;

    for (let j = i + 1; j < bubbles.length; j++) {
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

      const overlap = rr - d;
      const push = overlap * 0.5 * COLLISION_SEPARATION;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;

      const avn = a.vx * nx + a.vy * ny;
      const bvn = b.vx * nx + b.vy * ny;

      if (bvn - avn > 0) continue;

      const impulse = (avn - bvn) * COLLISION_BOUNCE;

      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;

      bounceOffWalls(a, w, h);
      bounceOffWalls(b, w, h);
    }
  }
}
