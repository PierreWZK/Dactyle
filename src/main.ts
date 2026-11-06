import './style.css';
import { THEMES, type Theme } from './data/themes';
import { LEVEL_COUNT, buildLevel } from './data/levels';
import { TypingGame, type GameResult } from './game/engine';

const app = document.querySelector<HTMLElement>('#app')!;

let theme: Theme = THEMES[0];
let level = 1;
let game: TypingGame;
let frame = 0;

function show(html: string): void {
  app.innerHTML = html;
}

function showThemes(): void {
  stopLoop();
  show(`
    <h1 class="title">Dactyle</h1>
    <p class="subtitle">Choisis un thème</p>
    <div class="cards">
      ${THEMES.map(
        (t) => `<button class="card" data-theme="${t.id}">
          <strong>${t.name}</strong><span>${t.difficulty}</span>
        </button>`,
      ).join('')}
    </div>`);
  app.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      theme = THEMES.find((t) => t.id === btn.dataset.theme)!;
      showLevels();
    });
  });
}

function showLevels(): void {
  stopLoop();
  const buttons = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1)
    .map((n) => `<button class="level" data-level="${n}">${n}</button>`)
    .join('');
  show(`
    <button class="link" id="back">← Thèmes</button>
    <h1 class="title">${theme.name}</h1>
    <p class="subtitle">Choisis un niveau</p>
    <div class="levels">${buttons}</div>`);
  app.querySelector('#back')!.addEventListener('click', showThemes);
  app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((btn) => {
    btn.addEventListener('click', () => startLevel(Number(btn.dataset.level)));
  });
}

function startLevel(n: number): void {
  level = n;
  const spec = buildLevel(theme, n);
  game = new TypingGame(spec.words, spec.timeLimitMs);
  showGame();
  startLoop();
}

function showGame(): void {
  show(`
    <header class="hud">
      <span class="hud-label">${theme.name} · Niveau ${level}</span>
      <span class="timer" id="timer"></span>
    </header>
    <p class="progress" id="progress"></p>
    <ol class="words" id="words"></ol>
    <input class="entry" id="entry" type="text" autocomplete="off"
      autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Saisie" />
    <p class="feedback" id="feedback">Commence à taper pour lancer le chrono.</p>`);

  const entry = el<HTMLInputElement>('entry');
  entry.focus();
  entry.addEventListener('input', () => {
    game.handleInput(entry.value, performance.now());
    entry.value = game.input;
    renderGame();
    if (game.status === 'success' || game.status === 'failed') showResult();
  });
  renderGame();
}

function renderGame(): void {
  const entry = el<HTMLInputElement>('entry');
  entry.classList.toggle('error', game.hasError);

  el('words').innerHTML = game.words
    .map((w, i) => {
      const state = i < game.currentIndex ? 'done' : i === game.currentIndex ? 'current' : 'todo';
      return `<li class="word ${state}">${w}</li>`;
    })
    .join('');

  el('progress').textContent = `${game.currentIndex} / ${game.words.length} mots`;
  el('feedback').textContent = game.hasError
    ? 'Faute : efface pour corriger.'
    : game.status === 'playing'
      ? 'Continue !'
      : 'Commence à taper pour lancer le chrono.';
}

function startLoop(): void {
  frame = requestAnimationFrame(loop);
}

function stopLoop(): void {
  cancelAnimationFrame(frame);
}

// Le temps vient de performance.now(), pas du nombre d'images affichées.
function loop(): void {
  const now = performance.now();
  if (game.tick(now) === 'failed') {
    showResult();
    return;
  }
  el('timer').textContent = formatSeconds(game.remainingMs(now));
  frame = requestAnimationFrame(loop);
}

function showResult(): void {
  stopLoop();
  const r: GameResult = game.result(performance.now());
  const canNext = r.success && level < LEVEL_COUNT;
  show(`
    <h1 class="title ${r.success ? 'win' : 'lose'}">${r.success ? 'Réussi !' : 'Échec'}</h1>
    <dl class="stats">
      <div><dt>Temps</dt><dd>${formatSeconds(r.elapsedMs)}</dd></div>
      <div><dt>Mots</dt><dd>${r.wordsDone} / ${r.totalWords}</dd></div>
      <div><dt>Précision</dt><dd>${r.precision} %</dd></div>
      <div><dt>Vitesse</dt><dd>${r.wpm} MPM</dd></div>
    </dl>
    <div class="actions">
      <button class="btn" id="retry">Rejouer</button>
      ${canNext ? '<button class="btn primary" id="next">Niveau suivant</button>' : ''}
      <button class="btn ghost" id="levels">Niveaux</button>
    </div>`);
  el('retry').addEventListener('click', () => startLevel(level));
  el('levels').addEventListener('click', showLevels);
  if (canNext) el('next').addEventListener('click', () => startLevel(level + 1));
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

showThemes();
