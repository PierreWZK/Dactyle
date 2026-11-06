import { LEVEL_COUNT } from '../data/levels';
import type { GameResult } from '../game/engine';

// Sauvegarde locale versionnée. Un changement de format = nouvelle VERSION.
const KEY = 'dactyle:save';
const VERSION = 2; // v2 : ajout des réglages (mode strict)

export interface Settings {
  strict: boolean;
}

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
  settings: Settings;
  daily: Record<string, GameResult>; // résultat officiel par date (AAAA-MM-JJ)
}

function emptyProgress(): ThemeProgress {
  return { unlocked: 1, bestMs: {}, played: 0, won: 0, bestWpm: 0 };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveData;
      if (data && (data.version === 1 || data.version === VERSION) && typeof data.themes === 'object') {
        // v1 -> v2 : on garde la progression et on ajoute les réglages.
        return {
          version: VERSION,
          themes: data.themes,
          settings: { strict: data.settings?.strict === true },
          daily: data.daily ?? {},
        };
      }
    }
  } catch {
    // Sauvegarde illisible : on repart de zéro plutôt que de planter.
  }
  return { version: VERSION, themes: {}, settings: { strict: false }, daily: {} };
}

function persist(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la partie reste jouable.
  }
}

let data = load();

export function getDaily(date: string): GameResult | undefined {
  return data.daily[date];
}

// Seul le premier résultat d'une date est officiel. Retourne true s'il vient d'être enregistré.
export function recordDaily(date: string, result: GameResult): boolean {
  if (data.daily[date]) return false;
  data.daily[date] = result;
  // On ne garde que les 60 dernières dates.
  for (const old of Object.keys(data.daily).sort().slice(0, -60)) delete data.daily[old];
  persist(data);
  return true;
}

export function getSettings(): Settings {
  return data.settings;
}

export function setStrict(strict: boolean): void {
  data.settings.strict = strict;
  persist(data);
}

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
