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

export function getBannerClass(item) {
  const normalize = (value) => String(value || "").trim().toLowerCase();
  const status = normalize(item.queueManager?.status);
  const commandServer = normalize(item.queueManager?.commandServer);
  const listener = normalize(item.queueManager?.listener);

  const redIssue =
    status !== "running" ||
    commandServer !== "running" ||
    (item.channels?.stopped?.length ?? 0) > 0 ||
    (item.channels?.retrying?.length ?? 0) > 0;

  const warningIssue =
    !redIssue && (listener !== "running" || (item.abnormalQueues?.length ?? 0) > 0);

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

// ─── Queue enrichment ─────────────────────────────────────────────────────────
/**
 * Enriches a flat array of queue objects with a computed `status` and
 * `statusPriority` field, then sorts the result so the most critical queues
 * appear first.
 *
 * ─── Status classification rules (evaluated in order) ───────────────────────
 *
 *  "Critical"  — any ONE of the following is true:
 *  1. Queue is more than 75 % full.
 *   
 *    • queueCapacityPercent > 75
 * 
 *  2. No consumer is listening on the queue AND Queue has any queueCapacityPercent.
 *   
 *    • queueCapacityPercent > 0 AND openInputCount === 0
 * 
 *  3. Consumer is listening on the queue AND the gap between lastPut and lastGet > 60 min
 * 
 *    • openInputCount > 0 AND diffMinutes > 60 min AND uncommittedMessages > 0
 * 
 *  "Warning"   — none of the Critical conditions apply, but any ONE of:
 *  1. Queue is more than 50 % full.
 * 
 *    • queueCapacityPercent > 50
 * 
 * 2.  Consumer is listening on the queue AND the gap between lastPut and lastGet > 60 min AND A message has been sitting for over 30 min.
 * 
 *    •  diffMinutes > 30 min AND oldestMessageAge > 3600*8 (8 hours)
 *
 *  "Processing" — none of the above conditions apply; queue is healthy.
 *
 * ─── Sort order ─────────────────────────────────────────────────────────────
 *
 *  statusPriority values:  Critical = 0  |  Warning = 1  |  Processing = 2
 *  The returned array is sorted ascending by statusPriority so Critical queues
 *  always surface at the top of the dashboard table.
 */ 

export function addQueueStatus(data) {
  return (data || [])
    .map((item) => {
      const openInputCount       = Number(item.openInputCount ?? 0);
      const queueCapacityPercent = Number(item.queueCapacityPercent ?? 0);
      const oldestSeconds        = durationToSeconds(item.oldestMessageAge);
      const lastGetDate          = parseDate(item.lastGet);
      const lastPutDate          = parseDate(item.lastPut);
      const diffMinutes =
        lastGetDate && lastPutDate ? Math.abs(lastPutDate - lastGetDate) / 60000 : null;
      const uncommittedMessages = Number(item.uncommittedMessages ?? 0);
      let status = "Processing";

      if (
        queueCapacityPercent > 75
      ) {
        status = "Critical";
      }else if (
        queueCapacityPercent > 0 &&
        openInputCount === 0
      ) {
        status = "Critical";
      }else if (
        openInputCount === 0 && 
       (diffMinutes !== null && diffMinutes > 60) &&
        uncommittedMessages > 0
      ) {
        status = "Critical";
      }else if (
        queueCapacityPercent > 50
      ) {
        status = "Warning";
      }
      else if (
        oldestSeconds > 3600*8 ||
        (openInputCount !== 0 && diffMinutes !== null && diffMinutes > 30)
      ) {
        status = "Warning";
      }

      return {
        ...item,
        status,
        statusPriority: status === "Critical" ? 0 : status === "Warning" ? 1 : 2,
      };
    })
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
