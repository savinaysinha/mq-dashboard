// backend/routes/qmgrRoutes.js
// All IBM MQ queue-manager proxy routes.
//
//   GET /api/qmgr              – list all queue managers
//   GET /api/qmgr/:name        – queue manager status (DISPLAY QMSTATUS)
//   GET /api/qmgr/:name/lstr   – listener status     (DISPLAY LSSTATUS)
//   GET /api/qmgr/:name/chl    – channel status       (DISPLAY CHSTATUS)
//   GET /api/qmgr/:name/queues – queue details        (REST queue API)
//   GET /api/qmgr/:name/disp   – queue manager props  (DISPLAY QMGR)

import { Router } from 'express';
import {
  config,
  MQ_FILTER,
  QUEUE_FILTER,
  MQSC_COMMANDS,
  getQueueManagerBaseUrl,
} from '../config.js';
import { requireAuth } from '../utils/auth.js';
import { parseMqscResponse, extractQueueDetails } from '../utils/mqParser.js';

const router = Router();

// All qmgr routes require Basic Auth — applied once at router level
router.use(requireAuth);

// ─── Fetch timeout ────────────────────────────────────────────────────────────
const UPSTREAM_TIMEOUT_MS = 10_000; // 10 seconds

function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
}

// ─── Shared header builders ───────────────────────────────────────────────────

const mqscHeaders = (basicAuth) => ({
  Authorization:          `Basic ${basicAuth}`,
  'Content-Type':         'application/json',
  Accept:                 'application/json',
  'ibm-mq-rest-csrf-token': 'value',
});

const mqRestHeaders = (basicAuth) => ({
  Authorization:  `Basic ${basicAuth}`,
  'Content-Type': 'application/json',
  Accept:         'application/json',
});

// ─── Shared MQSC command runner ───────────────────────────────────────────────

async function runMqscCommand(res, baseUrl, qmgrName, basicAuth, command) {
  const payload  = { type: 'runCommand', parameters: { command } };
  const upstream = await fetchWithTimeout(
    `${baseUrl}/ibmmq/rest/v1/admin/action/qmgr/${qmgrName}/mqsc`,
    { method: 'POST', headers: mqscHeaders(basicAuth), body: JSON.stringify(payload) }
  );

  const bodyText = await upstream.text();

  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error:          'Upstream API returned an error',
      upstreamStatus: upstream.status,
      upstreamBody:   bodyText,
    });
  }

  try {
    return res.json(parseMqscResponse(JSON.parse(bodyText)));
  } catch {
    return res.status(500).json({
      error:        'Upstream response was not valid JSON',
      upstreamBody: bodyText,
    });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/qmgr
 * Lists all queue managers from every configured server in parallel,
 * filtered by MQ_FILTER. Partial failures are surfaced as partialErrors.
 */
router.get('/', async (req, res) => {
  try {
    const { basicAuth } = req;

    // Fix #7 — fetch all configured servers in parallel instead of sequentially
    const results = await Promise.allSettled(
      config.queueManagers.map(async (manager) => {
        const upstream = await fetchWithTimeout(
          `${manager.baseUrl}/ibmmq/rest/v1/admin/qmgr`,
          { method: 'GET', headers: mqRestHeaders(basicAuth) }
        );

        const bodyText = await upstream.text();

        if (!upstream.ok) {
          throw Object.assign(
            new Error(`HTTP ${upstream.status}`),
            { server: manager.baseUrl, upstreamBody: bodyText }
          );
        }

        const data = JSON.parse(bodyText);
        const qmgrs = Array.isArray(data.qmgr) ? data.qmgr : [];
        return qmgrs.filter((q) =>
          String(q.name || '').toUpperCase().includes(MQ_FILTER.toUpperCase())
        );
      })
    );

    const allQmgrs = [];
    const errors   = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        allQmgrs.push(...result.value);
      } else {
        errors.push({
          server: config.queueManagers[i].baseUrl,
          error:  result.reason?.message || 'Unknown error',
        });
      }
    });

    if (allQmgrs.length === 0) {
      return res.status(500).json({
        error:   'No queue managers found from any configured server',
        details: errors,
      });
    }

    return res.json({
      qmgr:          allQmgrs,
      partialErrors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return res.status(500).json({
      error:   'Proxy request failed',
      message: error.message,
      cause:   error.cause,
    });
  }
});

/**
 * GET /api/qmgr/:name
 * Returns queue manager status via DISPLAY QMSTATUS ALL.
 */
router.get('/:name', async (req, res) => {
  try {
    const baseUrl = getQueueManagerBaseUrl(req.params.name);
    return await runMqscCommand(res, baseUrl, req.params.name, req.basicAuth, MQSC_COMMANDS.status);
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
    const baseUrl = getQueueManagerBaseUrl(req.params.name);
    return await runMqscCommand(res, baseUrl, req.params.name, req.basicAuth, MQSC_COMMANDS.listener);
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
    const baseUrl = getQueueManagerBaseUrl(req.params.name);
    return await runMqscCommand(res, baseUrl, req.params.name, req.basicAuth, MQSC_COMMANDS.channel);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', message: error.message, cause: error.cause });
  }
});

/**
 * GET /api/qmgr/:name/queues
 * Returns normalised queue details via the MQ REST queue API.
 */
router.get('/:name/queues', async (req, res) => {
  try {
    const { name } = req.params;
    const baseUrl  = getQueueManagerBaseUrl(name);

    const upstream = await fetchWithTimeout(
      `${baseUrl}/ibmmq/rest/v1/admin/qmgr/${name}/queue` +
        `?attributes=storage,general&status=*&filter=${encodeURIComponent(QUEUE_FILTER)}`,
      {
        method:  'GET',
        headers: { ...mqRestHeaders(req.basicAuth), 'ibm-mq-rest-csrf-token': 'value' },
      }
    );

    const bodyText = await upstream.text();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error:          'Upstream API returned an error',
        upstreamStatus: upstream.status,
        upstreamBody:   bodyText,
      });
    }

    try {
      return res.json(extractQueueDetails(JSON.parse(bodyText)));
    } catch (parseError) {
      return res.status(500).json({
        error:        parseError.message || 'Failed to parse queue details',
        upstreamBody: bodyText,
      });
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
    const baseUrl = getQueueManagerBaseUrl(req.params.name);
    return await runMqscCommand(res, baseUrl, req.params.name, req.basicAuth, MQSC_COMMANDS.displayQmgr);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', message: error.message, cause: error.cause });
  }
});

export default router;
