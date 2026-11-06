import { LEVEL_COUNT } from '../data/levels';
import type { GameResult } from '../game/engine';

// Sauvegarde locale versionnée. Un changement de format = nouvelle VERSION.
const KEY = 'dactyle:save';
const VERSION = 1;

export interface ThemeProgress {
  unlocked: number; // niveau le plus haut accessible
  bestMs: Record<number, number>; // meilleur temps par niveau réussi
  played: number;
  won: number;
  bestWpm: number;
}

interface SaveData {
  version: number;
  themes: Record<string, ThemeProgress>;
}

function emptyProgress(): ThemeProgress {
  return { unlocked: 1, bestMs: {}, played: 0, won: 0, bestWpm: 0 };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveData;
      if (data && data.version === VERSION && typeof data.themes === 'object') return data;
    }
  } catch {
    // Sauvegarde illisible : on repart de zéro plutôt que de planter.
  }
  return { version: VERSION, themes: {} };
}

function persist(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la partie reste jouable.
  }
}

let data = load();

export function getProgress(themeId: string): ThemeProgress {
  return data.themes[themeId] ?? emptyProgress();
}

export function isLevelUnlocked(themeId: string, level: number): boolean {
  return level <= getProgress(themeId).unlocked;
}

// Enregistre une partie. Retourne true si le temps battu est un nouveau record.
export function recordResult(themeId: string, level: number, result: GameResult): boolean {
  const progress = data.themes[themeId] ?? emptyProgress();
  data.themes[themeId] = progress;

  progress.played++;
  progress.bestWpm = Math.max(progress.bestWpm, result.wpm);
  if (!result.success) {
    persist(data);
    return false;
  }

  progress.won++;
  progress.unlocked = Math.max(progress.unlocked, Math.min(LEVEL_COUNT, level + 1));
  const previous = progress.bestMs[level];
  const isRecord = previous === undefined || result.elapsedMs < previous;
  if (isRecord) progress.bestMs[level] = result.elapsedMs;
  persist(data);
  return isRecord;
}

export function globalStats(): { played: number; won: number; bestWpm: number } {
  return Object.values(data.themes).reduce(
    (acc, p) => ({
      played: acc.played + p.played,
      won: acc.won + p.won,
      bestWpm: Math.max(acc.bestWpm, p.bestWpm),
    }),
    { played: 0, won: 0, bestWpm: 0 },
  );
}
