// utils/mqHelpers.js
// Pure helper functions for transforming and classifying MQ data.

export const initialData = [];

// ─── Status / banner classification ────────────────────────────────────────

export function statusClass(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "running" || normalized === "processing") return "good";
  if (normalized === "critical" || normalized === "stopped" || normalized === "not running") return "bad";
  return "warn";
}

export function getBannerClass(item) {
  const normalize = (value) => String(value || "").trim().toLowerCase();
  const status = normalize(item.queueManager.status);
  const commandServer = normalize(item.queueManager.commandServer);
  const listener = normalize(item.queueManager.listener);

  const redIssue =
    status !== "running" ||
    commandServer !== "running" ||
    item.channels.stopped.length > 0 ||
    item.channels.retrying.length > 0;

  const warningIssue = !redIssue && (listener !== "running" || item.abnormalQueues.length > 0);

  return redIssue ? "issue" : warningIssue ? "warning" : "healthy";
}

// ─── Region / environment derivation ────────────────────────────────────────

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

// ─── Duration / date helpers ─────────────────────────────────────────────────

export function durationToSeconds(text) {
  if (!text) return 0;
  let total = 0;
  const dayMatch = text.match(/(\d+)\s*day/);
  const hourMatch = text.match(/(\d+)\s*hour/);
  const minuteMatch = text.match(/(\d+)\s*minute/);
  const secondMatch = text.match(/(\d+)\s*second/);

  if (dayMatch) total += Number(dayMatch[1]) * 86400;
  if (hourMatch) total += Number(hourMatch[1]) * 3600;
  if (minuteMatch) total += Number(minuteMatch[1]) * 60;
  if (secondMatch) total += Number(secondMatch[1]);

  return total;
}

export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Queue enrichment ────────────────────────────────────────────────────────

export function addQueueStatus(data) {
  return (data || [])
    .map((item) => {
      const openInputCount = Number(item.openInputCount ?? 0);
      const queueCapacityPercent = Number(item.queueCapacityPercent ?? 0);
      const oldestSeconds = durationToSeconds(item.oldestMessageAge);
      const lastGetDate = parseDate(item.lastGet);
      const lastPutDate = parseDate(item.lastPut);
      const diffMinutes =
        lastGetDate && lastPutDate ? Math.abs(lastPutDate - lastGetDate) / 60000 : null;

      let status = "Processing";
      if (
        openInputCount === 0 ||
        queueCapacityPercent > 75 ||
        oldestSeconds > 3600 ||
        (openInputCount !== 0 && diffMinutes !== null && diffMinutes > 60)
      ) {
        status = "Critical";
      } else if (
        queueCapacityPercent > 50 ||
        oldestSeconds > 1800 ||
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

// ─── Channel helpers ─────────────────────────────────────────────────────────

export function buildChannelItem(item) {
  return {
    ...item,
    name: item.CHANNEL || item.name || "",
    status: item.STATUS || item.status || "",
    type: item.CHLTYPE || item.type || "",
  };
}

export const isChannelDetailField = (key) =>
  !["name", "CHANNEL", "CHLTYPE", "STATUS", "status", "type"].includes(key);

// ─── Payload parsers ─────────────────────────────────────────────────────────

export function extractQueueDetails(payload) {
  const firstChildArray = Object.values(payload || {})[0];
  if (!Array.isArray(firstChildArray)) return [];

  return firstChildArray
    .filter((q) => !q.name?.startsWith("SYSTEM"))
    .map((q) => ({
      name: q.name,
      currentDepth: q.status?.currentDepth ?? 0,
      lastGet: q.status?.lastGet
        ? new Date(q.status.lastGet).toISOString().slice(0, 19).replace("T", " ")
        : "",
      lastPut: q.status?.lastPut
        ? new Date(q.status.lastPut).toISOString().slice(0, 19).replace("T", " ")
        : "",
      oldestMessageAge: q.status?.oldestMessageAge
        ? `${q.status.oldestMessageAge} second`
        : "",
      openInputCount: q.status?.openInputCount ?? 0,
      maximumDepth: q.storage?.maximumDepth ?? 0,
      uncommittedMessages: q.status?.uncommittedMessages ?? 0,
      maximumMessageLength: q.storage?.maximumMessageLength ?? 0,
      queueCapacityPercent: q.storage?.maximumDepth
        ? Number(
            (((q.status?.currentDepth ?? 0) / q.storage.maximumDepth) * 100).toFixed(2)
          )
        : 0,
    }));
}

export function parseMqscResponse(data) {
  return data.commandResponse.map((item) => {
    const textLine = item.text[0] || "";
    const obj = {};
    const regex = /(\w+)\(([^)]*)\)/g;
    let match;
    while ((match = regex.exec(textLine)) !== null) {
      obj[match[1]] = match[2];
    }
    return obj;
  });
}

export function buildDefaultManager(item) {
  return {
    name: item.name,
    region: item.region,
    environment: item.environment,
    queueManager: item.queueManager,
    abnormalQueues: item.abnormalQueues,
    channels: item.channels,
  };
}
