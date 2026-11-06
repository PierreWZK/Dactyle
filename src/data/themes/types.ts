export type Difficulty = 'Facile' | 'Intermédiaire' | 'Difficile' | 'Expert';

export interface Theme {
  id: string;
  name: string;
  difficulty: Difficulty;
  words: string[];
  // Majuscules, accents et symboles toujours exigés (ex. lignes de code).
  strict?: boolean;
  // Plafond du nombre de mots par niveau (6 par défaut).
  maxWords?: number;
}
