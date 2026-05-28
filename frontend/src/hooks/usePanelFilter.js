// hooks/usePanelFilter.js
// Single unified hook that manages ALL summary panel state.
//
// Only ONE panel can be open at a time across both rows (infra + queue status).
// Clicking any button while another panel is open closes the old one first,
// then opens the new one. Clicking the same button twice closes it.
//
// Panel keys:
//   Infrastructure row : "managers" | "running" | "retrying" | "stopped"
//   Queue status row   : "Critical" | "Warning"  | "Processing"

import { useMemo, useState } from "react";
import { addQueueStatus, buildChannelItem } from "../utils/mqHelpers";

/**
 * @typedef {"managers"|"running"|"retrying"|"stopped"|"Critical"|"Warning"|"Processing"|null} PanelKey
 */

/**
 * @param {object[]} mqData - Array of queue manager objects from useMqData
 */
export function usePanelFilter(mqData) {
  /** The currently open panel. null means all panels are closed. */
  const [activePanel, setActivePanel] = useState(null);

  /**
   * Toggles a panel open or closed.
   * If a DIFFERENT panel is already open it closes first, then the new one opens.
   * If the SAME panel is clicked again it just closes.
   *
   * @param {PanelKey} panelKey
   */
  function openPanel(panelKey) {
    setActivePanel((prev) => (prev === panelKey ? null : panelKey));
  }

  /** Closes whatever panel is currently open. */
  function closePanel() {
    setActivePanel(null);
  }

  // ── Derived data ────────────────────────────────────────────────────────

  /** Full manager snapshot list */
  const allManagers = useMemo(
    () =>
      mqData.map((m) => ({
        name:              m.name,
        region:            m.region,
        environment:       m.environment,
        status:            m.queueManager?.status            ?? "",
        listener:          m.queueManager?.listener          ?? "",
        commandServer:     m.queueManager?.commandServer     ?? "",
        activeConnections: m.queueManager?.activeConnections ?? 0,
        mqVersion:         m.queueManager?.mqVersion         ?? "",
        startDate:         m.queueManager?.startDate         ?? "",
        abnormalQueues:    m.abnormalQueues?.length           ?? 0,
        runningChannels:   m.channels?.running?.length        ?? 0,
        retryingChannels:  m.channels?.retrying?.length       ?? 0,
        stoppedChannels:   m.channels?.stopped?.length        ?? 0,
      })),
    [mqData]
  );

  /** Flat channel lists tagged with manager metadata */
  const runningChannels = useMemo(
    () =>
      mqData.flatMap((m) =>
        (m.channels?.running ?? []).map((ch) => ({
          ...ch,
          managerName: m.name,
          region:      m.region,
          environment: m.environment,
        }))
      ),
    [mqData]
  );

  const retryingChannels = useMemo(
    () =>
      mqData.flatMap((m) =>
        (m.channels?.retrying ?? []).map((ch) => ({
          ...ch,
          managerName: m.name,
          region:      m.region,
          environment: m.environment,
        }))
      ),
    [mqData]
  );

  const stoppedChannels = useMemo(
    () =>
      mqData.flatMap((m) =>
        (m.channels?.stopped ?? []).map((ch) => ({
          ...ch,
          managerName: m.name,
          region:      m.region,
          environment: m.environment,
        }))
      ),
    [mqData]
  );

  /** Flat queue list across all managers, tagged with manager metadata */
  const allQueues = useMemo(
    () =>
      mqData.flatMap((m) =>
        (m.allQueues ?? []).map((q) => ({
          ...q,
          managerName: m.name,
          region:      m.region,
          environment: m.environment,
        }))
      ),
    [mqData]
  );

  /** Per-status queue counts for the filter button badges */
  const queueCounts = useMemo(
    () =>
      allQueues.reduce(
        (acc, q) => {
          if (q.status === "Critical")   acc.Critical   += 1;
          if (q.status === "Warning")    acc.Warning    += 1;
          if (q.status === "Processing") acc.Processing += 1;
          return acc;
        },
        { Critical: 0, Warning: 0, Processing: 0 }
      ),
    [allQueues]
  );

  /** Queues filtered by the active queue-status panel key */
  const filteredQueues = useMemo(() => {
    const QUEUE_STATUSES = new Set(["Critical", "Warning", "Processing"]);
    if (!activePanel || !QUEUE_STATUSES.has(activePanel)) return [];
    return allQueues
      .filter((q) => q.status === activePanel)
      .sort((a, b) => a.managerName.localeCompare(b.managerName));
  }, [allQueues, activePanel]);

  /** Which channel status (if any) is the active panel showing */
  const activeChannelStatus = ["running", "retrying", "stopped"].includes(activePanel)
    ? activePanel
    : null;

  /** Map from channel panel key → flat channel list */
  const channelData = { running: runningChannels, retrying: retryingChannels, stopped: stoppedChannels };

  return {
    // State
    activePanel,
    openPanel,
    closePanel,
    // Infra data
    allManagers,
    runningChannels,
    retryingChannels,
    stoppedChannels,
    activeChannelStatus,
    channelData,
    // Queue filter data
    queueCounts,
    filteredQueues,
  };
}
