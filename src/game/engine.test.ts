import { describe, expect, it } from 'vitest';
import { TypingGame } from './engine';

// Tape un texte caractère par caractère, 100 ms entre chaque frappe.
function typeText(game: TypingGame, text: string, start = 0): number {
  let t = start;
  let value = game.input;
  for (const ch of text) {
    value += ch;
    game.handleInput(value, t);
    value = game.input; // le moteur vide le champ quand un mot est validé
    t += 100;
  }
  return t;
}

describe('TypingGame', () => {
  it('réussit un mot recopié dans le temps', () => {
    const g = new TypingGame(['Chat'], 5000);
    typeText(g, 'Chat');
    const r = g.result(400);
    expect(g.status).toBe('success');
    expect(r).toMatchObject({ success: true, wordsDone: 1, totalWords: 1, precision: 100 });
  });

  it('démarre le chrono à la première frappe seulement', () => {
    const g = new TypingGame(['Chat'], 5000);
    expect(g.remainingMs(99999)).toBe(5000);
    expect(g.tick(99999)).toBe('ready');
    g.handleInput('C', 1000);
    expect(g.remainingMs(3000)).toBe(3000);
  });

  it('échoue quand le temps est écoulé et fige le temps', () => {
    const g = new TypingGame(['Chat'], 5000);
    g.handleInput('C', 0);
    expect(g.tick(4999)).toBe('playing');
    expect(g.tick(5000)).toBe('failed');
    expect(g.result(60000).elapsedMs).toBe(5000);
    g.handleInput('Ch', 6000);
    expect(g.input).toBe('C');
  });

  it('une faute baisse la précision sans faire échouer', () => {
    const g = new TypingGame(['Chat'], 5000);
    g.handleInput('x', 0);
    expect(g.hasError).toBe(true);
    g.handleInput('', 100);
    typeText(g, 'Chat', 200);
    const r = g.result(700);
    expect(g.status).toBe('success');
    expect(r.precision).toBe(80); // 4 justes sur 5 frappes
  });

  it('ignore accents et majuscules par défaut', () => {
    const g = new TypingGame(['Éléphant'], 5000);
    typeText(g, 'elephant');
    expect(g.status).toBe('success');
  });

  it('exige accents et majuscules en mode strict', () => {
    const g = new TypingGame(['Éléphant'], 5000, true);
    typeText(g, 'elephant');
    expect(g.status).toBe('playing');
    expect(g.hasError).toBe(true);
  });

  it('accepte les accents exacts en mode strict', () => {
    const g = new TypingGame(['Éléphant'], 5000, true);
    typeText(g, 'Éléphant');
    expect(g.status).toBe('success');
  });

  it('gère les tirets et les majuscules internes', () => {
    const g = new TypingGame(['Orang-outan', 'useEffect'], 20000, true);
    typeText(g, 'Orang-outan');
    expect(g.currentWord).toBe('useEffect');
    typeText(g, 'useeffect', 2000);
    expect(g.status).toBe('playing');
    g.handleInput('', 3000);
    typeText(g, 'useEffect', 3100);
    expect(g.status).toBe('success');
  });

  it('demande les mots dans l’ordre', () => {
    const g = new TypingGame(['Chat', 'Chien'], 20000);
    g.handleInput('Chien', 0);
    expect(g.currentIndex).toBe(0);
    g.handleInput('', 100);
    typeText(g, 'Chat', 200);
    expect(g.currentIndex).toBe(1);
    expect(g.input).toBe('');
    typeText(g, 'Chien', 1000);
    expect(g.status).toBe('success');
    expect(g.result(2000).wordsDone).toBe(2);
  });

  it('ignore la saisie une fois le niveau réussi', () => {
    const g = new TypingGame(['Chat'], 5000);
    typeText(g, 'Chatt');
    expect(g.currentIndex).toBe(1);
    expect(g.status).toBe('success');
  });

  it('indique l’état de chaque lettre', () => {
    const g = new TypingGame(['Chat'], 5000);
    g.handleInput('Cx', 0);
    expect(g.letterStates).toEqual(['ok', 'bad', 'todo', 'todo']);
  });

  it('calcule la vitesse en mots par minute', () => {
    const g = new TypingGame(['abcde'], 60000);
    typeText(g, 'abcde', 0); // 5 caractères en 400 ms
    expect(g.result(400).wpm).toBe(150); // 1 mot en 0,4 s
  });
});

