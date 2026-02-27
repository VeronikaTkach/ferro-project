import type { TBubble } from './types';
import { dist2 } from './physics';

export function hitBubble(
  bubbles: TBubble[],
  clientX: number,
  clientY: number,
): TBubble | null {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (dist2(clientX, clientY, b.x, b.y) <= b.r * b.r) return b;
  }
  return null;
}

export function isHoveringBubble(
  bubbles: TBubble[],
  clientX: number,
  clientY: number,
): boolean {
  return hitBubble(bubbles, clientX, clientY) !== null;
}

export function pop(b: TBubble, now: number): void {
  if (b.popAt !== null) return;
  b.popAt = now;
}