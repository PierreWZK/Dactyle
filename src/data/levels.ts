import type { Theme } from './themes';

export const LEVEL_COUNT = 10;

export interface LevelSpec {
  level: number;
  words: string[];
  timeLimitMs: number;
}

// Réglages provisoires de progression : l'étape 3 les affinera.
const BASE_TIME_MS = 5000;
const TIME_PER_CHAR_MS = 500;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildLevel(theme: Theme, level: number): LevelSpec {
  // 1 mot au niveau 1, jusqu'à 5 mots au niveau 9-10.
  const wordCount = Math.min(5, 1 + Math.floor((level - 1) / 2));
  // Le réservoir de mots s'élargit avec le niveau : d'abord les plus courts.
  const sorted = [...theme.words].sort((a, b) => a.length - b.length);
  const poolSize = Math.max(wordCount, Math.ceil((sorted.length * level) / LEVEL_COUNT));
  const words = shuffle(sorted.slice(0, poolSize)).slice(0, wordCount);
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);

  return {
    level,
    words,
    timeLimitMs: BASE_TIME_MS + totalChars * TIME_PER_CHAR_MS,
  };
}
