const MECHANICS = [
  'Click or tap a bubble to pop it',
  'Bubbles bounce off walls and each other',
  'A new bubble spawns every 5 seconds',
  'Each bubble has a unique iridescent shimmer',
  'Up to 30 bubbles can float at once',
];

const FADE_MS = 250;

export function showIntroOverlay(): () => void {
  // ── Build DOM ──────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'intro-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'How to play');

  const card = document.createElement('div');
  card.className = 'intro-card';

  const title = document.createElement('h1');
  title.className = 'intro-title';
  title.textContent = 'Soap Bubbles';

  const list = document.createElement('ul');
  list.className = 'intro-list';
  for (const text of MECHANICS) {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  }

  const btn = document.createElement('button');
  btn.className = 'intro-btn';
  btn.type = 'button';
  btn.textContent = 'Enter';

  const tip = document.createElement('p');
  tip.className = 'intro-tip';
  tip.textContent = 'Press Enter to start';

  card.appendChild(title);
  card.appendChild(list);
  card.appendChild(btn);
  card.appendChild(tip);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  btn.focus();

  // ── Dismiss ────────────────────────────────────────────────────────────────
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dismissed = false;

  function dismiss(): void {
    if (dismissed) return;
    dismissed = true;

    btn.removeEventListener('click', dismiss);
    document.removeEventListener('keydown', onKeyDown);

    if (reducedMotion) {
      overlay.remove();
    } else {
      overlay.classList.add('intro-overlay--out');
      setTimeout(() => overlay.remove(), FADE_MS);
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') dismiss();
  }

  btn.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKeyDown);

  return dismiss;
}
