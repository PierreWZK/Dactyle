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

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}_$]/u.test(c);

// Espaces facultatifs (code) : un espace voisin d'un symbole peut être omis (`x = y` vaut `x=y`),
// alors qu'un espace entre deux mots est obligatoire (`const x`).
function keepMask(text: string): boolean[] {
  const chars = [...text];
  return chars.map((c, i) => c !== ' ' || (isWordChar(chars[i - 1]) && isWordChar(chars[i + 1])));
}

function squash(text: string): string {
  const collapsed = text.replace(/ {2,}/g, ' ');
  const mask = keepMask(collapsed);
  return [...collapsed].filter((_, i) => mask[i]).join('');
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
    readonly looseSpaces = false,
  ) {}

  get currentIndex(): number {
    return this.wordIndex;
  }

  get currentWord(): string {
    return this.words[this.wordIndex] ?? '';
  }

  // État de chaque lettre du mot courant : juste, fausse ou à taper.
  get letterStates(): ('ok' | 'bad' | 'todo')[] {
    const chars = [...this.currentWord];
    const expected = [...this.norm(this.currentWord)];
    const typed = [...this.norm(this.input)];
    const mask = this.looseSpaces ? keepMask(this.currentWord) : chars.map(() => true);

    const states: ('ok' | 'bad' | 'todo')[] = [];
    let k = 0;
    chars.forEach((_, i) => {
      if (!mask[i]) {
        states.push('todo');
        return;
      }
      states.push(k >= typed.length ? 'todo' : sameChar(expected[k], typed[k], this.strict) ? 'ok' : 'bad');
      k++;
    });
    // Un espace facultatif prend l'état de la lettre qui le suit.
    for (let i = chars.length - 1; i >= 0; i--) {
      if (!mask[i]) states[i] = states[i + 1] ?? (typed.length >= expected.length ? 'ok' : 'todo');
    }
    return states;
  }

  // Vrai si la saisie en cours diverge du mot attendu.
  get hasError(): boolean {
    const expected = this.norm(this.currentWord);
    const typed = this.norm(this.input);
    if (typed.length > expected.length) return true;
    return [...typed].some((c, i) => !sameChar(expected[i], c, this.strict));
  }

  // Appelé à chaque modification du champ de saisie.
  handleInput(rawValue: string, now: number): void {
    if (this.status !== 'ready' && this.status !== 'playing') return;

    const word = this.currentWord;
    // Un espace en début de mot est ignoré : ni faute, ni frappe comptée, ni départ du chrono.
    const value = word.startsWith(' ') ? rawValue : rawValue.replace(/^ +/, '');
    if (this.status === 'ready' && value === '') return;
    if (value === this.input) return;

    if (this.status === 'ready') {
      this.status = 'playing';
      this.startedAt = now;
    }
    if (value.length > this.input.length) this.judgeKeystroke(word, this.input, value);
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
    const elapsedMs = Math.round(this.elapsedMs(now)); // entier : le serveur refuse les décimales
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

  private norm(text: string): string {
    return this.looseSpaces ? squash(text) : text;
  }

  // Une frappe ajoute un caractère en fin de champ : on la juge.
  private judgeKeystroke(word: string, before: string, after: string): void {
    if (!this.looseSpaces) {
      const pos = after.length - 1;
      this.keystrokes++;
      if (!sameChar(word[pos], after[pos], this.strict)) this.errors++;
      return;
    }
    const expected = squash(word);
    const typed = squash(after);
    const from = squash(before).length;
    if (typed.length === from) return; // espace facultatif en attente : ni juste ni faux
    this.keystrokes++;
    for (let j = from; j < typed.length; j++) {
      if (!sameChar(expected[j], typed[j], this.strict)) {
        this.errors++;
        break;
      }
    }
  }

  private elapsedMs(now: number): number {
    if (this.status === 'ready') return 0;
    const end = this.status === 'playing' ? now : this.endedAt;
    return Math.min(this.timeLimitMs, end - this.startedAt);
  }

  private isWordMatched(word: string, value: string): boolean {
    const expected = this.norm(word);
    const typed = this.norm(value);
    if (typed.length !== expected.length) return false;
    return [...expected].every((c, i) => sameChar(c, typed[i], this.strict));
  }

  private finish(status: 'success' | 'failed', at: number): void {
    this.status = status;
    this.endedAt = at;
  }
}
