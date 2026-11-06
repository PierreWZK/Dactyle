// Effets visuels liés au niveau. Aucun effet n'est joué si l'utilisateur
// a demandé de réduire les animations.

export interface LevelLook {
  hue: number; // teinte de l'accent, propre à chaque niveau
  tier: number; // 0 à 4 : un palier tous les 10 niveaux
  tierName: string;
}

const TIER_NAMES = ['Bronze', 'Argent', 'Or', 'Platine', 'Légende'];
const TIER_HUES = [16, 200, 45, 270, 300]; // le palier 5 évite le rouge des fautes

// Chaque niveau a sa teinte ; chaque palier ajoute des effets (voir main.ts et style.css).
export function levelLook(level: number): LevelLook {
  const tier = Math.min(TIER_NAMES.length - 1, Math.floor((level - 1) / 10));
  const hue = (TIER_HUES[tier] + ((level - 1) % 10) * 3) % 360;
  return { hue, tier, tierName: TIER_NAMES[tier] };
}

export function applyLook(look: LevelLook): void {
  const root = document.documentElement;
  root.style.setProperty('--accent', `hsl(${look.hue} 90% 55%)`);
  root.dataset.tier = String(look.tier);
}

export function resetLook(): void {
  const root = document.documentElement;
  root.style.removeProperty('--accent');
  delete root.dataset.tier;
}

export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function particle(x: number, y: number, color: string, size: number): HTMLElement {
  const el = document.createElement('span');
  el.className = 'particle';
  el.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${color}`;
  document.body.appendChild(el);
  return el;
}

// Gerbe de particules autour d'un point de l'écran.
export function burst(x: number, y: number, count: number, hue: number, spread = 70): void {
  if (reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const el = particle(x, y, `hsl(${hue + Math.random() * 40 - 20} 90% 60%)`, 4 + Math.random() * 4);
    const angle = Math.random() * Math.PI * 2;
    const dist = spread * (0.4 + Math.random() * 0.6);
    el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0)`, opacity: 0 },
      ],
      { duration: 450 + Math.random() * 350, easing: 'ease-out' },
    ).onfinish = () => el.remove();
  }
}

// Confettis qui tombent du haut de l'écran : plus nombreux aux niveaux élevés.
export function confetti(count: number, hue: number): void {
  if (reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const el = particle(Math.random() * window.innerWidth, -10, `hsl(${hue + Math.random() * 120 - 60} 85% 58%)`, 6 + Math.random() * 6);
    el.style.borderRadius = '2px';
    const drift = Math.random() * 160 - 80;
    el.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${drift}px, ${window.innerHeight * 0.9}px) rotate(${Math.random() * 720}deg)`, opacity: 0.2 },
      ],
      { duration: 1100 + Math.random() * 900, easing: 'cubic-bezier(0.3, 0.6, 0.6, 1)', delay: Math.random() * 300 },
    ).onfinish = () => el.remove();
  }
}

// Bandeau « Niveau N » qui apparaît au lancement, sans bloquer la saisie.
export function showIntro(title: string, look: LevelLook): void {
  const el = document.createElement('div');
  el.className = 'intro';
  el.innerHTML = `<strong>${title}</strong><span>${look.tierName}</span>`;
  document.body.appendChild(el);
  if (reducedMotion()) {
    setTimeout(() => el.remove(), 900);
    return;
  }
  el.animate(
    [
      { opacity: 0, transform: 'scale(0.7)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.25 },
      { opacity: 1, transform: 'scale(1)', offset: 0.7 },
      { opacity: 0, transform: 'scale(1.15)' },
    ],
    { duration: 1000, easing: 'ease-out' },
  ).onfinish = () => el.remove();
}

// Éclair plein écran (paliers élevés, à chaque mot validé).
export function flash(hue: number): void {
  if (reducedMotion()) return;
  const el = document.createElement('div');
  el.className = 'flash';
  el.style.background = `hsl(${hue} 90% 60%)`;
  document.body.appendChild(el);
  el.animate([{ opacity: 0.28 }, { opacity: 0 }], { duration: 350, easing: 'ease-out' }).onfinish = () => el.remove();
}

let measureCtx: CanvasRenderingContext2D | null = null;

// Position écran approximative du curseur dans un champ de saisie.
export function caretPoint(input: HTMLInputElement): { x: number; y: number } {
  const rect = input.getBoundingClientRect();
  const style = getComputedStyle(input);
  measureCtx ??= document.createElement('canvas').getContext('2d');
  let width = 0;
  if (measureCtx) {
    measureCtx.font = style.font;
    width = measureCtx.measureText(input.value).width;
  }
  return { x: rect.left + parseFloat(style.paddingLeft) + width, y: rect.top + rect.height / 2 };
}
