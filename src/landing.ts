import './landing.css';
import { fetchDaily } from './api/client';
import { THEMES } from './data/themes';
import { todayKey } from './game/daily';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Pastilles des thèmes, toujours synchronisées avec les données du jeu.
byId('theme-chips').innerHTML = THEMES.map(
  (t) => `<span class="chip${t.difficulty === 'Expert' ? ' expert' : ''}">${t.name}<small>${t.difficulty}</small></span>`,
).join('');

// Activité du jour, si le classement répond.
fetchDaily(todayKey())
  .then(({ entries }) => {
    if (entries.length === 0) return;
    const best = entries.find((e) => e.success);
    byId('live').innerHTML =
      `Aujourd’hui : <strong>${entries.length} joueur${entries.length > 1 ? 's' : ''}</strong> au classement` +
      (best ? `, meilleur temps <strong>${(best.elapsedMs / 1000).toFixed(1)} s</strong>.` : '.');
  })
  .catch(() => {});

// Démonstration : un mot recopié lettre par lettre, avec une faute de temps en temps.
const DEMO = [
  { theme: 'Animaux', word: 'Éléphant', slip: true },
  { theme: 'Espace', word: 'Astéroïde', slip: false },
  { theme: 'Cuisine', word: 'Ratatouille', slip: true },
  { theme: 'Programmation', word: 'console.log("test")', slip: false },
  { theme: 'Océan', word: 'Hippocampe', slip: true },
];

const themeEl = byId('demo-theme');
const wordEl = byId('demo-word');
const typedEl = byId('demo-typed');
const timerEl = byId('demo-timer');
const hintEl = byId('demo-hint');
const inputEl = typedEl.parentElement as HTMLElement;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function render(word: string, typed: string, wrong: boolean): void {
  wordEl.innerHTML = [...word]
    .map((c, i) => {
      const state = i < typed.length ? (wrong && i === typed.length - 1 ? 'bad' : 'ok') : 'todo';
      return `<span class="${state}">${esc(c)}</span>`;
    })
    .join('');
  typedEl.textContent = typed;
  inputEl.classList.toggle('error', wrong);
}

async function play(): Promise<void> {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (let i = 0; ; i = (i + 1) % DEMO.length) {
    const { theme, word, slip } = DEMO[i];
    themeEl.textContent = theme;
    render(word, '', false);
    timerEl.textContent = '0.0 s';
    hintEl.textContent = 'Commence à taper pour lancer le chrono.';
    if (reduced) {
      // Sans animation : on montre simplement le mot de chaque thème.
      render(word, word, false);
      timerEl.textContent = '1.8 s';
      hintEl.textContent = 'Réussi !';
      await wait(2500);
      continue;
    }
    await wait(900);
    const start = performance.now();
    const tick = setInterval(() => (timerEl.textContent = `${((performance.now() - start) / 1000).toFixed(1)} s`), 100);
    hintEl.textContent = 'Continue !';
    let typed = '';
    for (const [k, ch] of [...word].entries()) {
      if (slip && k === 3) {
        render(word, typed + 'x', true); // une faute, vite corrigée
        hintEl.textContent = 'Faute : efface pour corriger.';
        await wait(450);
        render(word, typed, false);
        hintEl.textContent = 'Continue !';
        await wait(150);
      }
      typed += ch;
      render(word, typed, false);
      await wait(95 + Math.random() * 70);
    }
    clearInterval(tick);
    hintEl.textContent = 'Réussi !';
    await wait(1400);
  }
}

void play();
