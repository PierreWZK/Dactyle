import { expect, test, type Page } from '@playwright/test';

const THEMES = ['Animaux', 'Automobile', 'Programmation'];

// Sauvegarde où tous les niveaux d'un thème sont débloqués.
const allUnlocked = JSON.stringify({
  version: 2,
  settings: { strict: false },
  themes: Object.fromEntries(
    ['animaux', 'automobile', 'code'].map((id) => [
      id,
      { unlocked: 50, bestMs: {}, played: 0, won: 0, bestWpm: 0 },
    ]),
  ),
});

async function openLevel(page: Page, theme: string, level: number) {
  await page.getByRole('button', { name: new RegExp(theme) }).click();
  await page.locator(`[data-level="${level}"]`).click();
  await expect(page.locator('#entry')).toBeFocused();
}

// Recopie tous les mots affichés, dans l'ordre.
async function typeAllWords(page: Page) {
  const words = (await page.locator('#words li').allTextContents()).map((w) => w.trim());
  const entry = page.locator('#entry');
  for (const w of words) await entry.pressSequentially(w);
  return words;
}

test('l’accueil propose les 15 thèmes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-theme]')).toHaveCount(15);
  for (const t of THEMES) await expect(page.getByRole('button', { name: new RegExp(t) })).toBeVisible();
  await expect(page.locator('.summary')).toContainText('Parties : 0');
});

for (const theme of THEMES) {
  test(`${theme} : niveau 1 jouable, niveau 2 verrouillé, puis débloqué après réussite`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(theme) }).click();
    await expect(page.locator('[data-level="1"]')).toBeEnabled();
    await expect(page.locator('[data-level="2"]')).toBeDisabled();

    await page.locator('[data-level="1"]').click();
    const words = await typeAllWords(page);
    expect(words).toHaveLength(1);
    await expect(page.locator('.title')).toHaveText('Réussi !');
    await expect(page.locator('.stats')).toContainText('100 %');

    await page.getByRole('button', { name: 'Niveaux' }).click();
    await expect(page.locator('[data-level="2"]')).toBeEnabled();
  });
}

test('une faute colore la saisie, baisse la précision et ne fait pas échouer', async ({ page }) => {
  await page.goto('/');
  await openLevel(page, 'Animaux', 1);
  const entry = page.locator('#entry');
  const first = (await page.locator('#words li').first().textContent())!.trim();
  await entry.pressSequentially('#');
  await expect(entry).toHaveClass(/error/);
  await expect(page.locator('.ch.bad')).toHaveCount(1);
  await entry.press('Backspace');
  await expect(entry).not.toHaveClass(/error/);
  await entry.pressSequentially(first);
  await expect(page.locator('.title')).toHaveText('Réussi !');
  await expect(page.locator('.stats')).not.toContainText('100 %');
});

test('le niveau 50 demande six mots, tous affichés avant la saisie', async ({ page }) => {
  await page.addInitScript((save) => localStorage.setItem('dactyle:save', save), allUnlocked);
  await page.goto('/');
  await openLevel(page, 'Animaux', 50);
  await expect(page.locator('#words li')).toHaveCount(6);
  await typeAllWords(page);
  await expect(page.locator('.title')).toHaveText('Réussi !');
  await expect(page.locator('.stats')).toContainText('6 / 6');
});

test('Programmation (Expert) : trois vraies lignes de code, symboles compris', async ({ page }) => {
  await page.addInitScript((save) => localStorage.setItem('dactyle:save', save), allUnlocked);
  await page.goto('/');
  await openLevel(page, 'Programmation', 50);
  await expect(page.locator('#words li')).toHaveCount(3);
  await expect(page.locator('.hud-label')).toContainText('Strict');
  const lines = await page.locator('#words li').allTextContents();
  expect(lines.some((l) => /[(){};"=]/.test(l))).toBe(true);
  await typeAllWords(page);
  await expect(page.locator('.title')).toHaveText('Réussi !');
});

test('Entrée passe au niveau suivant après une réussite', async ({ page }) => {
  await page.goto('/');
  await openLevel(page, 'Animaux', 1);
  await typeAllWords(page);
  await expect(page.locator('.title')).toHaveText('Réussi !');
  await page.keyboard.press('Enter');
  await expect(page.locator('.hud-label')).toContainText('Niveau 2');
  await expect(page.locator('#entry')).toBeFocused();
});

test('mode strict : les majuscules deviennent obligatoires, et le choix est mémorisé', async ({ page }) => {
  await page.goto('/');
  await page.locator('#strict').check();
  await page.reload();
  await expect(page.locator('#strict')).toBeChecked();
  await openLevel(page, 'Animaux', 1);
  await expect(page.locator('.hud-label')).toContainText('Strict');
  const first = (await page.locator('#words li').first().textContent())!.trim();
  await page.locator('#entry').pressSequentially(first[0].toLowerCase());
  await expect(page.locator('#entry')).toHaveClass(/error/);
});

test('hors mode strict, majuscules et accents sont ignorés', async ({ page }) => {
  await page.goto('/');
  await openLevel(page, 'Animaux', 1);
  const first = (await page.locator('#words li').first().textContent())!.trim();
  const plain = first.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  await page.locator('#entry').pressSequentially(plain);
  await expect(page.locator('.title')).toHaveText('Réussi !');
});

test('le chrono ne démarre qu’à la première frappe, puis le niveau échoue à zéro', async ({ page }) => {
  await page.goto('/');
  await openLevel(page, 'Animaux', 1);
  const timer = page.locator('#timer');
  const before = await timer.textContent();
  await page.waitForTimeout(800);
  await expect(timer).toHaveText(before!);

  const entry = page.locator('#entry');
  const first = (await page.locator('#words li').first().textContent())!.trim();
  await entry.pressSequentially(first[0]);
  await page.waitForTimeout(800);
  await expect(timer).not.toHaveText(before!);

  await expect(page.locator('.title')).toHaveText('Échec', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Rejouer' }).click();
  await expect(page.locator('#entry')).toBeFocused();
  await expect(page.locator('#entry')).toHaveValue('');
});

test('la progression et les records survivent à un rechargement', async ({ page }) => {
  await page.goto('/');
  await openLevel(page, 'Animaux', 1);
  await typeAllWords(page);
  await expect(page.locator('.badge')).toHaveText(/record/i);
  await page.reload();
  await expect(page.getByRole('button', { name: /Animaux/ })).toContainText('2 / 50');
  await expect(page.locator('.summary')).toContainText('Réussies : 1');
  await page.getByRole('button', { name: /Animaux/ }).click();
  await expect(page.locator('[data-level="1"]')).toContainText(' s');
});

test('une sauvegarde corrompue ne casse pas le jeu', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dactyle:save', '{cassé'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Animaux/ })).toContainText('1 / 50');
});

test('pas de défilement horizontal et saisie visible à l’écran de jeu', async ({ page }) => {
  await page.goto('/');
  await openLevel(page, 'Automobile', 1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.locator('#entry')).toBeInViewport();
  await expect(page.locator('#words')).toBeInViewport();
  await expect(page.locator('#timer')).toBeInViewport();
});

test('performance : chargement rapide et saisie fluide', async ({ page }) => {
  await page.goto('/');
  const nav = await page.evaluate(() => {
    const [n] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return n.domContentLoadedEventEnd;
  });
  expect(nav).toBeLessThan(1500);

  await openLevel(page, 'Animaux', 1);
  const start = Date.now();
  await typeAllWords(page);
  await expect(page.locator('.title')).toHaveText('Réussi !');
  expect(Date.now() - start).toBeLessThan(3000);
});
