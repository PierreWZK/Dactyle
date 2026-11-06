import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, buildLevel } from './levels';
import { THEMES } from './themes';

describe('buildLevel', () => {
  for (const theme of THEMES) {
    describe(theme.name, () => {
      it('génère des niveaux valides de 1 à 10', () => {
        for (let n = 1; n <= LEVEL_COUNT; n++) {
          const spec = buildLevel(theme, n);
          expect(spec.words.length).toBeGreaterThan(0);
          expect(new Set(spec.words).size).toBe(spec.words.length);
          for (const w of spec.words) expect(theme.words).toContain(w);
          const chars = spec.words.reduce((s, w) => s + w.length, 0);
          expect(spec.timeLimitMs).toBe(5000 + chars * 500);
        }
      });

      it('augmente le nombre de mots : 1 au niveau 1, 5 au niveau 10', () => {
        expect(buildLevel(theme, 1).words).toHaveLength(1);
        expect(buildLevel(theme, 10).words).toHaveLength(5);
      });

      it('propose des mots courts au niveau 1', () => {
        const shortest = [...theme.words].sort((a, b) => a.length - b.length);
        const limit = shortest[Math.ceil(theme.words.length / LEVEL_COUNT) - 1].length;
        for (let i = 0; i < 20; i++) {
          expect(buildLevel(theme, 1).words[0].length).toBeLessThanOrEqual(limit);
        }
      });
    });
  }
});
