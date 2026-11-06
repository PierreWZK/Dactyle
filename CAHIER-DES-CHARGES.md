# Jour 24/30 — Dactyle, le jeu de rapidité de frappe

> Stack : **TypeScript**, **Vite**, application statique · hébergement **Coolify**, sous-domaine `dactyle.projectp.fr`.

Ce document est notre contrat : on le suit étape par étape, et toute décision qui s'en écarte est d'abord notée ici.

## 1. Concept

Recopier le plus vite possible des mots ou des séries de mots pour terminer des niveaux dans un temps limité. Simple à comprendre, addictif : on rejoue pour battre son temps et passer au niveau suivant.

## 2. Objectifs

- Un gameplay immédiat : lire, taper, valider.
- Une difficulté qui monte sans rendre les niveaux impossibles.
- Une interface minimaliste où les mots et le champ de saisie dominent.
- Jouable au clavier physique comme au clavier tactile.
- Aucun compte, aucun backend : tout est sauvegardé localement.

## 3. Règles du jeu

1. Tous les mots du niveau sont affichés avant la saisie.
2. Le joueur recopie les mots **dans l'ordre**, un par un, dans un champ de saisie.
3. Le chronomètre démarre à la **première frappe** (le joueur peut lire sans pression).
4. Un mot est validé dès qu'il est correctement saisi, puis le suivant devient actif.
5. Réussite : tous les mots sont validés avant la fin du temps. Échec : le temps est écoulé.
6. Une **faute de frappe** n'échoue pas le niveau : elle est signalée en rouge et abaisse la précision.
7. Par défaut, accents et majuscules sont ignorés (`elephant` valide `Éléphant`). Le **mode strict** les exige.

## 4. Thèmes

| Thème | Difficulté | Exemples |
|---|---|---|
| Animaux | Facile | Chat, Éléphant, Hippopotame, Orang-outan |
| Automobile | Intermédiaire | Moteur, Embrayage, Carburateur, Turbocompresseur |
| Programmation | Difficile | JavaScript, Middleware, useEffect, addEventListener |

Les mots des thèmes « Animaux » et « Automobile » sont en français, ceux de « Programmation » en anglais. Chaque thème est un fichier de données (`id`, `nom`, `difficulté`, `mots[]`) : ajouter un thème ne modifie pas la logique du jeu.

## 5. Difficultés et progression des niveaux

Chaque thème propose 10 niveaux. Les niveaux sont **générés** à partir d'une courbe de progression réglable (`src/data/levels.ts`) :

| Critère | Évolution |
|---|---|
| Nombre de mots | 1 au niveau 1, jusqu'à 5 au niveau 10 |
| Longueur des mots | de plus en plus longs au fil des niveaux |
| Complexité | accents, tirets, majuscules internes (`useEffect`) selon le thème |
| Temps | calculé d'après le nombre total de caractères et une vitesse cible qui augmente peu à peu |

Le temps n'est jamais réduit arbitrairement : il dérive de la longueur à taper, avec une marge qui se resserre doucement. Exemples visés : niveau 1 « Animaux » = 1 mot, ~10 s ; niveau 10 = 5 mots (Éléphant, Hippopotame, Rhinocéros, Crocodile, Orang-outan), ~20 s.

**Déblocage** : réussir un niveau débloque le suivant dans le même thème. Les thèmes sont tous accessibles dès le départ.

## 6. Système de score

À la fin d'un niveau :

- **Résultat** : réussite ou échec.
- **Temps utilisé**.
- **Mots recopiés** sur le total.
- **Précision** = frappes correctes / frappes totales.
- **Vitesse** en MPM (mots par minute, 1 mot = 5 caractères), calculée sur les caractères validés.
- **Meilleur temps** par niveau, sauvegardé ; mise en avant d'un nouveau record.

Statistiques globales : niveaux réussis, parties jouées, meilleure vitesse, précision moyenne.

## 7. Direction artistique

