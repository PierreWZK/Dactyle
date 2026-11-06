import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameResult } from '../game/engine';

const win = (elapsedMs: number): GameResult => ({
  success: true, elapsedMs, wordsDone: 1, totalWords: 1, precision: 100, wpm: 40,
});
const loss: GameResult = {
  success: false, elapsedMs: 5000, wordsDone: 0, totalWords: 1, precision: 90, wpm: 10,
};

function stubStorage(initial?: string) {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set('dactyle:save', initial);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  return store;
}

// Le module charge la sauvegarde à l'import : on le réimporte à chaque test.
async function freshSave() {
  vi.resetModules();
  return import('./save');
}

describe('save', () => {
  beforeEach(() => stubStorage());

  it('démarre avec seulement le niveau 1 débloqué', async () => {
    const s = await freshSave();
    expect(s.isLevelUnlocked('animaux', 1)).toBe(true);
    expect(s.isLevelUnlocked('animaux', 2)).toBe(false);
  });

  it('débloque le niveau suivant après une réussite, pas après un échec', async () => {
    const s = await freshSave();
    s.recordResult('animaux', 1, loss);
    expect(s.isLevelUnlocked('animaux', 2)).toBe(false);
    s.recordResult('animaux', 1, win(3000));
    expect(s.isLevelUnlocked('animaux', 2)).toBe(true);
    expect(s.isLevelUnlocked('code', 2)).toBe(false);
  });

  it('ne dépasse pas le niveau 50', async () => {
    const s = await freshSave();
    s.recordResult('animaux', 50, win(3000));
    expect(s.getProgress('animaux').unlocked).toBe(50);
  });

  it('mémorise le mode strict entre deux chargements', async () => {
    let s = await freshSave();
    expect(s.getSettings().strict).toBe(false);
    s.setStrict(true);
    s = await freshSave();
    expect(s.getSettings().strict).toBe(true);
  });

  it('migre une sauvegarde v1 en gardant la progression', async () => {
    stubStorage(JSON.stringify({ version: 1, themes: { animaux: { unlocked: 7, bestMs: { 1: 2000 }, played: 9, won: 6, bestWpm: 44 } } }));
    const s = await freshSave();
    expect(s.getProgress('animaux').unlocked).toBe(7);
    expect(s.getSettings().strict).toBe(false);
  });

  it('ne signale un record que si le temps est meilleur', async () => {
    const s = await freshSave();
    expect(s.recordResult('animaux', 1, win(3000))).toBe(true);
    expect(s.recordResult('animaux', 1, win(4000))).toBe(false);
    expect(s.recordResult('animaux', 1, win(2500))).toBe(true);
    expect(s.getProgress('animaux').bestMs[1]).toBe(2500);
  });

  it('cumule les statistiques globales', async () => {
    const s = await freshSave();
    s.recordResult('animaux', 1, win(3000));
    s.recordResult('code', 1, loss);
    expect(s.globalStats()).toEqual({ played: 2, won: 1, bestWpm: 40 });
  });

  it('persiste la progression entre deux chargements', async () => {
    const store = stubStorage();
    let s = await freshSave();
    s.recordResult('animaux', 1, win(3000));
    expect(store.get('dactyle:save')).toBeDefined();
    s = await freshSave();
    expect(s.isLevelUnlocked('animaux', 2)).toBe(true);
  });

  it('repart de zéro si la sauvegarde est corrompue', async () => {
    stubStorage('{pas du json');
    const s = await freshSave();
    expect(s.isLevelUnlocked('animaux', 2)).toBe(false);
  });

  it('ne garde que le premier résultat officiel du jour', async () => {
    const s = await freshSave();
    expect(s.recordDaily('2026-11-06', win(30000))).toBe(true);
    expect(s.recordDaily('2026-11-06', loss)).toBe(false);
    expect(s.getDaily('2026-11-06')?.elapsedMs).toBe(30000);
    expect(s.getDaily('2026-11-07')).toBeUndefined();
  });

  it('persiste le résultat du jour et garde les 60 dernières dates', async () => {
    let s = await freshSave();
    for (let d = 1; d <= 70; d++) s.recordDaily(`2027-01-${String(d).padStart(3, '0')}`, win(1000));
    s = await freshSave();
    expect(s.getDaily('2027-01-070')).toBeDefined();
    expect(s.getDaily('2027-01-001')).toBeUndefined();
  });

  it('ignore une sauvegarde d’une autre version', async () => {
    stubStorage(JSON.stringify({ version: 99, themes: { animaux: { unlocked: 10 } } }));
    const s = await freshSave();
    expect(s.isLevelUnlocked('animaux', 2)).toBe(false);
  });
});
