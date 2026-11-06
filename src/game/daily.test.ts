import { describe, expect, it } from 'vitest';
import { THEMES } from '../data/themes';
import { DAILY_WORDS, buildDaily, shareText, todayKey } from './daily';

describe('todayKey', () => {
  it('utilise la date de Paris', () => {
    expect(todayKey(new Date('2026-11-06T12:00:00Z'))).toBe('2026-11-06');
    expect(todayKey(new Date('2026-11-06T22:30:00Z'))).toBe('2026-11-06');
    expect(todayKey(new Date('2026-11-06T23:30:00Z'))).toBe('2026-11-07'); // minuit passé à Paris
  });
});

describe('buildDaily', () => {
  it('donne les mêmes mots à tout le monde un même jour', () => {
    expect(buildDaily('2026-11-06')).toEqual(buildDaily('2026-11-06'));
  });

  it('change d’un jour à l’autre', () => {
    expect(buildDaily('2026-11-06').words).not.toEqual(buildDaily('2026-11-07').words);
  });

  it('propose 10 mots de 10 thèmes différents, sans le thème Expert', () => {
    for (let day = 1; day <= 60; day++) {
      const d = buildDaily(`2026-12-${String(day).padStart(2, '0')}`);
      expect(d.words).toHaveLength(DAILY_WORDS);
      expect(new Set(d.themes).size).toBe(DAILY_WORDS);
      expect(d.themes).not.toContain('Programmation');
      d.words.forEach((w, i) => {
        const theme = THEMES.find((t) => t.name === d.themes[i])!;
        expect(theme.words).toContain(w);
      });
      expect(d.timeLimitMs).toBeGreaterThan(10_000);
    }
  });

  it('varie les thèmes retenus selon les jours', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 30; day++) buildDaily(`2027-01-${String(day).padStart(2, '0')}`).themes.forEach((t) => seen.add(t));
    expect(seen.size).toBeGreaterThanOrEqual(13);
  });
});

describe('shareText', () => {
  it('reprend date, résultat, mots, temps, précision et vitesse', () => {
    const text = shareText('2026-11-06', { success: true, elapsedMs: 34210, wordsDone: 10, totalWords: 10, precision: 96, wpm: 52 });
    expect(text).toContain('2026-11-06');
    expect(text).toContain('Réussi');
    expect(text).toContain('10/10');
    expect(text).toContain('34.2 s');
    expect(text).toContain('96 %');
    expect(text).toContain('52 MPM');
  });
});
