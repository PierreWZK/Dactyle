import './style.css';
import { THEMES, type Theme } from './data/themes';
import { LEVEL_COUNT, buildLevel } from './data/levels';
import { TypingGame, type GameResult } from './game/engine';
import { buildDaily, shareText, todayKey, type DailyLevel } from './game/daily';
import {
  getDaily,
  getProgress,
  getSettings,
  globalStats,
  isLevelUnlocked,
  recordDaily,
  recordResult,
  setStrict,
} from './storage/save';
import {
  applyLook,
  burst,
  caretPoint,
  confetti,
  flash,
  levelLook,
  reducedMotion,
  resetLook,
  showIntro,
  type LevelLook,
} from './ui/effects';

const app = document.querySelector<HTMLElement>('#app')!;

let theme: Theme = THEMES[0];
let daily: DailyLevel | null = null; // non nul pendant une partie du niveau du jour
let level = 1;
let game: TypingGame;
let frame = 0;
let justAdvanced = false;
let strictNow = false;
let look: LevelLook = levelLook(1);
let combo = 0; // lettres justes d'affilée
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
// Mots déjà tirés par niveau pendant cette session, pour varier d'une partie à l'autre.
const seen = new Map<string, Set<string>>();

// Les mots peuvent contenir du code HTML (ex. thème Programmation) : on l'échappe.
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function show(html: string): void {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = null;
  app.innerHTML = html;
  // Relance l'animation d'entrée à chaque changement d'écran.
  app.classList.remove('enter');
  void app.offsetWidth;
  app.classList.add('enter');
}

function showThemes(): void {
  stopLoop();
  resetLook();
  const g = globalStats();
  show(`
    <h1 class="title">Dactyle</h1>
    ${dailyCard()}
    <p class="subtitle">Ou choisis un thème</p>
    <label class="toggle">
      <input type="checkbox" id="strict" ${getSettings().strict ? 'checked' : ''} />
      <span>Mode strict : accents et majuscules obligatoires</span>
    </label>
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
  el('daily').addEventListener('click', startDaily);
  el<HTMLInputElement>('strict').addEventListener('change', (e) => {
    setStrict((e.target as HTMLInputElement).checked);
  });
  app.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      theme = THEMES.find((t) => t.id === btn.dataset.theme)!;
      showLevels();
    });
  });
}

function dailyCard(): string {
  const today = todayKey();
  const mine = getDaily(today);
  const status = mine
    ? `Ton résultat : ${mine.success ? 'réussi' : 'échec'} · ${formatSeconds(mine.elapsedMs)} · ${mine.precision} %`
    : 'Pas encore joué aujourd’hui';
  return `<button class="card daily" id="daily">
    <strong>Niveau du jour</strong>
    <span>${today} · 10 mots de 10 thèmes, les mêmes pour tous</span>
    <span>${status}</span>
  </button>`;
}

function showLevels(): void {
  stopLoop();
  resetLook();
  const progress = getProgress(theme.id);
  const buttons = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1)
    .map((n) => {
      const locked = !isLevelUnlocked(theme.id, n);
      const best = progress.bestMs[n];
      const label = locked ? 'Verrouillé' : best !== undefined ? formatSeconds(best) : 'Jouer';
      return `<button class="level${locked ? ' locked' : ''}" data-level="${n}" style="--lh:${levelLook(n).hue}" ${locked ? 'disabled' : ''}>
        <strong>${n}</strong><span>${label}</span>
      </button>`;
    })
    .join('');
  show(`
    <button class="link" id="back">← Thèmes</button>
    <h1 class="title">${theme.name}</h1>
    <p class="subtitle">${theme.difficulty} · ${LEVEL_COUNT} niveaux · meilleur temps affiché sous chaque niveau</p>
    <div class="levels">${buttons}</div>`);
  app.querySelector('#back')!.addEventListener('click', showThemes);
  app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((btn) => {
    btn.addEventListener('click', () => startLevel(Number(btn.dataset.level)));
  });
}

function startLevel(n: number): void {
  level = n;
  daily = null;
  const key = `${theme.id}:${n}`;
  const played = seen.get(key) ?? new Set<string>();
  const spec = buildLevel(theme, n, played);
  // Si le tirage a dû reprendre des mots déjà vus, on repart d'une liste vide.
  const reused = spec.words.some((w) => played.has(w));
  seen.set(key, reused ? new Set(spec.words) : new Set([...played, ...spec.words]));
  strictNow = getSettings().strict || theme.strict === true;
  game = new TypingGame(spec.words, spec.timeLimitMs, strictNow);
  look = levelLook(n);
  applyLook(look);
  combo = 0;
  showGame();
  showIntro(`Niveau ${n}`, look);
  startLoop();
}

// Niveau du jour : mêmes mots pour tout le monde, sans mode strict.
function startDaily(): void {
  daily = buildDaily(todayKey());
  strictNow = false;
  game = new TypingGame(daily.words, daily.timeLimitMs, false);
  look = { hue: 45, tier: 3, tierName: 'Du jour' };
  applyLook(look);
  combo = 0;
  showGame();
  showIntro('Niveau du jour', look);
  startLoop();
}

function showGame(): void {
  show(`
    <header class="hud">
      <span class="hud-label">${daily ? 'Niveau du jour' : `${theme.name} · Niveau ${level}${strictNow ? ' · Strict' : ''}`}</span>
      <span class="combo" id="combo"></span>
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
    const grew = entry.value.length > game.input.length;
    game.handleInput(entry.value, performance.now());
    entry.value = game.input;
    justAdvanced = game.currentIndex !== before;
    renderGame();
    if (grew) feedback(entry, game.currentIndex !== before);
    if (game.status === 'success' || game.status === 'failed') showResult();
  });
  renderGame();
}

