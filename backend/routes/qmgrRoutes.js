// routes/qmgrRoutes.js
// All IBM MQ queue-manager proxy routes.
//
//   GET /api/qmgr              – list all queue managers
//   GET /api/qmgr/:name        – queue manager status (DISPLAY QMSTATUS)
//   GET /api/qmgr/:name/lstr   – listener status   (DISPLAY LSSTATUS)
//   GET /api/qmgr/:name/chl    – channel status    (DISPLAY CHSTATUS)
//   GET /api/qmgr/:name/queues – queue details      (REST queue API)
//   GET /api/qmgr/:name/disp   – queue manager props (DISPLAY QMGR)

import { Router } from 'express';
import { config, MQ_FILTER, QUEUE_FILTER, MQSC_COMMANDS, getQueueManagerBaseUrl } from '../config.js';
import { requireAuth } from '../utils/auth.js';
import { parseMqscResponse, extractQueueDetails } from '../utils/mqParser.js';

const router = Router();

// All qmgr routes require Basic Auth — apply once at the router level
router.use(requireAuth);

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Standard headers for MQSC action (POST) calls */
const mqscHeaders = (basicAuth) => ({
  Authorization: `Basic ${basicAuth}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'ibm-mq-rest-csrf-token': 'value',
});

/** Standard headers for REST GET calls */
const mqRestHeaders = (basicAuth) => ({
  Authorization: `Basic ${basicAuth}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

/**
 * POSTs a single MQSC command to the MQ REST action endpoint and returns the
 * parsed response, or surfaces upstream errors in a consistent shape.
 */
async function runMqscCommand(res, baseUrl, qmgrName, basicAuth, command) {
  const payload = { type: 'runCommand', parameters: { command } };

  const upstream = await fetch(
    `${baseUrl}/ibmmq/rest/v1/admin/action/qmgr/${qmgrName}/mqsc`,
    { method: 'POST', headers: mqscHeaders(basicAuth), body: JSON.stringify(payload) }
  );

  const bodyText = await upstream.text();

  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error: 'Upstream API returned an error',
      upstreamStatus: upstream.status,
      upstreamBody: bodyText,
    });
  }

  try {
    return res.json(parseMqscResponse(JSON.parse(bodyText)));
  } catch {
    return res.status(500).json({
      error: 'Upstream response was not valid JSON',
      upstreamBody: bodyText,
    });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/qmgr
 * Lists all queue managers from every configured server, filtered by MQ_FILTER.
 */
router.get('/', async (req, res) => {
  try {
    const { basicAuth } = req;
    const allQmgrs = [];
    const errors = [];

    for (const manager of config.queueManagers) {
      try {
        const upstream = await fetch(`${manager.baseUrl}/ibmmq/rest/v1/admin/qmgr`, {
          method: 'GET',
          headers: mqRestHeaders(basicAuth),
        });

        const bodyText = await upstream.text();

        if (!upstream.ok) {
          errors.push({ server: manager.baseUrl, status: upstream.status, error: bodyText });
          continue;
        }

        try {
          const data = JSON.parse(bodyText);
          if (data.qmgr && Array.isArray(data.qmgr)) {
            const filtered = data.qmgr.filter((q) =>
              String(q.name || '').toUpperCase().includes(MQ_FILTER.toUpperCase())
            );
            allQmgrs.push(...filtered);
          }
        } catch {
          errors.push({ server: manager.baseUrl, error: 'Invalid JSON response' });
        }
      } catch (fetchError) {
        errors.push({ server: manager.baseUrl, error: fetchError.message });
      }
    }

    if (allQmgrs.length === 0) {
      return res.status(500).json({
        error: 'No queue managers found from any configured server',
        details: errors,
      });
    }

    return res.json({
      qmgr: allQmgrs,
      partialErrors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', message: error.message, cause: error.cause });
  }
});

/**
 * GET /api/qmgr/:name
 * Returns queue manager status via DISPLAY QMSTATUS ALL.
 */
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const baseUrl = getQueueManagerBaseUrl(name);
    return await runMqscCommand(res, baseUrl, name, req.basicAuth, MQSC_COMMANDS.status);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', message: error.message, cause: error.cause });
  }
});

/**
 * GET /api/qmgr/:name/lstr
 * Returns listener status via DISPLAY LSSTATUS(*) ALL.
 */
router.get('/:name/lstr', async (req, res) => {
  try {
    const { name } = req.params;
    const baseUrl = getQueueManagerBaseUrl(name);
    return await runMqscCommand(res, baseUrl, name, req.basicAuth, MQSC_COMMANDS.listener);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', message: error.message, cause: error.cause });
  }
});

/**
 * GET /api/qmgr/:name/chl
 * Returns channel status via DISPLAY CHSTATUS(*) WHERE(CHLTYPE NE SVRCONN).
 */
router.get('/:name/chl', async (req, res) => {
  try {
    const { name } = req.params;
    const baseUrl = getQueueManagerBaseUrl(name);
    return await runMqscCommand(res, baseUrl, name, req.basicAuth, MQSC_COMMANDS.channel);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', message: error.message, cause: error.cause });
  }
});

/**
 * GET /api/qmgr/:name/queues
 * Returns normalised queue details (depth, status, timestamps) via the MQ REST queue API.
 */
router.get('/:name/queues', async (req, res) => {
  try {
    const { name } = req.params;
    const baseUrl = getQueueManagerBaseUrl(name);

    const upstream = await fetch(
      `${baseUrl}/ibmmq/rest/v1/admin/qmgr/${name}/queue` +
        `?attributes=storage,general&status=*&filter=${encodeURIComponent(QUEUE_FILTER)}`,
      { method: 'GET', headers: { ...mqRestHeaders(req.basicAuth), 'ibm-mq-rest-csrf-token': 'value' } }
    );

    const bodyText = await upstream.text();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'Upstream API returned an error',
        upstreamStatus: upstream.status,
        upstreamBody: bodyText,
      });
    }

    try {
      return res.json(extractQueueDetails(JSON.parse(bodyText)));
    } catch (parseError) {
      return res.status(500).json({ error: parseError.message || 'Upstream response was not valid JSON', upstreamBody: bodyText });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', message: error.message, cause: error.cause });
  }
});

/**
 * GET /api/qmgr/:name/disp
 * Returns queue manager properties via DISPLAY QMGR ALL.
 */
router.get('/:name/disp', async (req, res) => {
  try {
    const { name } = req.params;
    const baseUrl = getQueueManagerBaseUrl(name);
    return await runMqscCommand(res, baseUrl, name, req.basicAuth, MQSC_COMMANDS.displayQmgr);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', message: error.message, cause: error.cause });
  }
});

export default router;
