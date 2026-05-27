// backend/routes/configRoute.js
// Exposes sanitised, frontend-safe config via GET /api/config.
// Fix #14 — baseUrl is stripped from queueManagers before sending to browser.

import { Router } from 'express';
import { config }  from '../config.js';

const router = Router();

router.get('/config', (req, res) => {
  return res.json({
    auth: {
      credentialStorageKey: config.server?.credentialStorageKey || 'mq_credentials',
      credentialExpiryMs:   (config.server?.credentialExpiryHours ?? 4) * 3600 * 1000,
    },
    ui: {
      loginTitle:         config.ui?.loginTitle        || 'MQ Administrator Login',
      loginDescription:   config.ui?.loginDescription  || 'Please enter your AD credentials to access the dashboard.',
      refreshIntervalMs:  config.ui?.refreshIntervalMs ?? (config.ui?.refreshIntervalSeconds ?? 60) * 1000,
      mqWebConsoleSuffix: config.ui?.mqWebConsoleSuffix || '/ibmmq/console/',
    },
    mq: {
      DefaultListenerKeyword: config.server?.DefaultListenerKeyword || 'APP',
    },
    // Strip baseUrl — internal server addresses should not be sent to the browser
    queueManagers: (config.queueManagers || []).map(({ name, qmName }) => ({ name, qmName })),
  });
});

export default router;
