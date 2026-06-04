// backend/utils/mqParser.js
// Pure functions that transform raw IBM MQ REST API responses into clean objects.

/**
 * Parses the `commandResponse` array returned by the MQ MQSC REST action endpoint.
 * Each text line is parsed for KEY(VALUE) pairs.
 *
 * @param   {object}   data - Raw JSON from the MQ REST API
 * @returns {object[]}      - Array of flat key/value objects
 */
export function parseMqscResponse(data) {
  return (data.commandResponse || []).map((item) => {
    const textLine = item.text?.[0] ?? "";  // guard against missing text
    if (!textLine) return {};

    const obj   = {};
    const regex = /(\w+)\(((?:[^()]|\([^()]*\))*)\)/g;
    let match;

    while ((match = regex.exec(textLine)) !== null) {
      obj[match[1]] = match[2];
    }

    return obj;
  });
}

// ─── Internal formatters ──────────────────────────────────────────────────────

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toISOString().slice(0, 19).replace("T", " ");
}

function formatDuration(seconds) {
  if (seconds == null || seconds < 0) return "";

  seconds = Math.floor(Number(seconds));

  const days    = Math.floor(seconds / 86400); seconds %= 86400;
  const hours   = Math.floor(seconds / 3600);  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);    seconds %= 60;

  const parts = [];
  if (days    > 0) parts.push(`${days} day${days       !== 1 ? "s" : ""}`);
  if (hours   > 0) parts.push(`${hours} hour${hours     !== 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (seconds > 0 || parts.length === 0)
    parts.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);

  return parts.join(" ");
}

/**
 * Helper function to convert an MQ wildcard pattern (e.g., "ORDERS.*") 
 * into a valid JavaScript RegExp object.
 */
function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
  return new RegExp(regexStr, 'i');
}

/**
 * Extracts IBM MQ queue properties from a raw payload object.
 * Categorizes and returns both included queues and excluded/ignored queues.
 * * @param {Object} payload - Raw nested payload containing the queue definitions array.
 * @param {Array<string>} [exclusionConfig=[]] - Array of exact names or patterns to exclude.
 * @returns {{ queues: Array<Object>, excludedQueues: Array<Object> }} Parent object containing both lists.
 */
export function extractQueueDetails(payload, exclusionConfig = []) {
  const firstChildArray = Object.values(payload || {})[0];

  if (!Array.isArray(firstChildArray)) {
    throw new Error("Payload must contain an array as its first child property.");
  }

  // Pre-compile the configuration strings/wildcards into RegExp objects
  const exclusionRegexes = (exclusionConfig || []).map(pattern => patternToRegExp(pattern));

  // Initialize both destination arrays
  const queues = [];
  const excludedQueues = [];

  firstChildArray.forEach((q) => {
    const queueName = q.name || "";

    // 1. Determine if the queue should be excluded
    // const isSystemQueue = queueName.startsWith("SYSTEM") || queueName.startsWith("AMQ");
    const isExcludedByConfig = exclusionRegexes.some((regex) => regex.test(queueName));

    // 2. Map the data out into our clean structure
    const formattedQueue = {
      name:                 q.name,
      currentDepth:         q.status?.currentDepth         ?? 0,
      lastGet:              formatDateTime(q.status?.lastGet),
      lastPut:              formatDateTime(q.status?.lastPut),
      oldestMessageAge:     formatDuration(q.status?.oldestMessageAge),
      openInputCount:       q.status?.openInputCount        ?? 0,
      maximumDepth:         q.storage?.maximumDepth         ?? 0,
      uncommittedMessages:  q.status?.uncommittedMessages   ?? 0,
      maximumMessageLength: q.storage?.maximumMessageLength ?? 0,
      queueCapacityPercent: q.storage?.maximumDepth
        ? Number(
            (((q.status?.currentDepth ?? 0) / q.storage.maximumDepth) * 100).toFixed(2)
          )
        : 0,
    };

    // 3. Route to the appropriate array based on its exclusion status
    // if (isSystemQueue || isExcludedByConfig) {
     if (isExcludedByConfig) {
      // Add extra context if you want to know *why* it was excluded down the road
      excludedQueues.push({
        ...formattedQueue,
        // exclusionReason: isSystemQueue ? "System Queue (SYSTEM/AMQ)" : "Matched Configuration Pattern"
         exclusionReason: "Matched Configuration Pattern"
      });
    } else {
      queues.push(formattedQueue);
    }
  });

  // Return the parent wrapper containing both lists
  return {
    queues,
    excludedQueues
  };
}