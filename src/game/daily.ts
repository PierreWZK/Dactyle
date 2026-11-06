import { THEMES } from '../data/themes';
import type { GameResult } from './engine';

export const DAILY_WORDS = 10;

export interface DailyLevel {
  date: string;
  words: string[];
  themes: string[]; // nom du thème de chaque mot, dans le même ordre
  timeLimitMs: number;
}

// Date du jour à Paris (AAAA-MM-JJ) : la même pour tous les joueurs.
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Générateur pseudo-aléatoire déterministe : même graine, même suite.
function seeded(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 10 mots issus de 10 thèmes différents, identiques pour tous un même jour.
// Le thème Expert (lignes de code) est exclu : il imposerait le mode strict.
export function buildDaily(date: string): DailyLevel {
  const rng = seeded(`dactyle:${date}`);
  const pool = THEMES.filter((t) => t.difficulty !== 'Expert');
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, DAILY_WORDS);

  const words = chosen.map((theme) => {
    // Mot de longueur moyenne : ni le plus court, ni le plus long du thème.
    const sorted = [...theme.words].sort((a, b) => a.length - b.length);
    const from = Math.floor(sorted.length * 0.25);
    const to = Math.floor(sorted.length * 0.6);
    return sorted[from + Math.floor(rng() * (to - from))];
  });

  const chars = words.reduce((sum, w) => sum + w.length, 0);
  return {
    date,
    words,
    themes: chosen.map((t) => t.name),
    timeLimitMs: Math.round((3000 + chars * 420) / 100) * 100,
  };
}

export function shareText(date: string, r: GameResult): string {
  return [
    `Dactyle · Niveau du jour ${date}`,
    `${r.success ? '✅ Réussi' : '❌ Échec'} · ${r.wordsDone}/${r.totalWords} mots`,
    `⏱ ${(r.elapsedMs / 1000).toFixed(1)} s · 🎯 ${r.precision} % · ⌨ ${r.wpm} MPM`,
    'https://dactyle.projectp.fr',
  ].join('\n');
}
