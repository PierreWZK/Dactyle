import { expect, test } from '@playwright/test';

const meta = (page: import('@playwright/test').Page, selector: string) =>
  page.locator(selector).first().getAttribute('content');

test.describe('vitrine', () => {
  test('contenu principal et appel à l’action vers le jeu', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Dactyle/);
    await expect(page.locator('h1')).toContainText('Recopie vite');
    await expect(page.locator('#theme-chips .chip')).toHaveCount(15);
    await expect(page.locator('.chip.expert')).toContainText('Programmation');

    await page.locator('.cta-main').first().click();
    await expect(page).toHaveURL(/\/jouer\/?$/);
    await expect(page.locator('#daily')).toBeVisible();
  });

  test('la démonstration de frappe s’anime', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#demo-typed')).not.toHaveText('', { timeout: 5000 });
    await expect(page.locator('#demo-word span').first()).toBeVisible();
  });

  test('pas de défilement horizontal', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test('un seul h1, une langue, des liens accessibles', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.locator('html').getAttribute('lang')).toBe('fr');
    await expect(page.getByRole('link', { name: '30 jours, 30 projets' })).toHaveAttribute('href', 'https://projectp.fr/');
  });
});

test.describe('référencement', () => {
  for (const [path, canonical] of [
    ['/', 'https://dactyle.projectp.fr/'],
    ['/jouer', 'https://dactyle.projectp.fr/jouer'],
  ] as const) {
    test(`${path} : balises de base, Open Graph et Twitter`, async ({ page }) => {
      await page.goto(path);
      const description = (await meta(page, 'meta[name="description"]'))!;
      expect(description.length).toBeGreaterThan(50);
      expect(description.length).toBeLessThanOrEqual(160);
      expect((await page.title()).length).toBeLessThanOrEqual(65);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);

      expect(await meta(page, 'meta[property="og:url"]')).toBe(canonical);
      expect(await meta(page, 'meta[property="og:title"]')).toBeTruthy();
      expect(await meta(page, 'meta[property="og:description"]')).toBeTruthy();
      expect(await meta(page, 'meta[property="og:image"]')).toBe('https://dactyle.projectp.fr/og.png');
      expect(await meta(page, 'meta[property="og:image:width"]')).toBe('1200');
      expect(await meta(page, 'meta[property="og:image:height"]')).toBe('630');
      expect(await meta(page, 'meta[property="og:image:alt"]')).toBeTruthy();
      expect(await meta(page, 'meta[name="twitter:card"]')).toBe('summary_large_image');
      expect(await meta(page, 'meta[name="twitter:image"]')).toBe('https://dactyle.projectp.fr/og.png');
    });
  }

  test('données structurées WebApplication rattachées à ProjectP', async ({ page }) => {
    await page.goto('/');
    const json = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(json['@type']).toBe('WebApplication');
    expect(json.url).toBe('https://dactyle.projectp.fr/');
    expect(json.isPartOf.url).toBe('https://projectp.fr/');
  });

  test('robots, sitemap, favicon et image d’aperçu répondent', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    const text = await robots.text();
    expect(text).toContain('Sitemap: https://dactyle.projectp.fr/sitemap.xml');
    expect(text).toContain('Disallow: /api/');

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>https://dactyle.projectp.fr/</loc>');
    expect(sitemap).toContain('<loc>https://dactyle.projectp.fr/jouer</loc>');

    expect((await request.get('/favicon.svg')).status()).toBe(200);
    const og = await request.get('/og.png');
    expect(og.status()).toBe(200);
    expect(og.headers()['content-type']).toContain('image/png');
  });

  test('/jouer et /jouer/ servent le jeu, un chemin inconnu renvoie 404', async ({ request }) => {
    for (const path of ['/jouer', '/jouer/']) {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(await res.text()).toContain('id="app"');
    }
    expect((await request.get('/nimporte-quoi')).status()).toBe(404);
  });
});
