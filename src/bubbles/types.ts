export type TColorStop = { t: number; c: string };

export type TBubble = {
  id: number;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  drift: number;
  wobble: number;
  born: number;
  popAt: number | null;
  strokeStops: TColorStop[];
};
