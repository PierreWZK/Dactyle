import { defineConfig, devices } from '@playwright/test';

// Les tests E2E tournent sur le build de production, servi par le serveur Node.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // Optionnel : réutiliser un Chromium déjà installé (PW_CHROMIUM_PATH).
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  webServer: {
    // Serveur complet (site + API, base PGlite en mémoire).
    command: 'npm run build && npm start',
    env: { PORT: '4173' },
    url: 'http://localhost:4173/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
