// utils/mqHelpers.js
// Pure helper functions for transforming and classifying MQ data.
// NOTE: parseMqscResponse and extractQueueDetails have been removed —
// those are backend-only concerns handled in backend/utils/mqParser.js.

// ─── Status / banner classification ──────────────────────────────────────────

export function statusClass(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "running" || normalized === "processing") return "good";
  if (normalized === "critical" || normalized === "stopped" || normalized === "not running") return "bad";
  return "warn";
}

/**
 * Determines the banner class for a queue manager item based on its health status.
 * 
 * Returns:
 *   - "issue"     : Critical problems detected (red banner)
 *   - "warning"   : Non-critical issues detected (yellow/orange banner)
 *   - "healthy"   : No issues detected (green banner)
 * 
 * @param {Object} item - The queue manager item containing status, channels, and queues info
 * @returns {string} The banner class: "issue", "warning", or "healthy"
 */
export function getBannerClass(item) {
  // Normalize strings for case-insensitive comparison
  const normalize = (value) => String(value || "").trim().toLowerCase();
  
  // Extract and normalize key status fields from the queue manager
  const status = normalize(item.queueManager?.status);
  // const commandServer = normalize(item.queueManager?.commandServer); // Currently disabled
  const listener = normalize(item.queueManager?.listener);


  // Check for critical issues that warrant a red "issue" banner:
  // - Queue manager status is not "running"
  // - Listener is not "running"
  // - Any channels are in retrying state
  // - 10 or more abnormal queues
  const redIssue =
    status !== "running" ||
    // commandServer !== "running"  ||  // Currently disabled
    (item.channels?.retrying?.length ?? 0) > 0 ||
    listener !== "running" || 
    (item.abnormalQueues?.length ?? 0) >= 10;


  // Check for non-critical issues that warrant a "warning" banner:
  // - Only evaluated if no redIssue is present
  // - Any channels are in stopped state
  // - At least 1 abnormal queue (but less than 10, otherwise redIssue triggers)
  const warningIssue =
    !redIssue && (
      (item.channels?.stopped?.length ?? 0) > 0 || 
      (item.abnormalQueues?.length ?? 0) > 0
    );


  // Return the appropriate banner class based on issue severity
  return redIssue ? "issue" : warningIssue ? "warning" : "healthy";
}

// ─── Region / environment derivation ─────────────────────────────────────────

export function getRegionAndEnvironmentDetails(name) {
  let region = "EMEA Region";
  let environment = "Production Environment";

  if (name.includes("AMER")) region = "AMER Region";
  else if (name.includes("AFRI")) region = "AFRI Region";
  else if (name.includes("APAC")) region = "APAC Region";

  if (name.includes("Q1")) environment = "QA Environment";
  else if (name.includes("T1")) environment = "Test Environment";
  else if (name.includes("S1")) environment = "SNB Environment";

  return { region, environment };
}

// ─── Duration / date helpers ──────────────────────────────────────────────────

export function durationToSeconds(text) {
  if (!text) return 0;
  let total = 0;
  const dayMatch    = text.match(/(\d+)\s*day/);
  const hourMatch   = text.match(/(\d+)\s*hour/);
  const minuteMatch = text.match(/(\d+)\s*minute/);
  const secondMatch = text.match(/(\d+)\s*second/);

  if (dayMatch)    total += Number(dayMatch[1])    * 86400;
  if (hourMatch)   total += Number(hourMatch[1])   * 3600;
  if (minuteMatch) total += Number(minuteMatch[1]) * 60;
  if (secondMatch) total += Number(secondMatch[1]);

  return total;
}

export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Processes a list of IBM MQ queue metric objects, evaluates their operational health,
 * assigns an alert status (Critical, Warning, Processing) with descriptive rationales, 
 * and sorts them by priority.
 * * @param {Array<Object>} data - Raw queue metrics from the Queue Manager monitoring agent.
 * @returns {Array<Object>} Sorted list of queue items with injected `status`, `statusDescription`, and `statusPriority`.
 */
