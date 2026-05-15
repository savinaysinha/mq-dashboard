// server.js
// Application entry point — creates the Express app, mounts middleware and routes.

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { PORT } from './config.js';
import configRoute from './routes/configRoute.js';
import qmgrRoutes from './routes/qmgrRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
// If public/ is at the project root, go up one level:
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', configRoute);
app.use('/api/qmgr', qmgrRoutes);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
