import { describe, expect, it } from 'vitest';
import { levelLook } from './effects';

describe('levelLook', () => {
  it('change de palier tous les 10 niveaux', () => {
    expect([1, 10, 11, 20, 21, 30, 31, 40, 41, 50].map((n) => levelLook(n).tier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(levelLook(1).tierName).toBe('Bronze');
    expect(levelLook(50).tierName).toBe('Légende');
  });

  it('donne à chaque niveau un aspect unique', () => {
    const looks = Array.from({ length: 50 }, (_, i) => levelLook(i + 1));
    expect(new Set(looks.map((l) => `${l.tier}:${l.hue}`)).size).toBe(50);
    for (const l of looks) {
      expect(l.hue).toBeGreaterThanOrEqual(0);
      expect(l.hue).toBeLessThan(360);
    }
  });
});
