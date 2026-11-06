// Moteur de jeu pur : aucune dépendance au DOM, temps passé en paramètre.

export type Status = 'ready' | 'playing' | 'success' | 'failed';

export interface GameResult {
  success: boolean;
  elapsedMs: number;
  wordsDone: number;
  totalWords: number;
  precision: number; // 0 à 100
  wpm: number; // mots par minute (1 mot = 5 caractères)
}

// Compare un caractère attendu et un caractère saisi selon le mode.
function sameChar(expected: string | undefined, typed: string, strict: boolean): boolean {
  if (expected === undefined) return false;
  if (strict) return expected === typed;
  return baseChar(expected) === baseChar(typed);
}

function baseChar(c: string): string {
  return c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export class TypingGame {
  status: Status = 'ready';
  input = '';

  private wordIndex = 0;
  private keystrokes = 0;
  private errors = 0;
  private validChars = 0;
  private startedAt = 0;
  private endedAt = 0;

  constructor(
    readonly words: string[],
    readonly timeLimitMs: number,
    readonly strict = false,
  ) {}

  get currentIndex(): number {
    return this.wordIndex;
  }

  get currentWord(): string {
    return this.words[this.wordIndex] ?? '';
  }

  // État de chaque lettre du mot courant : juste, fausse ou à taper.
  get letterStates(): ('ok' | 'bad' | 'todo')[] {
    return [...this.currentWord].map((c, i) => {
      if (i >= this.input.length) return 'todo';
      return sameChar(c, this.input[i], this.strict) ? 'ok' : 'bad';
    });
  }

  // Vrai si la saisie en cours diverge du mot attendu.
  get hasError(): boolean {
    const word = this.currentWord;
    if (this.input.length > word.length) return true;
    return [...this.input].some((c, i) => !sameChar(word[i], c, this.strict));
  }

  // Appelé à chaque modification du champ de saisie.
  handleInput(value: string, now: number): void {
    if (this.status !== 'ready' && this.status !== 'playing') return;
    if (this.status === 'ready') {
      this.status = 'playing';
      this.startedAt = now;
    }

    const word = this.currentWord;
    if (value.length > this.input.length) {
      // Une frappe ajoute un caractère en fin de champ : on le juge.
      const pos = value.length - 1;
      this.keystrokes++;
      if (!sameChar(word[pos], value[pos], this.strict)) this.errors++;
    }
    this.input = value;

    if (this.isWordMatched(word, value)) {
      this.validChars += word.length;
      this.wordIndex++;
      this.input = '';
      if (this.wordIndex === this.words.length) {
        this.finish('success', now);
      }
    }
  }

  // Vérifie l'échec si le temps est écoulé. Retourne le statut courant.
  tick(now: number): Status {
    if (this.status === 'playing' && now - this.startedAt >= this.timeLimitMs) {
      this.finish('failed', this.startedAt + this.timeLimitMs);
    }
    return this.status;
  }

  remainingMs(now: number): number {
    if (this.status === 'ready') return this.timeLimitMs;
    return Math.max(0, this.timeLimitMs - this.elapsedMs(now));
  }

  result(now: number): GameResult {
    const elapsedMs = this.elapsedMs(now);
    const total = this.keystrokes;
    const minutes = elapsedMs / 60000;
    return {
      success: this.status === 'success',
      elapsedMs,
      wordsDone: this.wordIndex,
      totalWords: this.words.length,
      precision: total === 0 ? 100 : Math.round(((total - this.errors) / total) * 100),
      wpm: minutes > 0 ? Math.round(this.validChars / 5 / minutes) : 0,
    };
  }

  private elapsedMs(now: number): number {
    if (this.status === 'ready') return 0;
    const end = this.status === 'playing' ? now : this.endedAt;
    return Math.min(this.timeLimitMs, end - this.startedAt);
  }

  private isWordMatched(word: string, value: string): boolean {
    if (value.length !== word.length) return false;
    return [...word].every((c, i) => sameChar(c, value[i], this.strict));
  }

  private finish(status: 'success' | 'failed', at: number): void {
    this.status = status;
    this.endedAt = at;
  }
}