// Effets de frappe : chaque palier de niveau en ajoute (voir effects.ts).
function feedback(entry: HTMLInputElement, wordDone: boolean): void {
  combo = game.hasError ? 0 : combo + 1;
  const comboEl = el('combo');
  comboEl.textContent = combo >= 5 ? `×${combo}` : '';
  comboEl.classList.remove('bump');
  void comboEl.offsetWidth;
  if (combo >= 5) comboEl.classList.add('bump');

  if (look.tier >= 2 && !game.hasError && entry.value) {
    const { x, y } = caretPoint(entry);
    burst(x, y, 3, look.hue, 40);
  }
  if (wordDone && look.tier >= 1) {
    const done = document.querySelectorAll('.word.done');
    const last = done[done.length - 1]?.getBoundingClientRect();
    if (last) burst(last.left + last.width / 2, last.top + last.height / 2, 8 + look.tier * 4, look.hue);
    if (look.tier >= 4) flash(look.hue);
  }
}

function renderGame(): void {
  const entry = el<HTMLInputElement>('entry');
  entry.classList.toggle('error', game.hasError);

  const letters = game.letterStates;
  el('words').innerHTML = game.words
    .map((w, i) => {
      if (i < game.currentIndex) return `<li class="word done">${esc(w)}</li>`;
      if (i > game.currentIndex) return `<li class="word todo">${esc(w)}</li>`;
      const spans = [...w]
        .map((c, k) => `<span class="ch ${letters[k]}">${esc(c)}</span>`)
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
  if (daily) {
    showDailyResult(r, daily);
    return;
  }
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
    </div>
    <p class="summary">Entrée : ${canNext ? 'niveau suivant' : 'rejouer'}</p>`);
  if (r.success) confetti(20 + level * 2, look.hue);
  else if (!reducedMotion()) app.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 260 });
  el('retry').addEventListener('click', () => startLevel(level));
  el('levels').addEventListener('click', showLevels);
  if (canNext) el('next').addEventListener('click', () => startLevel(level + 1));

  // Entrée : niveau suivant après une réussite, sinon on rejoue le même niveau.
  keyHandler = (e) => {
    if (e.key !== 'Enter' || e.repeat) return;
    e.preventDefault();
    startLevel(canNext ? level + 1 : level);
  };
  document.addEventListener('keydown', keyHandler);
}

function showDailyResult(r: GameResult, d: DailyLevel): void {
  const official = recordDaily(d.date, r);
  const mine = getDaily(d.date)!;
  // Partage : un bouton Copier, uniquement sur ordinateur (souris + survol).
  const canCopy = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  show(`
    <h1 class="title ${r.success ? 'win' : 'lose'}">${r.success ? 'Réussi !' : 'Échec'}</h1>
    <p class="badge">${official ? 'Résultat officiel du jour enregistré' : 'Entraînement : seul ton premier résultat du jour est officiel'}</p>
    <dl class="stats">
      <div><dt>Temps</dt><dd>${formatSeconds(r.elapsedMs)}</dd></div>
      <div><dt>Mots</dt><dd>${r.wordsDone} / ${r.totalWords}</dd></div>
      <div><dt>Précision</dt><dd>${r.precision} %</dd></div>
      <div><dt>Vitesse</dt><dd>${r.wpm} MPM</dd></div>
    </dl>
    ${
      canCopy
        ? `<div class="share">
        <p class="summary">Ton résultat officiel, à partager</p>
        <pre id="share-text">${esc(shareText(d.date, mine))}</pre>
        <button class="btn primary" id="copy">Copier</button>
      </div>`
        : ''
    }
    <div class="actions">
      <button class="btn" id="retry">Rejouer en entraînement</button>
      <button class="btn ghost" id="home">Accueil</button>
    </div>
    <p class="summary">Entrée : rejouer</p>`);
  if (r.success) confetti(60, look.hue);
  el('retry').addEventListener('click', startDaily);
  el('home').addEventListener('click', showThemes);
  if (canCopy) {
    el('copy').addEventListener('click', async () => {
      const button = el('copy');
      try {
        await navigator.clipboard.writeText(shareText(d.date, mine));
        button.textContent = 'Copié ✓';
      } catch {
        button.textContent = 'Copie impossible';
      }
    });
  }
  keyHandler = (e) => {
    if (e.key !== 'Enter' || e.repeat) return;
    e.preventDefault();
    startDaily();
  };
  document.addEventListener('keydown', keyHandler);
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

showThemes();
