import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, buildLevel, timeLimitFor, wordCountFor } from './levels';
import { THEMES } from './themes';

const avgLength = (words: string[]) => words.reduce((s, w) => s + w.length, 0) / words.length;

describe('thèmes', () => {
  it('propose 15 thèmes aux identifiants uniques', () => {
    expect(THEMES).toHaveLength(15);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(15);
  });

  it('réserve le niveau Expert à la programmation, en mode strict', () => {
    const expert = THEMES.filter((t) => t.difficulty === 'Expert');
    expect(expert.map((t) => t.id)).toEqual(['code']);
    expect(expert[0].strict).toBe(true);
  });

  for (const theme of THEMES) {
    it(`${theme.name} : assez de mots, sans doublon ni mot vide`, () => {
      expect(theme.words.length).toBeGreaterThanOrEqual(60);
      expect(new Set(theme.words).size).toBe(theme.words.length);
      for (const w of theme.words) expect(w.trim()).toBe(w);
    });
  }
});

describe('buildLevel', () => {
  for (const theme of THEMES) {
    describe(theme.name, () => {
      it('génère les 50 niveaux avec des mots du thème et un temps cohérent', () => {
        for (let n = 1; n <= LEVEL_COUNT; n++) {
          const spec = buildLevel(theme, n);
          expect(spec.words).toHaveLength(wordCountFor(theme, n));
          expect(new Set(spec.words).size).toBe(spec.words.length);
          for (const w of spec.words) expect(theme.words).toContain(w);
          expect(spec.timeLimitMs).toBe(timeLimitFor(theme, spec.words, n));
        }
      });

      it('commence à 1 mot et finit au plafond du thème', () => {
        expect(buildLevel(theme, 1).words).toHaveLength(1);
        expect(buildLevel(theme, LEVEL_COUNT).words).toHaveLength(theme.maxWords ?? 6);
      });

      it('propose des mots plus longs au niveau 50 qu’au niveau 1', () => {
        const sample = (n: number) =>
          avgLength(Array.from({ length: 30 }, () => buildLevel(theme, n).words).flat());
        expect(sample(LEVEL_COUNT)).toBeGreaterThan(sample(1));
      });

      it('tire des mots différents d’une partie à l’autre', () => {
        const firsts = new Set(Array.from({ length: 40 }, () => buildLevel(theme, 1).words[0]));
        expect(firsts.size).toBeGreaterThanOrEqual(5);
      });

      it('évite de rejouer les mêmes mots tant qu’il reste du choix', () => {
        const avoid = new Set<string>();
        for (let i = 0; i < 10; i++) {
          const { words } = buildLevel(theme, 1, avoid);
          for (const w of words) {
            expect(avoid.has(w)).toBe(false);
            avoid.add(w);
          }
        }
      });
    });
  }

  it('resserre le temps au fil des niveaux pour les mêmes mots', () => {
    const theme = THEMES[0];
    const words = ['Éléphant', 'Girafe'];
    expect(timeLimitFor(theme, words, LEVEL_COUNT)).toBeLessThan(timeLimitFor(theme, words, 1));
  });

  it('laisse plus de temps aux thèmes plus difficiles', () => {
    const facile = THEMES.find((t) => t.difficulty === 'Facile')!;
    const expert = THEMES.find((t) => t.difficulty === 'Expert')!;
    expect(timeLimitFor(expert, ['abcdefghij'], 10)).toBeGreaterThan(timeLimitFor(facile, ['abcdefghij'], 10));
  });
});
