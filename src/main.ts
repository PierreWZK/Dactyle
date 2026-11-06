import './style.css';
import { THEMES, type Theme } from './data/themes';
import { LEVEL_COUNT, buildLevel } from './data/levels';
import { TypingGame, type GameResult } from './game/engine';
import { getProgress, globalStats, isLevelUnlocked, recordResult } from './storage/save';

const app = document.querySelector<HTMLElement>('#app')!;

let theme: Theme = THEMES[0];
let level = 1;
let game: TypingGame;
let frame = 0;
let justAdvanced = false;

function show(html: string): void {
  app.innerHTML = html;
  // Relance l'animation d'entrée à chaque changement d'écran.
  app.classList.remove('enter');
  void app.offsetWidth;
  app.classList.add('enter');
}

function showThemes(): void {
  stopLoop();
  const g = globalStats();
  show(`
    <h1 class="title">Dactyle</h1>
    <p class="subtitle">Choisis un thème</p>
    <div class="cards">
      ${THEMES.map((t) => {
        const p = getProgress(t.id);
        return `<button class="card" data-theme="${t.id}">
          <strong>${t.name}</strong>
          <span>${t.difficulty} · ${Math.min(p.unlocked, LEVEL_COUNT)} / ${LEVEL_COUNT} niveaux débloqués</span>
        </button>`;
      }).join('')}
    </div>
    <p class="summary">Parties : ${g.played} · Réussies : ${g.won} · Meilleure vitesse : ${g.bestWpm} MPM</p>`);
  app.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      theme = THEMES.find((t) => t.id === btn.dataset.theme)!;
      showLevels();
    });
  });
}

function showLevels(): void {
  stopLoop();
  const progress = getProgress(theme.id);
  const buttons = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1)
    .map((n) => {
      const locked = !isLevelUnlocked(theme.id, n);
      const best = progress.bestMs[n];
      const label = locked ? 'Verrouillé' : best !== undefined ? formatSeconds(best) : 'Jouer';
      return `<button class="level${locked ? ' locked' : ''}" data-level="${n}" ${locked ? 'disabled' : ''}>
        <strong>${n}</strong><span>${label}</span>
      </button>`;
    })
    .join('');
  show(`
    <button class="link" id="back">← Thèmes</button>
    <h1 class="title">${theme.name}</h1>
    <p class="subtitle">Choisis un niveau · meilleur temps affiché sous chaque niveau</p>
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
    const before = game.currentIndex;
    game.handleInput(entry.value, performance.now());
    entry.value = game.input;
    justAdvanced = game.currentIndex !== before;
    renderGame();
    if (game.status === 'success' || game.status === 'failed') showResult();
  });
  renderGame();
}

function renderGame(): void {
  const entry = el<HTMLInputElement>('entry');
  entry.classList.toggle('error', game.hasError);

  const letters = game.letterStates;
  el('words').innerHTML = game.words
    .map((w, i) => {
      if (i < game.currentIndex) return `<li class="word done">${w}</li>`;
      if (i > game.currentIndex) return `<li class="word todo">${w}</li>`;
      const spans = [...w]
        .map((c, k) => `<span class="ch ${letters[k]}">${c}</span>`)
        .join('');
      const enter = justAdvanced ? ' enter' : '';
      return `<li class="word current${enter}">${spans}</li>`;
    })
    .join('');
  justAdvanced = false;

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
  const remaining = game.remainingMs(now);
  const timer = el('timer');
  timer.textContent = formatSeconds(remaining);
  timer.classList.toggle('low', remaining < 3000);
  frame = requestAnimationFrame(loop);
}

function showResult(): void {
  stopLoop();
  const r: GameResult = game.result(performance.now());
  const isRecord = recordResult(theme.id, level, r);
  const canNext = r.success && level < LEVEL_COUNT;
  show(`
    <h1 class="title ${r.success ? 'win' : 'lose'}">${r.success ? 'Réussi !' : 'Échec'}</h1>
    ${isRecord ? '<p class="badge">Nouveau record de temps</p>' : ''}
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
