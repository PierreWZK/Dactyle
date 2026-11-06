import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildDaily, todayKey } from '../src/game/daily';
import { createApp, initSchema, type Db } from './app';

const TOKEN_A = 'a'.repeat(32);
const TOKEN_B = 'b'.repeat(32);

let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  const lite = new PGlite();
  const db: Db = { query: (sql, params) => lite.query(sql, params) as never };
  await initSchema(db);
  app = createApp(db, { postLimit: 1000, getLimit: 1000 });
});

const post = (path: string, body: unknown) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const register = (pseudo: string, token: string) => post('/api/players', { pseudo, token });

function dailyResult(overrides: Record<string, unknown> = {}) {
  const d = buildDaily(todayKey());
  const chars = d.words.reduce((s, w) => s + w.length, 0);
  return { success: true, elapsedMs: chars * 300, wordsDone: 10, totalWords: 10, precision: 95, wpm: 50, ...overrides };
}

describe('joueurs', () => {
  it('réserve un pseudo, et le reconnaît avec le même jeton', async () => {
    expect((await register('Alice', TOKEN_A)).status).toBe(201);
    expect((await register('Alice', TOKEN_A)).status).toBe(200);
  });

  it('refuse un pseudo déjà pris, sans tenir compte de la casse ni des espaces', async () => {
    await register('Alice', TOKEN_A);
    expect((await register('alice', TOKEN_B)).status).toBe(409);
    expect((await register('  ALICE ', TOKEN_B)).status).toBe(409);
  });

  it('refuse un pseudo ou un jeton invalide', async () => {
    expect((await register('ab', TOKEN_A)).status).toBe(400);
    expect((await register('<script>alert(1)</script>', TOKEN_A)).status).toBe(400);
    expect((await register('Alice', 'court')).status).toBe(400);
    expect((await app.request('/api/players', { method: 'POST', body: 'pas du json' })).status).toBe(400);
  });
});

describe('niveau du jour', () => {
  beforeEach(async () => {
    await register('Alice', TOKEN_A);
    await register('Bob', TOKEN_B);
  });

  const send = (pseudo: string, token: string, result: unknown, date = todayKey()) =>
    post('/api/scores/daily', { pseudo, token, date, result });

  it('enregistre un seul résultat officiel par joueur et par jour', async () => {
    expect((await send('Alice', TOKEN_A, dailyResult())).status).toBe(201);
    const second = await send('Alice', TOKEN_A, dailyResult({ elapsedMs: dailyResult().elapsedMs + 500 }));
    expect(second.status).toBe(200);
    expect((await second.json()).official).toBe(false);
  });

  it('refuse un mauvais jeton', async () => {
    expect((await send('Alice', TOKEN_B, dailyResult())).status).toBe(401);
    expect((await send('Inconnu', TOKEN_A, dailyResult())).status).toBe(401);
  });

  it('refuse un résultat invraisemblable', async () => {
    expect((await send('Alice', TOKEN_A, dailyResult({ elapsedMs: 50 }))).status).toBe(400); // trop rapide
    expect((await send('Alice', TOKEN_A, dailyResult({ elapsedMs: 9_999_999 }))).status).toBe(400); // hors limite
    expect((await send('Alice', TOKEN_A, dailyResult({ wordsDone: 7 }))).status).toBe(400); // réussi sans tout recopier
    expect((await send('Alice', TOKEN_A, dailyResult({ precision: 150 }))).status).toBe(400);
    expect((await send('Alice', TOKEN_A, dailyResult({ totalWords: 3 }))).status).toBe(400);
    expect((await send('Alice', TOKEN_A, dailyResult(), '2020-01-01')).status).toBe(400); // date passée
  });

  it('classe les réussites par temps, puis les échecs', async () => {
    await send('Alice', TOKEN_A, dailyResult({ elapsedMs: 30_000 }));
    await send('Bob', TOKEN_B, dailyResult({ elapsedMs: 20_000 }));
    await register('Chloé', 'c'.repeat(32));
    await send('Chloé', 'c'.repeat(32), dailyResult({ success: false, wordsDone: 6, elapsedMs: 15_000 }));

    const res = await app.request('/api/leaderboard/daily');
    const { entries } = await res.json();
    expect(entries.map((e: { pseudo: string }) => e.pseudo)).toEqual(['Bob', 'Alice', 'Chloé']);
    expect(entries[0]).toMatchObject({ elapsedMs: 20_000, precision: 95, wpm: 50 });
  });
});

describe('meilleur temps par niveau', () => {
  beforeEach(async () => {
    await register('Alice', TOKEN_A);
    await register('Bob', TOKEN_B);
  });

  const send = (pseudo: string, token: string, elapsedMs: number, extra: Record<string, unknown> = {}) =>
    post('/api/scores/level', { pseudo, token, theme: 'animaux', level: 1, elapsedMs, precision: 100, wpm: 40, ...extra });

  it('garde le meilleur temps de chaque joueur et classe du plus rapide au plus lent', async () => {
    expect((await send('Alice', TOKEN_A, 4000)).status).toBe(200);
    await send('Alice', TOKEN_A, 6000); // moins bon : ignoré
    await send('Bob', TOKEN_B, 3000);
    await send('Alice', TOKEN_A, 3500); // meilleur : remplace

    const res = await app.request('/api/leaderboard/level?theme=animaux&level=1');
    const { entries } = await res.json();
    expect(entries.map((e: { pseudo: string; elapsedMs: number }) => [e.pseudo, e.elapsedMs])).toEqual([
      ['Bob', 3000],
      ['Alice', 3500],
    ]);
  });

  it('sépare les niveaux et les thèmes', async () => {
    await send('Alice', TOKEN_A, 4000);
    const other = await app.request('/api/leaderboard/level?theme=animaux&level=2');
    expect((await other.json()).entries).toHaveLength(0);
  });

  it('refuse thème inconnu, niveau hors limites, temps invraisemblable, mauvais jeton', async () => {
    expect((await send('Alice', TOKEN_A, 4000, { theme: 'inconnu' })).status).toBe(400);
    expect((await send('Alice', TOKEN_A, 4000, { level: 51 })).status).toBe(400);
    expect((await send('Alice', TOKEN_A, 10)).status).toBe(400);
    expect((await send('Alice', TOKEN_A, 9_000_000)).status).toBe(400);
    expect((await send('Alice', TOKEN_B, 4000)).status).toBe(401);
  });

  it('refuse une requête de classement mal formée', async () => {
    expect((await app.request('/api/leaderboard/level?theme=x&level=1')).status).toBe(400);
    expect((await app.request('/api/leaderboard/daily?date=hier')).status).toBe(400);
  });
});

describe('protections', () => {
  it('limite le nombre d’envois par minute', async () => {
    const lite = new PGlite();
    const db: Db = { query: (sql, params) => lite.query(sql, params) as never };
    await initSchema(db);
    const limited = createApp(db, { postLimit: 3 });
    const call = () => limited.request('/api/players', { method: 'POST', body: '{}' });
    const statuses = [await call(), await call(), await call(), await call()].map((r) => r.status);
    expect(statuses.slice(0, 3)).not.toContain(429);
    expect(statuses[3]).toBe(429);
  });

  it('refuse un corps trop grand', async () => {
    const res = await app.request('/api/players', { method: 'POST', body: 'x'.repeat(5000) });
    expect(res.status).toBe(413);
  });

  it('répond au contrôle de santé', async () => {
    expect((await app.request('/api/health')).status).toBe(200);
  });
});
