# Dactyle · Le jeu de rapidité de frappe

> Jour 24 du défi **30 jours, 30 projets** · TypeScript · Vite · ⏳ **En cours de développement**

Un mot s'affiche, tu le recopies, le chrono tourne. Chaque thème (animaux, automobile, code) propose des niveaux de plus en plus longs, avec de plus en plus de mots à recopier. Bats ton meilleur temps et débloque la suite.

📄 Les règles détaillées sont dans le [cahier des charges](CAHIER-DES-CHARGES.md).

## Fonctionnement

1. Choisis un **thème**, puis un **niveau**.
2. Tous les mots du niveau s'affichent : lis-les.
3. Tape le premier mot dans le champ de saisie. Le chrono démarre à la première frappe.
4. Chaque mot validé passe au suivant, dans l'ordre.
5. Tu réussis si tous les mots sont recopiés avant la fin du temps.

Une faute de frappe n'échoue pas le niveau : elle baisse ta **précision**. Un **mode strict** (accents et majuscules obligatoires) est disponible ; par défaut, `elephant` valide `Éléphant`.

À la fin d'un niveau : réussite ou échec, temps, mots recopiés, précision et vitesse (MPM). Les niveaux se débloquent un à un, par thème. Progression, meilleurs temps et statistiques sont sauvegardés dans le navigateur (`localStorage`), sans compte.

## Technologies

- **TypeScript** + **Vite** (application statique, aucun backend)
- Interface en HTML/CSS, sans framework
- Tests : Vitest (moteur de jeu) et Playwright (parcours complet)
- Déploiement : image Docker (Nginx) sur **Coolify**

## Installation

Prérequis : Node.js 22+ et npm.

```bash
npm install
```

## Configuration

Aucune variable d'environnement n'est nécessaire.

## Lancement

```bash
npm run dev        # http://localhost:5173
npm run build      # build de production dans dist/
npm run preview    # sert le build de production
npm test           # tests unitaires
```

> Le code est ajouté à partir de l'étape 2 de la [roadmap](CAHIER-DES-CHARGES.md#roadmap) : ces commandes seront disponibles à ce moment-là.

## Informations pour le développement

- Un thème = un fichier dans `src/data/themes/`. Ajouter un thème ne demande aucune modification du moteur.
- Les paramètres de progression (nombre de mots, longueur, temps) se règlent dans `src/data/levels.ts`.
- Le moteur (`src/game/`) ne touche pas au DOM : il est testable seul.
- Le chronomètre s'appuie sur `performance.now()`, pas sur le nombre d'affichages.
- Workflow Git : branche par défaut `master`, développement sur des branches de fonctionnalités, Pull Requests relues avant fusion.

## Mise en ligne

Prévue sur Coolify : **https://dactyle.projectp.fr**.
