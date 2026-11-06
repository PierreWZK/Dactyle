export type Difficulty = 'Facile' | 'Intermédiaire' | 'Difficile';

export interface Theme {
  id: string;
  name: string;
  difficulty: Difficulty;
  words: string[];
}

// Un thème = un objet de données. Ajouter un thème ne touche pas au moteur.
export const THEMES: Theme[] = [
  {
    id: 'animaux',
    name: 'Animaux',
    difficulty: 'Facile',
    words: ['Chat', 'Chien', 'Éléphant', 'Girafe', 'Hippopotame', 'Rhinocéros', 'Crocodile', 'Orang-outan'],
  },
  {
    id: 'automobile',
    name: 'Automobile',
    difficulty: 'Intermédiaire',
    words: ['Moteur', 'Embrayage', 'Transmission', 'Carburateur', 'Différentiel', 'Turbocompresseur'],
  },
  {
    id: 'code',
    name: 'Programmation',
    difficulty: 'Difficile',
    words: ['JavaScript', 'TypeScript', 'Asynchronous', 'Middleware', 'Authentication', 'useEffect', 'addEventListener'],
  },
];
