// components/SummaryGrid.jsx

/**
 * Two rows of clickable summary cards — all wired to a single shared panel
 * state so only one panel can be open at a time.
 *
 * Props:
 *   summary      { managers, runningChannels, retryingChannels, stoppedChannels }
 *   queueCounts  { Critical: number, Warning: number, Processing: number }
 *   activePanel  {PanelKey|null}  — from usePanelFilter
 *   onCardClick  (panelKey: string) => void — openPanel from usePanelFilter
 */
export default function SummaryGrid({ summary, queueCounts, activePanel, onCardClick }) {

  // ── Row 1: infrastructure cards ──────────────────────────────────────────
  const infraCards = [
    {
      key:        "managers",
      label:      "Queue Managers",
      value:      summary.managers,
      hint:       "Click to view all queue managers and their status.",
      activeHint: "Showing all queue managers ↓",
      colorClass: "summary-card-blue",
      icon:       "🖥️",
    },
    {
      key:        "running",
      label:      "Running Channels",
      value:      summary.runningChannels,
      hint:       "Click to view all running channels across every manager.",
      activeHint: "Showing running channels ↓",
      colorClass: "summary-card-green",
      icon:       "🟢",
    },
    {
      key:        "retrying",
      label:      "Retrying Channels",
      value:      summary.retryingChannels,
      hint:       "Click to view all retrying channels across every manager.",
      activeHint: "Showing retrying channels ↓",
      colorClass: "summary-card-orange",
      icon:       "🟡",
    },
    {
      key:        "stopped",
      label:      "Stopped Channels",
      value:      summary.stoppedChannels,
      hint:       "Click to view all stopped channels across every manager.",
      activeHint: "Showing stopped channels ↓",
      colorClass: "summary-card-critical",
      icon:       "🔴",
    },
  ];

  // ── Row 2: queue-status filter cards ─────────────────────────────────────
  const filterCards = [
    {
      key:        "Critical",
      label:      "Critical Queues",
      value:      queueCounts.Critical,
      hint:       "Click to view all critical queues across every manager.",
      activeHint: "Showing critical queues ↓",
      colorClass: "summary-card-red",
      icon:       "🔴",
    },
    {
      key:        "Warning",
      label:      "Warning Queues",
      value:      queueCounts.Warning,
      hint:       "Click to view all queues approaching thresholds.",
      activeHint: "Showing warning queues ↓",
      colorClass: "summary-card-orange",
      icon:       "🟡",
    },
    {
      key:        "Processing",
      label:      "Processing Queues",
      value:      queueCounts.Processing,
      hint:       "Click to view all healthy processing queues.",
      activeHint: "Showing processing queues ↓",
      colorClass: "summary-card-green",
      icon:       "🟢",
    },
  ];

  const renderCard = (card) => {
    const isActive = activePanel === card.key;
    return (
      <button
        key={card.key}
        type="button"
        className={`summary-card summary-card--clickable ${card.colorClass} ${isActive ? "summary-card--active" : ""}`}
        onClick={() => onCardClick(card.key)}
        aria-pressed={isActive}
        title={isActive ? `Hide ${card.label}` : `Show ${card.label}`}
      >
        <div className="label">
          <span className="filter-icon">{card.icon}</span>
          {card.label}
        </div>
        <div className="value">{card.value}</div>
        <div className="hint">{isActive ? card.activeHint : card.hint}</div>
        {isActive && <div className="active-indicator" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <>
      {/* ── Row 1 ─────────────────────────────────────────────────────── */}
      <section className="summary-grid" aria-label="Infrastructure summary">
        {infraCards.map(renderCard)}
      </section>

      {/* ── Row 2 ─────────────────────────────────────────────────────── */}
      <section className="summary-grid summary-grid--filters" aria-label="Queue status filters">
        <div className="filter-grid-label">Filter queues by status:</div>
        {filterCards.map(renderCard)}
      </section>
    </>
  );
}
