// config.js
// Loads config.json once at startup and exports all shared constants.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')
);

export const PORT = config.server?.port || 3000;
export const MQ_FILTER = config.server?.mqFilter || "EPIS";
export const QUEUE_FILTER =
  config.server?.queueFilter || "status.currentDepth:greaterThan:1";

export const MQSC_COMMANDS = {
  status:      "DISPLAY QMSTATUS ALL",
  listener:    "DISPLAY LSSTATUS(*) ALL",
  channel:     "DISPLAY CHSTATUS(*) WHERE(CHLTYPE NE SVRCONN)",
  displayQmgr: "DISPLAY QMGR ALL",
};

/**
 * Resolves the base URL for a queue manager by name.
 * Falls back to the first configured manager if not found.
 */
export function getQueueManagerBaseUrl(qmgrName) {
  const manager = config.queueManagers.find(
    (m) => m.qmName.toLowerCase() === qmgrName.toLowerCase()
  );
  return manager ? manager.baseUrl : config.queueManagers[0].baseUrl;
}
