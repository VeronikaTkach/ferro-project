import { describe, it, expect } from 'vitest';
import { rand, clamp, dist2, bounceOffWalls, resolveBubbleCollisions } from './physics';
import type { TBubble } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBubble(overrides: Partial<TBubble> = {}): TBubble {
  return {
    id: 1,
    x: 100,
    y: 100,
    r: 20,
    vx: 0,
    vy: 0,
    drift: 1,
    wobble: 0,
    born: 0,
    popAt: null,
    strokeStops: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// rand
// ---------------------------------------------------------------------------

describe('rand', () => {
  it('returns a value within [min, max]', () => {
    for (let i = 0; i < 200; i++) {
      const v = rand(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('returns min when min === max', () => {
    expect(rand(7, 7)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

describe('clamp', () => {
  it('returns value unchanged when within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to lower bound', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('clamps to upper bound', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns boundary value exactly at lower bound', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns boundary value exactly at upper bound', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// dist2
// ---------------------------------------------------------------------------

describe('dist2', () => {
  it('returns 0 for identical points', () => {
    expect(dist2(3, 4, 3, 4)).toBe(0);
  });

  it('returns correct squared distance for a 3-4-5 triangle', () => {
    expect(dist2(0, 0, 3, 4)).toBe(25);
  });

  it('is symmetric', () => {
    expect(dist2(1, 2, 5, 6)).toBe(dist2(5, 6, 1, 2));
  });
});

// ---------------------------------------------------------------------------
// bounceOffWalls
// ---------------------------------------------------------------------------

describe('bounceOffWalls', () => {
  const W = 800;
  const H = 600;

  it('does not modify a bubble well within bounds', () => {
    const b = makeBubble({ x: 400, y: 300, r: 20, vx: 10, vy: 10 });
    bounceOffWalls(b, W, H);
    expect(b.x).toBe(400);
    expect(b.y).toBe(300);
    expect(b.vx).toBe(10);
    expect(b.vy).toBe(10);
  });

  it('reflects vx and repositions when bubble exits left wall', () => {
    const b = makeBubble({ x: 5, y: 300, r: 20, vx: -50, vy: 0 });
    bounceOffWalls(b, W, H);
    expect(b.x).toBeGreaterThanOrEqual(b.r);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('reflects vx and repositions when bubble exits right wall', () => {
    const b = makeBubble({ x: W - 5, y: 300, r: 20, vx: 50, vy: 0 });
    bounceOffWalls(b, W, H);
    expect(b.x).toBeLessThanOrEqual(W - b.r);
    expect(b.vx).toBeLessThan(0);
  });

  it('reflects vy and repositions when bubble exits top wall', () => {
    const b = makeBubble({ x: 400, y: 5, r: 20, vx: 0, vy: -50 });
    bounceOffWalls(b, W, H);
    expect(b.y).toBeGreaterThanOrEqual(b.r);
    expect(b.vy).toBeGreaterThan(0);
  });

  it('reflects vy and repositions when bubble exits bottom wall', () => {
    const b = makeBubble({ x: 400, y: H - 5, r: 20, vx: 0, vy: 50 });
    bounceOffWalls(b, W, H);
    expect(b.y).toBeLessThanOrEqual(H - b.r);
    expect(b.vy).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// resolveBubbleCollisions
// ---------------------------------------------------------------------------

describe('resolveBubbleCollisions', () => {
  const W = 800;
  const H = 600;

  it('does not modify bubbles that are far apart', () => {
    const a = makeBubble({ id: 1, x: 100, y: 100, r: 20, vx: 0, vy: 0 });
    const b = makeBubble({ id: 2, x: 400, y: 400, r: 20, vx: 0, vy: 0 });
    resolveBubbleCollisions([a, b], W, H);
    expect(a.x).toBe(100);
    expect(b.x).toBe(400);
  });

  it('pushes overlapping bubbles further apart each call', () => {
    // COLLISION_SEPARATION=0.6 resolves 60% of overlap per frame by design,
    // so a single call won't fully separate deeply overlapping bubbles.
    // The correct invariant is: distance increases after each call.
    const a = makeBubble({ id: 1, x: 200, y: 300, r: 20, vx: -10, vy: 0 });
    const b = makeBubble({ id: 2, x: 210, y: 300, r: 20, vx:  10, vy: 0 });
    const distBefore = Math.sqrt(dist2(a.x, a.y, b.x, b.y));
    resolveBubbleCollisions([a, b], W, H);
    const distAfter = Math.sqrt(dist2(a.x, a.y, b.x, b.y));
    expect(distAfter).toBeGreaterThan(distBefore);
  });

  it('skips bubbles that are popping', () => {
    const a = makeBubble({ id: 1, x: 200, y: 300, r: 20, vx: 0, vy: 0, popAt: 100 });
    const b = makeBubble({ id: 2, x: 210, y: 300, r: 20, vx: 0, vy: 0 });
    const bxBefore = b.x;
    resolveBubbleCollisions([a, b], W, H);
    // b should not be pushed since a is popping
    expect(b.x).toBe(bxBefore);
  });
});
