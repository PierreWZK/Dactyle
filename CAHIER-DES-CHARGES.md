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
- Aucun compte : la progression est locale ; seul le classement passe par un serveur.

## 3. Règles du jeu

1. Tous les mots du niveau sont affichés avant la saisie.
2. Le joueur recopie les mots **dans l'ordre**, un par un, dans un champ de saisie.
3. Le chronomètre démarre à la **première frappe** (le joueur peut lire sans pression).
4. Un mot est validé dès qu'il est correctement saisi, puis le suivant devient actif.
5. Réussite : tous les mots sont validés avant la fin du temps. Échec : le temps est écoulé.
6. Une **faute de frappe** n'échoue pas le niveau : elle est signalée en rouge et abaisse la précision.
7. Par défaut, accents et majuscules sont ignorés (`elephant` valide `Éléphant`). Le **mode strict**, activable sur l'accueil et mémorisé, les exige. Le thème Programmation est toujours strict.

## 4. Thèmes

15 thèmes, chacun avec une difficulté : Facile, Intermédiaire, Difficile ou Expert.

| Difficulté | Thèmes |
|---|---|
| Facile | Animaux, Fruits et légumes, Sports, Océan, Nature |
| Intermédiaire | Automobile, Cuisine, Pays du monde, Musique, Cinéma, Métiers |
| Difficile | Espace, Corps humain, Mythologie |
| Expert | Programmation : de vraies lignes de code (`console.log("test")`), toujours en mode strict |

Chaque thème est un fichier de données dans `src/data/themes/` (`id`, `nom`, `difficulté`, `mots[]`, options `strict` et `maxWords`). Ajouter un thème = créer le fichier et l'ajouter à `src/data/themes/index.ts`.

## 5. Difficultés et progression des niveaux

Chaque thème propose **50 niveaux**, générés à partir d'une courbe réglable (`src/data/levels.ts`) :

| Critère | Évolution |
|---|---|
| Nombre de mots | 1 mot aux niveaux 1 à 8, puis un mot de plus tous les 8 niveaux (6 au maximum, 3 lignes pour Programmation) |
| Longueur des mots | les mots sont triés par longueur ; une fenêtre glisse vers les mots longs à mesure que le niveau monte |
| Temps | 2 s + caractères × temps par caractère (selon la difficulté du thème) × une marge qui passe de 1,2 au niveau 1 à 0,75 au niveau 50 |
| Aléatoire | les mots sont tirés au hasard dans la fenêtre ; les mots déjà joués à ce niveau sont écartés tant qu'il reste du choix |

**Déblocage** : réussir un niveau débloque le suivant dans le même thème. Tous les thèmes sont accessibles dès le départ.

**Clavier** : Entrée sur l'écran de résultat passe au niveau suivant après une réussite, ou rejoue le niveau après un échec.

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

**Classement global** : pseudo libre sans compte (jeton secret dans le navigateur), classement du niveau du jour et meilleurs temps par thème et niveau, API Hono + PostgreSQL.

**Hors périmètre** : comptes avec mot de passe, multijoueur en temps réel, anti-triche complet.

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
