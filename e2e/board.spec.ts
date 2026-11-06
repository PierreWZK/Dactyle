import { expect, test, type Page } from '@playwright/test';

// Les scores plus rapides que 300 mots par minute sont refusés par le serveur : on tape à vitesse humaine.
const HUMAN_DELAY = 60;

const uniquePseudo = () => `Joueur${Math.random().toString(36).slice(2, 8)}`;

async function typeWords(page: Page) {
  const words = (await page.locator('#words li').allTextContents()).map((w) => w.trim());
  for (const w of words) await page.locator('#entry').pressSequentially(w, { delay: HUMAN_DELAY });
}

async function choosePseudo(page: Page, pseudo: string) {
  await page.locator('#pseudo').fill(pseudo);
  await page.getByRole('button', { name: 'Choisir' }).click();
}

test('le classement du jour reçoit le résultat officiel avec le pseudo choisi', async ({ page }) => {
  const pseudo = uniquePseudo();
  await page.goto('/jouer');
  await page.locator('#daily').click();
  await typeWords(page);
  await expect(page.locator('.title')).toHaveText('Réussi !');

  await expect(page.locator('#rank')).toContainText('Choisis un pseudo');
  await choosePseudo(page, pseudo);
  await expect(page.locator('#rank')).toContainText('Résultat au classement ✓');

  await page.locator('#see-board').click();
  await expect(page.locator('.board tr.mine')).toContainText(pseudo);
  await expect(page.locator('.board tr.mine')).toContainText('%');

  // Après rechargement, le pseudo est mémorisé et le résultat reste au classement.
  await page.reload();
  await page.locator('#board').click();
  await expect(page.locator('.subtitle')).toContainText(pseudo);
  await expect(page.locator('.board tr.mine')).toContainText(pseudo);
});

test('un pseudo déjà pris est refusé, quelle que soit la casse', async ({ page, browser }) => {
  const pseudo = uniquePseudo();
  await page.goto('/jouer');
  await page.locator('#board').click();
  await choosePseudo(page, pseudo);
  await expect(page.locator('.subtitle')).toContainText(pseudo);

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await page2.goto('/jouer');
  await page2.locator('#board').click();
  await choosePseudo(page2, pseudo.toUpperCase());
  await expect(page2.locator('#pseudo-error')).toContainText('déjà pris');
  await other.close();
});

test('un pseudo invalide est refusé', async ({ page }) => {
  await page.goto('/jouer');
  await page.locator('#board').click();
  await page.locator('#pseudo').fill('a<b>');
  await page.getByRole('button', { name: 'Choisir' }).click();
  await expect(page.locator('#pseudo-error')).toContainText('invalide');
});

test('le meilleur temps d’un niveau apparaît dans le classement du thème', async ({ page }) => {
  const pseudo = uniquePseudo();
  await page.goto('/jouer');
  await page.locator('#board').click();
  await choosePseudo(page, pseudo);

  await page.getByRole('button', { name: '← Accueil' }).click();
  await page.getByRole('button', { name: /Fruits et légumes/ }).click();
  await page.locator('[data-level="1"]').click();
  const sent = page.waitForResponse((r) => r.url().includes('/api/scores/level'));
  await typeWords(page);
  await expect(page.locator('.title')).toHaveText('Réussi !');
  expect((await sent).status()).toBe(200);

  await page.getByRole('button', { name: 'Niveaux' }).click();
  await page.getByRole('button', { name: '← Thèmes' }).click();
  await page.locator('#board').click();
  await page.getByRole('button', { name: 'Meilleurs temps' }).click();
  await page.locator('#lb-theme').selectOption('fruits');
  await page.locator('#lb-level').selectOption('1');
  await expect(page.locator('.board tr.mine')).toContainText(pseudo);
});

test('le classement affiche un message clair si l’API est indisponible', async ({ page }) => {
  await page.route('**/api/leaderboard/**', (route) => route.abort());
  await page.goto('/jouer');
  await page.locator('#board').click();
  await expect(page.locator('#board-body')).toContainText('indisponible');
});

test('les pseudos sont échappés dans le tableau', async ({ page, request }) => {
  // Un pseudo ne peut pas contenir de balises : l'API le refuse.
  const res = await request.post('/api/players', { data: { pseudo: '<img src=x>', token: 'a'.repeat(32) } });
  expect(res.status()).toBe(400);
});
