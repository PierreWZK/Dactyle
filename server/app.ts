import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { LEVEL_COUNT, timeLimitFor, wordCountFor } from '../src/data/levels';
import { THEMES } from '../src/data/themes';
import { DAILY_WORDS, buildDaily, todayKey } from '../src/game/daily';

// Accès base minimal : implémenté par `pg` en production et par PGlite en local.
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export const SCHEMA = [
  `create table if not exists players (
    id serial primary key,
    pseudo text not null,
    pseudo_key text not null unique,
    token_hash text not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists daily_scores (
    date text not null,
    player_id int not null references players(id),
    success boolean not null,
    elapsed_ms int not null,
    words_done int not null,
    total_words int not null,
    precision int not null,
    wpm int not null,
    created_at timestamptz not null default now(),
    primary key (date, player_id)
  )`,
  `create table if not exists level_scores (
    theme_id text not null,
    level int not null,
    player_id int not null references players(id),
    elapsed_ms int not null,
    precision int not null,
    wpm int not null,
    updated_at timestamptz not null default now(),
    primary key (theme_id, level, player_id)
  )`,
];

export async function initSchema(db: Db): Promise<void> {
  for (const statement of SCHEMA) await db.query(statement);
}

const TOP = 50;
const MIN_MS_PER_CHAR = 40; // 300 mots par minute : au-delà, le score est refusé
const MAX_WPM = 400;

const pseudoKey = (pseudo: string) => pseudo.trim().replace(/\s+/g, ' ').toLowerCase();
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function validPseudo(v: unknown): v is string {
  return typeof v === 'string' && /^[\p{L}\p{N}_ .-]{3,16}$/u.test(v.trim()) && v.trim().length >= 3;
}

function validToken(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{32,64}$/.test(v);
}

// Limite simple par IP et par minute (mémoire du processus).
function limiter(max: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (ip: string): boolean => {
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || entry.reset < now) {
      hits.set(ip, { count: 1, reset: now + 60_000 });
      return true;
    }
    entry.count++;
    return entry.count <= max;
  };
}

interface PlayerRow extends Record<string, unknown> {
  id: number;
  token_hash: string;
}

