import type { GameResult } from '../game/engine';
import type { Identity } from '../storage/save';

export interface DailyEntry {
  pseudo: string;
  success: boolean;
  elapsedMs: number;
  wordsDone: number;
  totalWords: number;
  precision: number;
  wpm: number;
}

export interface LevelEntry {
  pseudo: string;
  elapsedMs: number;
  precision: number;
  wpm: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new ApiError('Classement indisponible pour le moment.', 0);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? 'Erreur du classement.', res.status);
  return body as T;
}

const post = <T>(path: string, body: unknown) =>
  call<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

// Jeton secret de 32 caractères hexadécimaux, propre à ce navigateur.
export function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const registerPlayer = (identity: Identity) => post<{ pseudo: string }>('/api/players', identity);

export const sendDaily = (id: Identity, date: string, result: GameResult) =>
  post<{ official: boolean }>('/api/scores/daily', { ...id, date, result });

export const sendLevel = (id: Identity, theme: string, level: number, r: GameResult) =>
  post<{ ok: true }>('/api/scores/level', {
    ...id,
    theme,
    level,
    elapsedMs: r.elapsedMs,
    precision: r.precision,
    wpm: r.wpm,
  });

export const fetchDaily = (date: string) => call<{ entries: DailyEntry[] }>(`/api/leaderboard/daily?date=${date}`);

export const fetchLevel = (theme: string, level: number) =>
  call<{ entries: LevelEntry[] }>(`/api/leaderboard/level?theme=${theme}&level=${level}`);
