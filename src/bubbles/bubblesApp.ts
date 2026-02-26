
type TColorStop = { t: number; c: string };

type TBubble = {
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

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

function randomIridescentStops(): TColorStop[] {
  const palette = [
    'rgba(255, 80, 80, 0.95)',
    'rgba(255, 210, 80, 0.95)',
    'rgba(120, 255, 140, 0.95)',
    'rgba(80, 210, 255, 0.95)',
    'rgba(190, 120, 255, 0.95)',
    'rgba(255, 120, 220, 0.95)',
  ];

  const stops: TColorStop[] = [];
  const n = 4 + Math.floor(Math.random() * 3); // 4..6
  for (let i = 0; i < n; i++) {
    stops.push({
      t: i / (n - 1),
      c: palette[Math.floor(Math.random() * palette.length)],
    });
  }
  stops.sort(() => Math.random() - 0.5);
  return stops.map((s, i) => ({ t: i / (stops.length - 1), c: s.c }));
}

export function startBubblesApp(root: HTMLElement) {
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

  // =========================
  // CONFIG
  // =========================
  const BACKGROUND = '#ffffff';
  const SPAWN_EVERY = 5000; // каждые 5 секунд
  const POP_DURATION = 150; // мс
  const BASE_SPEED = 48;    // px/s
  const DRIFT = 18;         // wobble
  const MIN_R = 42;
  const MAX_R = 92;

  // БАТУТ ОТ СТЕНОК
  const WALL_BOUNCE = 0.98;  // 1 = идеально упруго, <1 чуть “гасит”
  const WALL_PUSH = 0.5;     // маленький толчок внутрь (избавляет от “залипания”)

  // СТОЛКНОВЕНИЯ ПУЗЫРЕЙ
  const COLLISION_BOUNCE = 0.98;  // упругость между пузырями
  const COLLISION_SEPARATION = 0.6; // насколько агрессивно раздвигать перекрытие

  // Чтобы O(n^2) не умерло, можно лимитировать (по желанию)
  const MAX_BUBBLES = 30;

  // =========================
  // STATE
  // =========================
  let bubbles: TBubble[] = [];
  let idSeq = 1;
  let nextSpawnAt = performance.now();

  function spawn(now: number) {
    const r = rand(MIN_R, MAX_R);
    const angle = rand(0, Math.PI * 2);
    const speed = rand(BASE_SPEED * 0.75, BASE_SPEED * 1.2);

    // старт строго в центре, но если там уже тесно — чуть раздвинем случайно
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

    // держим верхнюю границу количества (иначе столкновения станут тяжёлыми)
    if (bubbles.length > MAX_BUBBLES) {
      // удаляем самый старый (который не лопается прямо сейчас)
      bubbles.shift();
    }
  }

  function hitBubble(clientX: number, clientY: number): TBubble | null {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (dist2(clientX, clientY, b.x, b.y) <= b.r * b.r) return b;
    }
    return null;
  }

  function pop(b: TBubble, now: number) {
    if (b.popAt !== null) return;
    b.popAt = now;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const b = hitBubble(e.clientX, e.clientY);
    if (b) pop(b, performance.now());
  });

  function drawBubble(b: TBubble, now: number) {
    const popP = b.popAt ? clamp((now - b.popAt) / POP_DURATION, 0, 1) : 0;
    const appearP = clamp((now - b.born) / 240, 0, 1);

    let alpha = 0.95 * appearP;
    if (b.popAt) alpha *= (1 - popP);

    const r = b.r * (b.popAt ? (1 - popP * 0.35) : 1);

    const grad = ctx.createLinearGradient(b.x - r, b.y - r, b.x + r, b.y + r);
    for (const s of b.strokeStops) grad.addColorStop(s.t, s.c);

    const inner = ctx.createRadialGradient(
      b.x - r * 0.25, b.y - r * 0.25, r * 0.1,
      b.x, b.y, r
    );
    inner.addColorStop(0, `rgba(255,255,255,${0.55 * alpha})`);
    inner.addColorStop(0.45, `rgba(255,255,255,${0.18 * alpha})`);
    inner.addColorStop(1, `rgba(255,255,255,0)`);

    const hl = ctx.createRadialGradient(
      b.x - r * 0.3, b.y - r * 0.35, 0,
      b.x - r * 0.3, b.y - r * 0.35, r * 0.55
    );
    hl.addColorStop(0, `rgba(255,255,255,${0.45 * alpha})`);
    hl.addColorStop(1, `rgba(255,255,255,0)`);

    const strokeW = (2.0 + Math.sin((now + b.id * 50) * 0.006) * 0.6) * (1 - popP * 0.7);

    ctx.save();

    // тело
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = inner;
    ctx.fill();

    // блик
    ctx.beginPath();
    ctx.arc(b.x - r * 0.15, b.y - r * 0.2, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = hl;
    ctx.fill();

    // обводка
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = grad;
    ctx.lineWidth = strokeW;
    ctx.globalAlpha = alpha;
    ctx.stroke();

    // pop ring
    if (b.popAt) {
      ctx.globalAlpha = (1 - popP) * 0.35;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r + popP * 18, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  // =========================
  // PHYSICS HELPERS
  // =========================
  function bounceOffWalls(b: TBubble) {
    // границы — так, чтобы окружность оставалась внутри
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

  function resolveBubbleCollisions() {
    // столкновения считаем только для “живых” (не лопающих) пузырей
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

        // 1) раздвигаем, чтобы не перекрывались
        const overlap = rr - d;
        const push = overlap * 0.5 * COLLISION_SEPARATION;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;

        // 2) упругое отражение вдоль нормали (массы одинаковые)
        const avn = a.vx * nx + a.vy * ny; // проекция скорости на нормаль
        const bvn = b.vx * nx + b.vy * ny;

        // если уже “разлетаются” вдоль нормали — не трогаем
        if (bvn - avn > 0) continue;

        const impulse = (avn - bvn) * COLLISION_BOUNCE;

        a.vx -= impulse * nx;
        a.vy -= impulse * ny;

        b.vx += impulse * nx;
        b.vy += impulse * ny;

        // после изменения — ещё раз убеждаемся, что внутри экрана
        bounceOffWalls(a);
        bounceOffWalls(b);
      }
    }
  }

  // =========================
  // LOOP
  // =========================
  let last = performance.now();

  function tick(now: number) {
    requestAnimationFrame(tick);

    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;

    // фон
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);

    // спавн каждые 5 секунд
    if (now >= nextSpawnAt) {
      spawn(now);
      nextSpawnAt = now + SPAWN_EVERY;
    }

    // update positions
    for (const b of bubbles) {
      // если пузырь лопается — можно слегка продолжать движение (или заморозить)
      // оставим движение для приятности, но столкновения для лопающихся отключены
      b.wobble += dt * (0.9 + b.drift);

      const wx = Math.sin(b.wobble) * DRIFT * 0.12;
      const wy = Math.cos(b.wobble * 0.9) * DRIFT * 0.12;

      b.x += (b.vx + wx) * dt;
      b.y += (b.vy + wy) * dt;

      // чуть “воздуха”
      b.vx *= (1 - dt * 0.02);
      b.vy *= (1 - dt * 0.02);

      // отскок от стен (всегда)
      bounceOffWalls(b);
    }

    // столкновения пузырей (только живые)
    resolveBubbleCollisions();

    // draw
    for (const b of bubbles) {
      drawBubble(b, now);
    }

    // cleanup: удаляем полностью лопнувшие
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