export function addQueueStatus(data) {
  // Capture current system execution time to calculate real-time processing latency
  const NOW = new Date();

  return (data || [])
    .map((item) => {
      // 1. Sanitize and normalize raw inputs with default fallbacks
      const currentDepth         = Number(item.currentDepth ?? 0);
      const openInputCount       = Number(item.openInputCount ?? 0);
      const openOutputCount      = Number(item.openOutputCount ?? 0); 
      const queueCapacityPercent = Number(item.queueCapacityPercent ?? 0);
      const oldestSeconds        = durationToSeconds(item.oldestMessageAge);
      const lastGetDate          = parseDate(item.lastGet);
      const lastPutDate          = parseDate(item.lastPut);
      const uncommittedMessages  = Number(item.uncommittedMessages ?? 0);

      // 2. Compute absolute metric deltas (Minutes elapsed since the last successful GET)
      const minutesSinceLastGet = lastGetDate ? (NOW - lastGetDate) / 60000 : null;

      // Default fallback values
      let status = "Processing";
      let substatus = "Healthy";
      let statusDescription = "Queue is operating normally within safe parameters.";

      // =========================================================================
      // LEVEL 1: CRITICAL CONDITIONS (Requires immediate intervention)
      // =========================================================================

      // CASE A: Bad disconnect / Orphaned In-Doubt Transaction (Uncommitted GET scenario)
      if (uncommittedMessages > 0 && openInputCount === 0) {
        status = "Critical";
        substatus = "Critical Transactional State";
        statusDescription = `There are ${uncommittedMessages} uncommitted messages (likely from an uncommitted GET), but the application disconnected improperly leaving 0 active consumers. Messages are locked in an in-doubt transaction.`;
      }
      
      // Case B: Queue is filling past danger thresholds (Risk of MQRC_Q_FULL)
      if (queueCapacityPercent >= 85) {
        status = "Critical"; 
        substatus = "At Risk";
        statusDescription = `Queue capacity is critically high at ${queueCapacityPercent}%. Upstream applications risk MQRC_Q_FULL errors.`;
      } 
      // Case C: Orphaned Backlog. Messages are actively waiting, but zero consumer applications are connected.
      else if (currentDepth > 0 && openInputCount === 0) {
        status = "Critical"; 
        substatus = "Orphaned Backlog";
        statusDescription = `${currentDepth} messages are waiting on the queue, but there are zero active consumers (Input Count = 0).`;
      } 
      // Case D: Stalled Consumer. Consumers are connected, but haven't successfully processed data in >10 mins.
      else if (currentDepth > 0 && minutesSinceLastGet !== null && minutesSinceLastGet > 10) {
        status = "Critical"; 
        substatus = "Stalled Consumer";
        statusDescription = `${currentDepth} messages are backed up. Consumers are connected, but the last successful message read (GET) was ${Math.round(minutesSinceLastGet)} minutes ago.`;
      }

      // =========================================================================
      // LEVEL 2: WARNING CONDITIONS (Performance degradations & bottlenecks)
      // =========================================================================
      
      // Case A: Transactional Lock. In-flight syncpoint transactions are lingering for over 2 minutes.
      else if (currentDepth > 0 && uncommittedMessages > 0 && minutesSinceLastGet !== null && minutesSinceLastGet > 2) {
        status = "Warning";  
        substatus = "Transactional Lock";
        statusDescription = `There are ${uncommittedMessages} uncommitted messages locked in an active transaction for over ${Math.round(minutesSinceLastGet)} minutes.`;
      }
      // Case B: Influx Bottleneck. Queue depth has exceeded safe capacities (50%+).
      else if (queueCapacityPercent >= 50) {
        status = "Warning";  
        substatus = "Influx Bottleneck";
        statusDescription = `Queue capacity has risen to ${queueCapacityPercent}%. Inbound messages may be out-pacing consumer drain rate.`;
      }
      // Case C: Degraded Performance. Consumers are active but slow, letting messages linger past 2 minutes.
      else if (currentDepth > 0 && minutesSinceLastGet !== null && minutesSinceLastGet > 2) {
        status = "Warning";  
        substatus = "Degraded Performance";
        statusDescription = `The queue has a depth of ${currentDepth} and processing has slowed. The last message read (GET) was ${Math.round(minutesSinceLastGet)} minutes ago.`;
      }

      // =========================================================================
      // LEVEL 3: PROCESSING / HEALTHY CONDITIONS (Nominal system states)
      // =========================================================================
      else {
        status = "Processing"; 
        substatus = "Healthy";
        if (currentDepth === 0) {
          statusDescription = openInputCount > 0 
            ? "Queue is idle and empty. Consumers are connected and waiting for work." 
            : "Queue is passive and empty. No active applications are connected.";
        } else {
          statusDescription = `Data flowing smoothly. Queue depth is ${currentDepth} with healthy consumer processing times.`;
        }
      }

      // Append calculated values to the object mapping
      return {
        ...item,
        status,
        substatus,
        statusDescription,
        // Priority weight allocation: Critical (0) > Warning (1) > Processing (2)
        statusPriority: status === "Critical" ? 0 : status === "Warning" ? 1 : 2,
      };
    })
    // Sort array in ascending order based on status priority (Critical items bubble up first)
    .sort((a, b) => a.statusPriority - b.statusPriority);
}

// ─── Channel helpers ──────────────────────────────────────────────────────────

export function buildChannelItem(item) {
  return {
    ...item,
    name:   item.CHANNEL || item.name   || "",
    status: item.STATUS  || item.status || "",
    type:   item.CHLTYPE || item.type   || "",
  };
}

export const isChannelDetailField = (key) =>
  !["name", "CHANNEL", "CHLTYPE", "STATUS", "status", "type"].includes(key);

// ─── Default manager shape ────────────────────────────────────────────────────

export function buildDefaultManager(item) {
  return {
    name:          item.name,
    region:        item.region,
    environment:   item.environment,
    queueManager:  item.queueManager,
    abnormalQueues: item.abnormalQueues,
    channels:      item.channels,
  };
}
