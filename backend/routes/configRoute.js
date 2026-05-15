// routes/configRoute.js
// Exposes sanitised, frontend-safe config via GET /api/config.

import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

router.get('/config', (req, res) => {
  return res.json({
    auth: {
      credentialStorageKey: config.server?.credentialStorageKey || 'mq_credentials',
      credentialExpiryMs: (config.server?.credentialExpiryHours ?? 4) * 3600 * 1000,
    },
    ui: {
      loginTitle:
        config.ui?.loginTitle || 'MQ Administrator Login',
      loginDescription:
        config.ui?.loginDescription ||
        'Please enter your IBM MQ credentials to access the dashboard.',
      refreshIntervalMs:
        config.ui?.refreshIntervalMs ??
        (config.ui?.refreshIntervalSeconds ?? 60) * 1000,
      mqWebConsoleSuffix: config.ui?.mqWebConsoleSuffix || '/ibmmq/console/',
    },
    mq: {
      DefaultListenerKeyword: config.server?.DefaultListenerKeyword || 'APP',
    },
    queueManagers: config.queueManagers || [],
  });
});

export default router;