- Interface épurée, fond sobre, une couleur d'accent, une typographie lisible (mots en grand, police à chasse fixe pour la saisie).
- Mots à recopier et champ de saisie = éléments les plus visibles ; chrono clairement identifiable.
- Retours immédiats : lettres justes, fautes, mot validé. Animations légères et transitions fluides.
- Pas de décor superflu, pas de tableau de bord générique.
- Responsive : ordinateur, tablette, smartphone. Sur mobile, le champ et les mots restent visibles au-dessus du clavier virtuel.

La référence visuelle précise sera validée avec le porteur du projet avant l'étape 4.

## 8. Fonctionnalités

**Minimum jouable (MVP)**

- Sélection du thème et du niveau.
- Écran de jeu : thème, niveau, chrono, mots, saisie, progression, retour visuel.
- Chronomètre précis (`performance.now()`), échec à la fin du temps.
- Écran de résultats avec « Rejouer » et « Niveau suivant ».
- Progression, meilleurs temps et statistiques sauvegardés (`localStorage`).
- Mode strict.

**Hors périmètre** : comptes, backend, classement en ligne, multijoueur.

## 9. Roadmap

| Étape | Contenu |
|---|---|
| 1 | Audit, nettoyage, documentation, repository GitHub |
| 2 | Structure et gameplay principal : moteur, chrono, saisie, sélection thème/niveau, réussite/échec |
| 3 | Progression et contenu : 3 thèmes, 10 niveaux chacun, déblocage, sauvegarde, statistiques |
| 4 | Design et finition : responsive, expérience mobile, animations, écran de résultats |
| 5 | Campagne de tests finale, build de production, mise en ligne, documentation, dernière PR |

Aucune campagne de tests avant l'étape 5, hors vérifications techniques pour compiler et lancer le projet.

## 10. Organisation Git

- Dépôt public `day-24`, branche par défaut `master`.
- Jamais de développement direct sur `master` : une branche par étape, une Pull Request vers `master`.
- Aucune fusion sans accord explicite.

## 11. Définition du « terminé »

Le jeu est jouable de bout en bout sur ordinateur et mobile, les tests de l'étape 5 passent, le site est en ligne sur `dactyle.projectp.fr`, README et cahier des charges sont à jour, et la carte du projet passe à « terminé » sur la vitrine (après validation).

## 12. À décider avec le porteur du projet

- **Le jeu quotidien** : un tirage commun à tous (d'après la date), une tentative par jour, une série et un résultat à partager. Idées à proposer avant l'étape 2.
- **Le look** : une référence visuelle ou deux directions à valider avant l'étape 4.

## 13. Aperçu du lien (à faire sans redemander)

- Image Open Graph **1200 × 630** aux couleurs du projet, générée avec `scripts/og/build-og.py` (ajouter le projet à la liste).
- Sur chaque page publique : `og:title`, `og:description`, `og:url`, `og:image` (adresse absolue), `og:image:width`, `og:image:height`, `og:image:alt`, `twitter:card` = `summary_large_image`.
- Vérifier en ligne que l'image répond en 200 et que les balises sont servies.

## 14. Indexation (à faire sans redemander)

- `robots.txt` et `sitemap.xml` (pages publiques uniquement), balise `canonical`.
- JSON-LD `WebApplication` sur l'accueil, avec `isPartOf` ProjectP (https://projectp.fr/).
- Lien « 30 jours, 30 projets » vers https://projectp.fr/ dans le pied de page.
- Site statique : ajouter le projet à `scripts/seo/apply-seo.py` et relancer le script.
- Vérifier en ligne, puis rappeler de soumettre `https://dactyle.projectp.fr/sitemap.xml` dans Google Search Console.

## 15. Vitrine 30days30projects (avec validation)

Une fois en ligne, demander l'accord, puis seulement :

- `projects.js` : l'entrée du jour 24 passe à `status: 'done'`, avec `name: 'Dactyle'`, `url`, `repo`, `image` et `description`.
- `preview-days-images/day24_dactyle.png` : capture de l'accueil, 1600 × 900.
- `README.md` : la ligne du jour 24 dans le tableau des 30 projets.
- Commit et push du dépôt `30days30projects`.
