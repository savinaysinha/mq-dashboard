// components/QueueManagerCard.jsx
import { Fragment } from "react";
import { getBannerClass, isChannelDetailField, statusClass } from "../utils/mqHelpers";

/**
 * Expandable card for a single IBM MQ queue manager.
 *
 * Props:
 *   item               {object}    - Queue manager data object
 *   index              {number}    - Positional index (used as part of key)
 *   expanded           {string[]}  - List of expanded manager names
 *   expandedQueues     {string[]}  - List of expanded queue keys ("manager::queue")
 *   expandedChannels   {string[]}  - List of expanded channel keys ("manager::channel")
 *   onToggleManager    {Function}  - (managerName) => void
 *   onToggleQueue      {Function}  - (managerName, queueName) => void
 *   onToggleChannel    {Function}  - (managerName, channelName) => void
 *   appConfig          {object}    - App config (used for mqWebConsoleSuffix)
 */
export default function QueueManagerCard({
  item,
  index,
  expanded,
  expandedQueues,
  expandedChannels,
  onToggleManager,
  onToggleQueue,
  onToggleChannel,
  appConfig,
}) {
  const bannerClass = getBannerClass(item);
  const problemCount =
    item.abnormalQueues.length +
    item.channels.stopped.length +
    item.channels.retrying.length;
  const isExpanded = expanded.includes(item.name);

  return (
    <article
      key={`${item.name}-${index}`}
      className={`manager-card ${bannerClass} ${isExpanded ? "expanded" : ""}`}
      data-severity={bannerClass}
    >
      {/* ── Collapsed header / toggle ──────────────────────────────────── */}
      <button
        className="manager-toggle"
        type="button"
        aria-expanded={isExpanded}
        onClick={() => onToggleManager(item.name)}
      >
        <div className="manager-summary">
          <div className="manager-main">
            <h2>{item.name}</h2>
            <h3>
              {item.region} · {item.environment}
            </h3>
          </div>
          <div className="metric">
            <div className="k">Queue Manager</div>
            <div className="v">
              <span className={`status ${statusClass(item.queueManager.status)}`}>
                {item.queueManager.status}
              </span>
            </div>
            <div className="sub">Listener {item.queueManager.listener}</div>
          </div>
          <div className="metric">
            <div className="k">Abnormal Queues</div>
            <div className="v">{item.abnormalQueues.length}</div>
            <div className="sub">Need quick review</div>
          </div>
          <div className="metric hide-md">
            <div className="k">Problematic Channels</div>
            <div className="v">
              {item.channels.stopped.length + item.channels.retrying.length}
            </div>
            <div className="sub">Channel issues</div>
          </div>
          <div className="metric hide-md">
            <div className="k">Open Alerts</div>
            <div className="v">{problemCount}</div>
            <div className="sub">Queues + channels</div>
          </div>
        </div>
      </button>

      {/* ── Expanded detail sections ───────────────────────────────────── */}
      <div className="manager-details">
        {/* A) Queue Manager details */}
        <section className="block">
          <h3>A) Details About Queue Manager Details</h3>
          <div className="details-grid">
            <div className="detail">
              <div className="k">Host</div>
              <div className="v">{item.baseUrl.replace("https://", "")}</div>
            </div>
            <div className="detail">
              <div className="k">Port</div>
              <div className="v">{item.queueManager.port}</div>
            </div>
            <div className="detail">
              <div className="k">Queue Manager Status</div>
              <div className="v">
                <span className={`status ${statusClass(item.queueManager.status)}`}>
                  {item.queueManager.status}
                </span>
              </div>
            </div>
            <div className="detail">
              <div className="k">Listener</div>
              <div className="v">
                <span className={`status ${statusClass(item.queueManager.listener)}`}>
                  {item.queueManager.listener}
                </span>
              </div>
            </div>
            <div className="detail">
              <div className="k">Dead Letter Queue</div>
              <div className="v">{item.queueManager.deadLetterQueue}</div>
            </div>
            <div className="detail">
              <div className="k">Start Date</div>
              <div className="v">{item.queueManager.startDate}</div>
            </div>
            <div className="detail">
              <div className="k">Active Connections</div>
              <div className="v">{item.queueManager.activeConnections}</div>
            </div>
            <div className="detail">
              <div className="k">MQ Version</div>
              <div className="v">{item.queueManager.mqVersion}</div>
            </div>
            <div className="detail">
              <div className="k">MQ Web Console</div>
              <div className="v">
                <button
                  onClick={() => {
                    if (!item.baseUrl) {
                      alert("MQ Console URL not configured for this queue manager");
                      return;
                    }
                    window.open(
                      `${item.baseUrl}${appConfig?.ui?.mqWebConsoleSuffix}`,
                      "_blank"
                    );
                  }}
                  className="console-btn"
                >
                  Open Console
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* B) Queue details */}
        <section className="block">
          <h3>B) Queue details and processing status</h3>
          {item.allQueues.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Queue</th>
                    <th>Current Depth</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {item.allQueues.map((q) => {
                    const queueKey = `${item.name}::${q.name}`;
                    const queueExpanded = expandedQueues.includes(queueKey);

                    return (
                      <Fragment key={queueKey}>
                        <tr
                          className={`queue-row ${queueExpanded ? "expanded" : ""}`}
                          onClick={() => onToggleQueue(item.name, q.name)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              onToggleQueue(item.name, q.name);
                            }
                          }}
                          aria-expanded={queueExpanded}
                        >
                          <td className="queue-name" title={q.name}>
                            {q.name}
                          </td>
                          <td className="current-depth" title={String(q.currentDepth)}>
                            {q.currentDepth}
                          </td>
                          <td className="status-cell">
                            <span className={`status ${statusClass(q.status)}`}>
                              {q.status}
                            </span>
                          </td>
                        </tr>
                        {queueExpanded && (
                          <tr className="queue-details-row" key={`${queueKey}-details`}>
                            <td colSpan="3">
                              <div className="queue-details-grid">
                                <div>
                                  <strong>Last Get:</strong> {q.lastGet || "-"}
                                </div>
                                <div>
                                  <strong>Last Put:</strong> {q.lastPut || "-"}
                                </div>
                                <div>
                                  <strong>Oldest Message:</strong>{" "}
                                  {q.oldestMessageAge || "-"}
                                </div>
                                <div>
                                  <strong>Input Count:</strong> {q.openInputCount}
                                </div>
                                <div>
                                  <strong>Uncommitted Messages:</strong>{" "}
                                  {q.uncommittedMessages}
                                </div>
                                <div>
                                  <strong>Max Depth:</strong> {q.maximumDepth}
                                </div>
                                <div>
                                  <strong>Queue Depth Utilization:</strong>{" "}
                                  {q.queueCapacityPercent}%
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No abnormal queues found</div>
          )}
        </section>

        {/* C) Channel details */}
        <section className="block">
          <h3>C) Details about channels which are running and not running</h3>
          <div className="channel-grid">
            {/* Running channels */}
            <div className="channel-list">
              <h4>Running Channels</h4>
              {item.channels.running.length > 0 ? (
                item.channels.running.map((channel) => {
                  const channelKey = `${item.name}::${channel.name}`;
                  const channelExpanded = expandedChannels.includes(channelKey);
                  return (
                    <div
                      key={channelKey}
                      className={`channel-item channel-toggle ${channelExpanded ? "expanded" : ""}`}
                    >
                      <button
                        type="button"
                        className="channel-toggle-button"
                        onClick={() => onToggleChannel(item.name, channel.name)}
                        aria-expanded={channelExpanded}
                      >
                        <div className="name-wrap">
                          <span className="dot good" />
                          {channel.name}
                        </div>
                        <span className="status good">Running</span>
                      </button>
                      {channelExpanded && (
                        <div className="channel-details-grid">
                          {Object.entries(channel)
                            .filter(([key]) => isChannelDetailField(key))
                            .map(([key, value]) => (
                              <div key={`${channelKey}-${key}`}>
                                <strong>{key}:</strong> {String(value ?? "-")}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">No running channels found</div>
              )}
            </div>

            {/* Retrying & Stopped channels */}
            <div className="channel-list">
              <h4>Retrying &amp; Stopped Channels</h4>
              {item.channels.retrying.length > 0 || item.channels.stopped.length > 0 ? (
                <>
                  {item.channels.retrying.map((channel) => {
                    const channelKey = `${item.name}::${channel.name}`;
                    const channelExpanded = expandedChannels.includes(channelKey);
                    return (
                      <div
                        key={`retry-${channelKey}`}
                        className={`channel-item channel-toggle ${channelExpanded ? "expanded" : ""}`}
                      >
                        <button
                          type="button"
                          className="channel-toggle-button"
                          onClick={() => onToggleChannel(item.name, channel.name)}
                          aria-expanded={channelExpanded}
                        >
                          <div className="name-wrap">
                            <span className="dot bad" />
                            {channel.name}
                          </div>
                          <span className="status bad">Retrying</span>
                        </button>
                        {channelExpanded && (
                          <div className="channel-details-grid">
                            {Object.entries(channel)
                              .filter(([key]) => isChannelDetailField(key))
                              .map(([key, value]) => (
                                <div key={`retry-${channelKey}-${key}`}>
                                  <strong>{key}:</strong> {String(value ?? "-")}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {item.channels.stopped.map((channel) => {
                    const channelKey = `${item.name}::${channel.name}`;
                    const channelExpanded = expandedChannels.includes(channelKey);
                    return (
                      <div
                        key={`stop-${channelKey}`}
                        className={`channel-item channel-toggle ${channelExpanded ? "expanded" : ""}`}
                      >
                        <button
                          type="button"
                          className="channel-toggle-button"
                          onClick={() => onToggleChannel(item.name, channel.name)}
                          aria-expanded={channelExpanded}
                        >
                          <div className="name-wrap">
                            <span className="dot bad" />
                            {channel.name}
                          </div>
                          <span className="status bad">Stopped</span>
                        </button>
                        {channelExpanded && (
                          <div className="channel-details-grid">
                            {Object.entries(channel)
                              .filter(([key]) => isChannelDetailField(key))
                              .map(([key, value]) => (
                                <div key={`stop-${channelKey}-${key}`}>
                                  <strong>{key}:</strong> {String(value ?? "-")}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="empty-state">No retrying &amp; stopped channels found</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