export function createApp(db: Db, options: { postLimit?: number; getLimit?: number } = {}): Hono {
  const app = new Hono();
  const allowPost = limiter(options.postLimit ?? 30);
  const allowGet = limiter(options.getLimit ?? 240);

  app.use('/api/*', async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
    const ok = c.req.method === 'GET' ? allowGet(ip) : allowPost(ip);
    if (!ok) return c.json({ error: 'Trop de requêtes, réessaie dans une minute.' }, 429);
    await next();
  });
  app.use('/api/*', bodyLimit({ maxSize: 4096, onError: (c) => c.json({ error: 'Requête trop grande.' }, 413) }));

  app.get('/api/health', async (c) => {
    await db.query('select 1');
    return c.json({ ok: true });
  });

  // Réserve un pseudo, protégé par un jeton secret gardé dans le navigateur du joueur.
  app.post('/api/players', async (c) => {
    const body = await readJson(c);
    if (!body || !validPseudo(body.pseudo) || !validToken(body.token)) {
      return c.json({ error: 'Pseudo (3 à 16 caractères) ou jeton invalide.' }, 400);
    }
    const pseudo = body.pseudo.trim().replace(/\s+/g, ' ');
    const created = await db.query(
      'insert into players (pseudo, pseudo_key, token_hash) values ($1, $2, $3) on conflict (pseudo_key) do nothing returning id',
      [pseudo, pseudoKey(pseudo), hashToken(body.token)],
    );
    if (created.rows.length > 0) return c.json({ ok: true, pseudo }, 201);
    // Pseudo déjà pris : accepté seulement si c'est le même jeton (même navigateur).
    const player = await authenticate(db, pseudo, body.token);
    return player ? c.json({ ok: true, pseudo }) : c.json({ error: 'Ce pseudo est déjà pris.' }, 409);
  });

  // Résultat officiel du niveau du jour (un seul par joueur et par date).
  app.post('/api/scores/daily', async (c) => {
    const body = await readJson(c);
    const player = body && (await authenticate(db, body.pseudo, body.token));
    if (!body || !player) return c.json({ error: 'Identification refusée.' }, 401);

    const today = todayKey();
    const yesterday = todayKey(new Date(Date.now() - 86_400_000));
    const r = body.result as Record<string, unknown> | undefined;
    if (body.date !== today && body.date !== yesterday) return c.json({ error: 'Date invalide.' }, 400);
    if (!r || typeof r.success !== 'boolean') return c.json({ error: 'Résultat invalide.' }, 400);

    const daily = buildDaily(body.date as string);
    const chars = daily.words.reduce((s, w) => s + w.length, 0);
    const valid =
      isInt(r.elapsedMs, 0, daily.timeLimitMs) &&
      r.totalWords === DAILY_WORDS &&
      isInt(r.wordsDone, 0, DAILY_WORDS) &&
      isInt(r.precision, 0, 100) &&
      isInt(r.wpm, 0, MAX_WPM) &&
      (!r.success || (r.wordsDone === DAILY_WORDS && (r.elapsedMs as number) >= chars * MIN_MS_PER_CHAR));
    if (!valid) return c.json({ error: 'Résultat invraisemblable.' }, 400);

    const saved = await db.query(
      `insert into daily_scores (date, player_id, success, elapsed_ms, words_done, total_words, precision, wpm)
       values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (date, player_id) do nothing returning date`,
      [body.date, player.id, r.success, r.elapsedMs, r.wordsDone, r.totalWords, r.precision, r.wpm],
    );
    return c.json({ ok: true, official: saved.rows.length > 0 }, saved.rows.length > 0 ? 201 : 200);
  });

  // Meilleur temps d'un joueur sur un niveau d'un thème.
  app.post('/api/scores/level', async (c) => {
    const body = await readJson(c);
    const player = body && (await authenticate(db, body.pseudo, body.token));
    if (!body || !player) return c.json({ error: 'Identification refusée.' }, 401);

    const theme = THEMES.find((t) => t.id === body.theme);
    if (!theme || !isInt(body.level, 1, LEVEL_COUNT)) return c.json({ error: 'Niveau inconnu.' }, 400);

    // Bornes de vraisemblance : mots les plus courts et les plus longs possibles pour ce niveau.
    const count = wordCountFor(theme, body.level);
    const lengths = theme.words.map((w) => w.length);
    const minMs = count * Math.min(...lengths) * MIN_MS_PER_CHAR;
    const maxMs = timeLimitFor(theme, ['x'.repeat(count * Math.max(...lengths))], body.level);
    if (!isInt(body.elapsedMs, minMs, maxMs) || !isInt(body.precision, 0, 100) || !isInt(body.wpm, 0, MAX_WPM)) {
      return c.json({ error: 'Résultat invraisemblable.' }, 400);
    }

    await db.query(
      `insert into level_scores (theme_id, level, player_id, elapsed_ms, precision, wpm)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (theme_id, level, player_id) do update
       set elapsed_ms = excluded.elapsed_ms, precision = excluded.precision, wpm = excluded.wpm, updated_at = now()
       where excluded.elapsed_ms < level_scores.elapsed_ms`,
      [theme.id, body.level, player.id, body.elapsedMs, body.precision, body.wpm],
    );
    return c.json({ ok: true });
  });

  app.get('/api/leaderboard/daily', async (c) => {
    const date = c.req.query('date') ?? todayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'Date invalide.' }, 400);
    const { rows } = await db.query(
      `select p.pseudo, d.success, d.elapsed_ms as "elapsedMs", d.words_done as "wordsDone",
              d.total_words as "totalWords", d.precision, d.wpm
       from daily_scores d join players p on p.id = d.player_id
       where d.date = $1
       order by d.success desc, d.words_done desc, d.elapsed_ms asc, d.precision desc
       limit ${TOP}`,
      [date],
    );
    return c.json({ date, entries: rows });
  });

  app.get('/api/leaderboard/level', async (c) => {
    const theme = c.req.query('theme');
    const level = Number(c.req.query('level'));
    if (!THEMES.some((t) => t.id === theme) || !isInt(level, 1, LEVEL_COUNT)) {
      return c.json({ error: 'Niveau inconnu.' }, 400);
    }
    const { rows } = await db.query(
      `select p.pseudo, l.elapsed_ms as "elapsedMs", l.precision, l.wpm
       from level_scores l join players p on p.id = l.player_id
       where l.theme_id = $1 and l.level = $2
       order by l.elapsed_ms asc, l.precision desc
       limit ${TOP}`,
      [theme, level],
    );
    return c.json({ theme, level, entries: rows });
  });

  return app;
}

async function readJson(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function authenticate(db: Db, pseudo: unknown, token: unknown): Promise<{ id: number } | null> {
  if (!validPseudo(pseudo) || !validToken(token)) return null;
  const { rows } = await db.query<PlayerRow>('select id, token_hash from players where pseudo_key = $1', [pseudoKey(pseudo)]);
  if (rows.length === 0) return null;
  const expected = Buffer.from(rows[0].token_hash, 'hex');
  const given = Buffer.from(hashToken(token), 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given) ? { id: rows[0].id } : null;
}
