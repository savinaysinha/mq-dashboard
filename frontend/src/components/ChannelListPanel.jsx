// components/ChannelListPanel.jsx
// Slide-in panel showing all channels of a given status (running / retrying / stopped)
// across every queue manager, grouped by manager.

/**
 * Props:
 *   channelStatus  {"running"|"retrying"|"stopped"}
 *   channels       {object[]}  - Flat channel list from useSummaryFilter
 *   onClose        {Function}
 */
export default function ChannelListPanel({ channelStatus, channels, onClose }) {
  if (!channelStatus) return null;

  const STATUS_META = {
    running:  { icon: "🟢", label: "Running Channels",  colorMod: "running",  description: "Channels that are currently active and healthy." },
    retrying: { icon: "🟡", label: "Retrying Channels", colorMod: "retrying", description: "Channels attempting to reconnect — may need investigation." },
    stopped:  { icon: "🔴", label: "Stopped Channels",  colorMod: "stopped",  description: "Channels that have stopped — require restart or investigation." },
  };

  const meta = STATUS_META[channelStatus];

  // Group by manager name
  const grouped = channels.reduce((acc, ch) => {
    if (!acc[ch.managerName]) acc[ch.managerName] = [];
    acc[ch.managerName].push(ch);
    return acc;
  }, {});

  // Detail fields to show per channel (exclude display-name fields)
  const SKIP_KEYS = new Set(["name", "CHANNEL", "STATUS", "status", "CHLTYPE", "type", "managerName", "region", "environment"]);
  const getDetailFields = (ch) =>
    Object.entries(ch).filter(([k]) => !SKIP_KEYS.has(k));

  return (
    <section className={`summary-panel summary-panel--channel summary-panel--${meta.colorMod}`} aria-live="polite">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sp-header">
        <div className="sp-title">
          <span className="sp-icon">{meta.icon}</span>
          <div>
            <h2>{meta.label}</h2>
            <p className="sp-description">{meta.description}</p>
          </div>
          <span className="sp-count">{channels.length}</span>
        </div>
        <button type="button" className="sp-close" onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {channels.length === 0 && (
        <div className="sp-empty">
          {meta.icon} No {channelStatus} channels found across any queue manager.
        </div>
      )}

      {/* ── Grouped channel tables ────────────────────────────────────── */}
      {Object.entries(grouped).map(([managerName, managerChannels]) => (
        <div key={managerName} className="sp-group">

          {/* Group header */}
          <div className="sp-group-header">
            <span className="sp-group-name">{managerName}</span>
            <span className="sp-group-env">
              {managerChannels[0]?.region} · {managerChannels[0]?.environment}
            </span>
            <span className="sp-group-badge">
              {managerChannels.length} channel{managerChannels.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Channel rows */}
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Channel Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  {/* Dynamic extra columns from whatever MQ returns */}
                  {managerChannels[0] && getDetailFields(managerChannels[0]).map(([k]) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {managerChannels.map((ch) => (
                  <tr key={`${managerName}-${ch.name}`} className={`sp-row sp-row--${meta.colorMod}`}>
                    <td className="sp-name">{ch.name || "-"}</td>
                    <td>{ch.type || ch.CHLTYPE || "-"}</td>
                    <td>
                      <span className={`sp-channel-status sp-channel-status--${meta.colorMod}`}>
                        {ch.status || ch.STATUS || channelStatus.toUpperCase()}
                      </span>
                    </td>
                    {getDetailFields(ch).map(([k, v]) => (
                      <td key={`${ch.name}-${k}`} className="sp-muted">
                        {String(v ?? "-")}
                      </td>
                    ))}
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
