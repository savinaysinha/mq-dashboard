// components/QueueStatusPanel.jsx
// Slide-in panel that shows all queues of a given status across every manager.

/**
 * Props:
 *   activeFilter  {"Critical"|"Warning"|"Processing"|null}
 *   queues        {object[]}  - Flat filtered queue list from useQueueFilter
 *   onClose       {Function}  - Called when the user closes the panel
 */
export default function QueueStatusPanel({ activeFilter, queues, onClose }) {
  if (!activeFilter) return null;

  const STATUS_META = {
    Critical:   { colorClass: "status-critical",   icon: "🔴", description: "Queues that need immediate attention." },
    Warning:    { colorClass: "status-warning",    icon: "🟡", description: "Queues approaching thresholds — monitor closely." },
    Processing: { colorClass: "status-processing", icon: "🟢", description: "Queues that are healthy and processing normally." },
  };

  const meta = STATUS_META[activeFilter];

  // Group queues by manager name for clearer layout
  const grouped = queues.reduce((acc, q) => {
    if (!acc[q.managerName]) acc[q.managerName] = [];
    acc[q.managerName].push(q);
    return acc;
  }, {});

  return (
    <section className={`queue-status-panel queue-status-panel--${activeFilter.toLowerCase()}`} aria-live="polite">

      {/* ── Panel header ─────────────────────────────────────────────── */}
      <div className="qsp-header">
        <div className="qsp-title">
          <span className="qsp-icon">{meta.icon}</span>
          <div>
            <h2>{activeFilter} Queues</h2>
            <p className="qsp-description">{meta.description}</p>
          </div>
          <span className="qsp-count">{queues.length}</span>
        </div>
        <button
          type="button"
          className="qsp-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {queues.length === 0 && (
        <div className="qsp-empty">
          {meta.icon} No {activeFilter.toLowerCase()} queues found across any queue manager.
        </div>
      )}

      {/* ── Grouped tables ────────────────────────────────────────────── */}
      {Object.entries(grouped).map(([managerName, managerQueues]) => (
        <div key={managerName} className="qsp-group">
          <div className="qsp-group-header">
            <span className="qsp-group-name">{managerName}</span>
            <span className="qsp-group-env">{managerQueues[0]?.region} · {managerQueues[0]?.environment}</span>
            <span className="qsp-group-badge">{managerQueues.length} queue{managerQueues.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="qsp-table-wrap">
            <table className="qsp-table">
              <thead>
                <tr>
                  <th>Queue Name</th>
                  <th>Depth</th>
                  <th>Capacity %</th>
                  <th>Open Inputs</th>
                  <th>Oldest Message</th>
                  <th>Last Put</th>
                  <th>Last Get</th>
                  <th>Uncommitted</th>
                </tr>
              </thead>
              <tbody>
                {managerQueues.map((q) => (
                  <tr key={`${managerName}-${q.name}`} className={`qsp-row qsp-row--${activeFilter.toLowerCase()}`}>
                    <td className="qsp-queue-name" title={q.name}>{q.name}</td>
                    <td>{q.currentDepth ?? "-"}</td>
                    <td>
                      <div className="qsp-depth-bar-wrap">
                        <div
                          className={`qsp-depth-bar qsp-depth-bar--${activeFilter.toLowerCase()}`}
                          style={{ width: `${Math.min(q.queueCapacityPercent ?? 0, 100)}%` }}
                        />
                        <span>{q.queueCapacityPercent ?? 0}%</span>
                      </div>
                    </td>
                    <td>{q.openInputCount ?? "-"}</td>
                    <td>{q.oldestMessageAge || "-"}</td>
                    <td>{q.lastPut || "-"}</td>
                    <td>{q.lastGet || "-"}</td>
                    <td>{q.uncommittedMessages ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
