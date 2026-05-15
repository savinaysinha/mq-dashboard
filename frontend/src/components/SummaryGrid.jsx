// components/SummaryGrid.jsx

/**
 * Renders the five top-level summary stat cards.
 *
 * Props:
 *   summary { managers, abnormalQueues, runningChannels, retryingChannels, stoppedChannels }
 */
export default function SummaryGrid({ summary }) {
  const cards = [
    {
      label: "Queue Managers",
      value: summary.managers,
      hint: "Regional Queue manager, Click on each to view details.",
      colorClass: "summary-card-blue",
    },
    {
      label: "Abnormal Queues",
      value: summary.abnormalQueues,
      hint: "Queues requiring attention because of delay, depth, or issues.",
      colorClass: "summary-card-red",
    },
    {
      label: "Running Channels",
      value: summary.runningChannels,
      hint: "Healthy channels that are currently active.",
      colorClass: "summary-card-green",
    },
    {
      label: "Retrying Channels",
      value: summary.retryingChannels,
      hint: "Channels needing restart or connectivity investigation.",
      colorClass: "summary-card-orange",
    },
    {
      label: "Stopped Channels",
      value: summary.stoppedChannels,
      hint: "Channels needing restart or connectivity investigation.",
      colorClass: "summary-card-critical",
    },
  ];

  return (
    <section className="summary-grid">
      {cards.map((card) => (
        <article key={card.label} className={`summary-card ${card.colorClass}`}>
          <div className="label">{card.label}</div>
          <div className="value">{card.value}</div>
          <div className="hint">{card.hint}</div>
        </article>
      ))}
    </section>
  );
}
