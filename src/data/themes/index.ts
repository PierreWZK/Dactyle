import { animaux } from './animaux';
import { automobile } from './automobile';
import { cinema } from './cinema';
import { code } from './code';
import { corps } from './corps';
import { cuisine } from './cuisine';
import { espace } from './espace';
import { fruits } from './fruits';
import { metiers } from './metiers';
import { musique } from './musique';
import { mythologie } from './mythologie';
import { nature } from './nature';
import { ocean } from './ocean';
import { pays } from './pays';
import { sports } from './sports';
import type { Theme } from './types';

export type { Difficulty, Theme } from './types';

// Pour ajouter un thème : créer son fichier, puis l'ajouter à cette liste.
// Les thèmes sont classés du plus facile au plus difficile.
export const THEMES: Theme[] = [
  animaux, fruits, sports, ocean, nature,
  automobile, cuisine, pays, musique, cinema, metiers,
  espace, corps, mythologie,
  code,
];