describe('espaces', () => {
  it('ignore un espace en début de mot : ni faute, ni frappe, ni départ du chrono', () => {
    const g = new TypingGame(['Chat'], 5000);
    g.handleInput(' ', 0);
    expect(g.status).toBe('ready');
    expect(g.input).toBe('');
    g.handleInput(' C', 500);
    expect(g.input).toBe('C');
    typeText(g, 'hat', 600);
    expect(g.status).toBe('success');
    expect(g.result(900)).toMatchObject({ precision: 100, elapsedMs: 300 });
  });

  it('ignore plusieurs espaces de tête, y compris sur un mot suivant', () => {
    const g = new TypingGame(['Chat', 'Chien'], 20000);
    typeText(g, 'Chat');
    g.handleInput('   ', 1000);
    expect(g.input).toBe('');
    expect(g.hasError).toBe(false);
    typeText(g, 'Chien', 1100);
    expect(g.status).toBe('success');
    expect(g.result(2000).precision).toBe(100);
  });

  it('garde les espaces intérieurs des mots composés', () => {
    const g = new TypingGame(['Étoile de mer'], 20000);
    typeText(g, 'etoilede mer');
    expect(g.status).toBe('playing');
    expect(g.hasError).toBe(true);
  });
});

describe('espaces facultatifs (code)', () => {
  const loose = (word: string) => new TypingGame([word], 60000, true, true);

  it.each(['x = y', 'x=y', 'x  =   y', 'x= y', 'x =y'])('accepte « %s » pour « x = y »', (typed) => {
    const g = loose('x = y');
    typeText(g, typed);
    expect(g.status).toBe('success');
  });

  it('exige l’espace entre deux mots', () => {
    const g = loose('const x = 5;');
    typeText(g, 'constx=5;');
    expect(g.status).toBe('playing');
    expect(g.hasError).toBe(true);

    const ok = loose('const x = 5;');
    typeText(ok, 'const x=5;');
    expect(ok.status).toBe('success');
  });

  it('gère les appels et les fonctions fléchées sans espaces', () => {
    const g = loose('arr.map((n) => n * 2)');
    typeText(g, 'arr.map((n)=>n*2)');
    expect(g.status).toBe('success');
  });

  it('garde la casse et les symboles stricts', () => {
    const g = loose('x = y');
    typeText(g, 'X=y');
    expect(g.status).toBe('playing');
    expect(g.hasError).toBe(true);
  });

  it('ne compte pas les espaces facultatifs dans la précision', () => {
    const g = loose('x = y');
    typeText(g, 'x = y');
    expect(g.result(1000).precision).toBe(100);
    const h = loose('x = y');
    typeText(h, 'x=y');
    expect(h.result(1000).precision).toBe(100);
  });

  it('compte une faute normalement', () => {
    const g = loose('x = y');
    g.handleInput('z', 0);
    expect(g.hasError).toBe(true);
    g.handleInput('', 100);
    typeText(g, 'x=y', 200);
    expect(g.status).toBe('success');
    expect(g.result(600).precision).toBe(75); // 3 justes sur 4 frappes
  });

  it('colore les lettres malgré les espaces différents', () => {
    const g = loose('x = y');
    g.handleInput('x=', 0);
    expect(g.letterStates).toEqual(['ok', 'ok', 'ok', 'todo', 'todo']);
    g.handleInput('x=q', 100);
    expect(g.letterStates[4]).toBe('bad');
  });
});
