import express from 'express';
import cors from 'cors';
import config from './config.js';
import { initDb } from './db/client.js';
import { authMiddleware } from './api/middleware/auth.js';
import implementRoutes from './api/routes/implement.js';
import jobsRoutes from './api/routes/jobs.js';
import specsRoutes from './api/routes/specs.js';
import challengesRoutes from './api/routes/challenges.js';
import statsRoutes from './api/routes/stats.js';
import categoriesRoutes from './api/routes/categories.js';
import packagesRoutes from './api/routes/packages.js';
import challengeFilesRoutes from './api/routes/challengeFiles.js';

async function start() {
  // Initialize database
  await initDb();
  console.log('[DB] SQLite (sql.js) initialized');

  // Start queue workers (wrapped in try/catch for Redis unavailability)
  try {
    const { startResearcherWorker } = await import('./queue/workers/researcherWorker.js');
    const { startBuilderWorker } = await import('./queue/workers/builderWorker.js');
    startResearcherWorker();
    startBuilderWorker();
    console.log('[Queue] Workers started');
  } catch (err) {
    console.warn('[Queue] Failed to start workers (is Redis running?):', err.message);
    console.warn('[Queue] The API will work but job processing will be unavailable');
  }

  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(authMiddleware);

  // Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/implement', implementRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/specs', specsRoutes);
  app.use('/api/challenges', challengesRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/packages', packagesRoutes);
  app.use('/api/challenge-files', challengeFilesRoutes);

  app.listen(config.port, () => {
    console.log(`[Server] CTF Orchestrator running on port ${config.port}`);
    console.log(`[Server] Environment: ${config.nodeEnv}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
