export const BACKGROUND      = '#ffffff';
export const SPAWN_EVERY     = 5000;  // ms between spawns
export const POP_DURATION    = 150;   // ms
export const BASE_SPEED      = 48;    // px/s
export const DRIFT           = 18;    // wobble amplitude
export const MIN_R           = 42;
export const MAX_R           = 92;

export const WALL_BOUNCE          = 0.98;  // 1 = perfectly elastic
export const WALL_PUSH            = 0.5;   // small inward nudge to prevent sticking

export const COLLISION_BOUNCE     = 0.98;
export const COLLISION_SEPARATION = 0.6;

export const MAX_BUBBLES = 30;

export const RENDER_STYLE: 'classic' | 'glass-film' = 'glass-film';

export const LIFETIME = 36_000;        // 36 seconds
export const GROW_INTERVAL = 1_000;    // every 1 seconds
export const GROW_FACTOR = 1.005;        // +0.5%

export const AGE_DRAG_MAX = 0.22;          // extra drag by end-of-life
export const AGE_DRIFT_BOOST = 1.6;        // wobble drift multiplier at end
export const AGE_BUOYANCY_MAX = 22;        // px/s upward lift at end
export const AGE_JITTER_MAX = 10;          // px/s random jitter at end
export const AGE_WALL_BOUNCE_DAMP = 0.88;  // soften wall bounces for old bubbles
export const AGE_POP_ON_HARD_HIT = true;
export const AGE_HARD_HIT_SPEED = 520;     // px/s threshold for “hard hit”