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
    words: [
      'Chat', 'Chien', 'Lapin', 'Hérisson', 'Girafe', 'Écureuil', 'Pingouin', 'Léopard',
      'Éléphant', 'Kangourou', 'Hippopotame', 'Rhinocéros', 'Crocodile', 'Orang-outan',
    ],
  },
  {
    id: 'automobile',
    name: 'Automobile',
    difficulty: 'Intermédiaire',
    words: [
      'Frein', 'Pneu', 'Moteur', 'Radiateur', 'Démarreur', 'Embrayage', 'Amortisseur',
      'Allumage', 'Carrosserie', 'Transmission', 'Carburateur', 'Différentiel', 'Pare-brise',
      'Suspension', 'Injection', 'Turbocompresseur',
    ],
  },
  {
    id: 'code',
    name: 'Programmation',
    difficulty: 'Difficile',
    words: [
      'Promise', 'Fetch', 'Closure', 'Callback', 'Hoisting', 'JavaScript', 'TypeScript',
      'Middleware', 'Authentication', 'Destructuring', 'Asynchronous', 'useEffect',
      'addEventListener', 'Serialization', 'Dependency',
    ],
  },
];
