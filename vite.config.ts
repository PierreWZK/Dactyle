import { defineConfig } from 'vite';

// Deux pages : la vitrine (/) et le jeu (/jouer/).
export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: { vitrine: 'index.html', jeu: 'jouer/index.html' },
    },
  },
  // En développement, l'API tourne à part (npm run build && npm start).
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
