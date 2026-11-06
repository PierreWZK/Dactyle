import type { Difficulty, Theme } from './themes';

export const LEVEL_COUNT = 50;

export interface LevelSpec {
  level: number;
  words: string[];
  timeLimitMs: number;
}

// Réglages de progression. Temps par caractère au niveau 1 : plus la difficulté
// du thème est haute, plus on laisse de temps. Il se resserre jusqu'à TIGHTEST au niveau 50.
const MS_PER_CHAR: Record<Difficulty, number> = {
  Facile: 400,
  Intermédiaire: 450,
  Difficile: 500,
  Expert: 600,
};
const LOOSEST = 1.2; // marge au niveau 1
const TIGHTEST = 0.75; // marge au niveau 50
const BASE_TIME_MS = 2000;
const DEFAULT_MAX_WORDS = 6;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function wordCountFor(theme: Theme, level: number): number {
  // 1 mot aux niveaux 1-8, puis un mot de plus tous les 8 niveaux.
  return Math.min(theme.maxWords ?? DEFAULT_MAX_WORDS, 1 + Math.floor((level - 1) / 8));
}

export function timeLimitFor(theme: Theme, words: string[], level: number): number {
  const progress = (level - 1) / (LEVEL_COUNT - 1);
  const margin = LOOSEST + (TIGHTEST - LOOSEST) * progress;
  const chars = words.reduce((sum, w) => sum + w.length, 0);
  const ms = BASE_TIME_MS + chars * MS_PER_CHAR[theme.difficulty] * margin;
  return Math.round(ms / 100) * 100;
}

// `avoid` : mots déjà joués à ce niveau, écartés tant qu'il reste assez de choix.
export function buildLevel(theme: Theme, level: number, avoid: ReadonlySet<string> = new Set()): LevelSpec {
  const wordCount = wordCountFor(theme, level);
  // Mots triés du plus court au plus long : le niveau pioche dans une fenêtre
  // qui glisse vers les mots longs à mesure que le niveau monte.
  const sorted = [...theme.words].sort((a, b) => a.length - b.length);
  const windowSize = Math.min(sorted.length, Math.max(wordCount * 3, Math.ceil(sorted.length * 0.3)));
  const center = Math.round(((level - 1) / (LEVEL_COUNT - 1)) * (sorted.length - 1));
  const start = Math.max(0, Math.min(sorted.length - windowSize, center - Math.floor(windowSize / 2)));

  let pool = sorted.slice(start, start + windowSize);
  const fresh = pool.filter((w) => !avoid.has(w));
  if (fresh.length >= wordCount) pool = fresh;

  const words = shuffle(pool).slice(0, wordCount);
  return { level, words, timeLimitMs: timeLimitFor(theme, words, level) };
}
