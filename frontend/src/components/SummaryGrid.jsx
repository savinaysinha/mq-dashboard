// components/SummaryGrid.jsx

/**
 * Single unified row of summary cards grouped into 3 columns:
 *   Column 1 — Queue Managers  (1 card)
 *   Column 2 — Channels        (3 cards: Running, Retrying, Stopped)
 *   Column 3 — Queues          (3 cards: Critical, Warning, Processing)
 *
 * Props:
 *   summary      { managers, runningChannels, retryingChannels, stoppedChannels }
 *   queueCounts  { Critical: number, Warning: number, Processing: number }
 *   activePanel  {PanelKey|null}
 *   onCardClick  (panelKey: string) => void
 */
export default function SummaryGrid({ summary, queueCounts, activePanel, onCardClick }) {

  const renderCard = ({ key, label, value, hint, activeHint, colorClass, icon }) => {
    const isActive = activePanel === key;
    return (
      <button
        key={key}
        type="button"
        className={`summary-card summary-card--clickable ${colorClass} ${isActive ? "summary-card--active" : ""}`}
        onClick={() => onCardClick(key)}
        aria-pressed={isActive}
        title={isActive ? `Hide ${label}` : `Show ${label}`}
      >
        <div className="label">
          <span className="filter-icon">{icon}</span>
          {label}
        </div>
        <div className="value">{value}</div>
        <div className="hint">{isActive ? activeHint : hint}</div>
        {isActive && <div className="active-indicator" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <section className="summary-row" aria-label="Dashboard summary">

      {/* ── Column 1: Queue Managers ──────────────────────────────────── */}
      <div className="summary-col summary-col--single">
        <div className="summary-col-label">Managers</div>
        {renderCard({
          key:        "managers",
          label:      "Queue Managers",
          value:      summary.managers,
          hint:       "Click to view all queue managers and their status.",
          activeHint: "Showing all queue managers ↓",
          colorClass: "summary-card-blue",
          icon:       "🖥️",
        })}
      </div>

      <div className="summary-col-divider" aria-hidden="true" />

      {/* ── Column 2: Channels ────────────────────────────────────────── */}
      <div className="summary-col summary-col--group">
        <div className="summary-col-label">Channels</div>
        <div className="summary-col-cards">
          {[
            {
              key:        "running",
              label:      "Running",
              value:      summary.runningChannels,
              hint:       "Click to view all running channels.",
              activeHint: "Showing running channels ↓",
              colorClass: "summary-card-green",
              icon:       "🟢",
            },
            {
              key:        "retrying",
              label:      "Retrying",
              value:      summary.retryingChannels,
              hint:       "Click to view all retrying channels.",
              activeHint: "Showing retrying channels ↓",
              colorClass: "summary-card-orange",
              icon:       "🟡",
            },
            {
              key:        "stopped",
              label:      "Stopped",
              value:      summary.stoppedChannels,
              hint:       "Click to view all stopped channels.",
              activeHint: "Showing stopped channels ↓",
              colorClass: "summary-card-critical",
              icon:       "🔴",
            },
          ].map(renderCard)}
        </div>
      </div>

      <div className="summary-col-divider" aria-hidden="true" />

      {/* ── Column 3: Queues ──────────────────────────────────────────── */}
      <div className="summary-col summary-col--group">
        <div className="summary-col-label">Queues</div>
        <div className="summary-col-cards">
          {[
            {
              key:        "Critical",
              label:      "Critical",
              value:      queueCounts.Critical,
              hint:       "Click to view all critical queues.",
              activeHint: "Showing critical queues ↓",
              colorClass: "summary-card-red",
              icon:       "🔴",
            },
            {
              key:        "Warning",
              label:      "Warning",
              value:      queueCounts.Warning,
              hint:       "Click to view all warning queues.",
              activeHint: "Showing warning queues ↓",
              colorClass: "summary-card-orange",
              icon:       "🟡",
            },
            {
              key:        "Processing",
              label:      "Processing",
              value:      queueCounts.Processing,
              hint:       "Click to view all processing queues.",
              activeHint: "Showing processing queues ↓",
              colorClass: "summary-card-green",
              icon:       "🟢",
            },
          ].map(renderCard)}
        </div>
      </div>

    </section>
  );
}
