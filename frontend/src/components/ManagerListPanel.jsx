// components/ManagerListPanel.jsx
// Slide-in panel listing all queue managers with their key status metrics.

import { statusClass } from "../utils/mqHelpers";

/**
 * Props:
 *   managers {object[]} - From useSummaryFilter.allManagers
 *   onClose  {Function}
 */
export default function ManagerListPanel({ managers, onClose }) {
  if (!managers) return null;

  const healthyCount  = managers.filter((m) => m.status?.toLowerCase() === "running").length;
  const problemCount  = managers.length - healthyCount;

  return (
    <section className="summary-panel summary-panel--managers" aria-live="polite">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sp-header">
        <div className="sp-title">
          <span className="sp-icon">🖥️</span>
          <div>
            <h2>All Queue Managers</h2>
            <p className="sp-description">
              {managers.length} manager{managers.length !== 1 ? "s" : ""} across all regions
              &nbsp;·&nbsp;
              <span className="sp-stat sp-stat--good">{healthyCount} running</span>
              {problemCount > 0 && (
                <>&nbsp;·&nbsp;<span className="sp-stat sp-stat--bad">{problemCount} with issues</span></>
              )}
            </p>
          </div>
          <span className="sp-count">{managers.length}</span>
        </div>
        <button type="button" className="sp-close" onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {managers.length === 0 && (
        <div className="sp-empty">No queue managers found.</div>
      )}

      {/* ── Manager table ─────────────────────────────────────────────── */}
      {managers.length > 0 && (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Queue Manager</th>
                <th>Region</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Listener</th>
                <th>Command Server</th>
                <th>Active Connections</th>
                <th>Abnormal Queues</th>
                <th>Running Ch.</th>
                <th>Retrying Ch.</th>
                <th>Stopped Ch.</th>
                <th>MQ Version</th>
                <th>Start Date</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.name} className="sp-row">
                  <td className="sp-name">{m.name}</td>
                  <td>{m.region}</td>
                  <td>{m.environment}</td>
                  <td>
                    <span className={`status ${statusClass(m.status)}`}>
                      {m.status || "-"}
                    </span>
                  </td>
                  <td>
                    <span className={`status ${statusClass(m.listener)}`}>
                      {m.listener || "-"}
                    </span>
                  </td>
                  <td>
                    <span className={`status ${statusClass(m.commandServer)}`}>
                      {m.commandServer || "-"}
                    </span>
                  </td>
                  <td className="sp-num">{m.activeConnections}</td>
                  <td className="sp-num">
                    {m.abnormalQueues > 0
                      ? <span className="sp-badge sp-badge--bad">{m.abnormalQueues}</span>
                      : <span className="sp-badge sp-badge--good">0</span>}
                  </td>
                  <td className="sp-num">
                    <span className="sp-badge sp-badge--good">{m.runningChannels}</span>
                  </td>
                  <td className="sp-num">
                    {m.retryingChannels > 0
                      ? <span className="sp-badge sp-badge--warn">{m.retryingChannels}</span>
                      : <span className="sp-badge sp-badge--good">0</span>}
                  </td>
                  <td className="sp-num">
                    {m.stoppedChannels > 0
                      ? <span className="sp-badge sp-badge--bad">{m.stoppedChannels}</span>
                      : <span className="sp-badge sp-badge--good">0</span>}
                  </td>
                  <td className="sp-muted">{m.mqVersion || "-"}</td>
                  <td className="sp-muted">{m.startDate || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
