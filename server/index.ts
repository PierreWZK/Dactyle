import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp, initSchema, type Db } from './app';

// Production : PostgreSQL via DATABASE_URL. Sans variable (dev, E2E) : PGlite en mémoire.
async function openDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    return { query: (sql, params) => pool.query(sql, params as unknown[]) as never };
  }
  console.warn('DATABASE_URL absente : base PGlite en mémoire (les scores sont perdus à l’arrêt).');
  const { PGlite } = await import('@electric-sql/pglite');
  const lite = new PGlite();
  return { query: (sql, params) => lite.query(sql, params) as never };
}

async function main(): Promise<void> {
  const db = await openDb();
  await initSchema(db);

  const app = createApp(db);
  // Le même serveur sert l'API et le site compilé.
  app.use('*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));

  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, () => console.log(`Dactyle écoute sur le port ${port}`));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
