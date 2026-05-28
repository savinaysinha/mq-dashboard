// App.jsx
import { createPortal } from "react-dom";
import "./App.css";

import ChannelListPanel from "./components/ChannelListPanel";
import LoginDialog      from "./components/LoginDialog";
import ManagerListPanel from "./components/ManagerListPanel";
import QueueManagerCard from "./components/QueueManagerCard";
import QueueStatusPanel from "./components/QueueStatusPanel";
import SummaryGrid      from "./components/SummaryGrid";
import { useMqData }      from "./hooks/useMqData";
import { usePanelFilter } from "./hooks/usePanelFilter";

export default function App() {
  const {
    loading,
    error,
    apiErrors,
    appConfig,
    credentials,
    showLogin,
    setShowLogin,
    expanded,
    expandedQueues,
    expandedChannels,
    isDarkTheme,
    summary,
    sortedManagers,
    mqData,
    handleLogin,
    handleLogout,
    toggleExpanded,
    toggleQueueExpanded,
    toggleChannelExpanded,
    dismissError,
    toggleTheme,
  } = useMqData();

  // Single unified panel state — only one panel open at a time
  const {
    activePanel,
    openPanel,
    closePanel,
    allManagers,
    activeChannelStatus,
    channelData,
    queueCounts,
    filteredQueues,
  } = usePanelFilter(mqData);

  return (
    <main className="page" data-theme={isDarkTheme ? "dark" : "light"}>

      {/* ── Hero / header ───────────────────────────────────────────────── */}
      <section className="hero">
        <div>
          <h1>AKS MQ Administrative Dashboard</h1>
        </div>
        <div className="hero-controls">
          {credentials && (
            <div className="user-info">
              <span>Logged in as: <strong>{credentials.username}</strong></span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          )}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={isDarkTheme ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            {isDarkTheme ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </section>

      {/* ── Global loading overlay ──────────────────────────────────────── */}
      {createPortal(
        loading && (
          <div id="loaderOverlay" className="loader-overlay">
            <div className="loader" />
          </div>
        ),
        document.body
      )}

      {/* ── Top-level error banner ──────────────────────────────────────── */}
      {error && (
        <div className="footer-note" style={{ color: "var(--danger)", marginBottom: "18px" }}>
          {error}
        </div>
      )}

      {/* ── Summary cards — single onCardClick handler for all 7 buttons ── */}
      <SummaryGrid
        summary={summary}
        queueCounts={queueCounts}
        activePanel={activePanel}
        onCardClick={openPanel}
      />

      {/* ── Panels — only one renders at a time ────────────────────────── */}

      {activePanel === "managers" && (
        <ManagerListPanel
          managers={allManagers}
          onClose={closePanel}
        />
      )}

      {activeChannelStatus && (
        <ChannelListPanel
          channelStatus={activeChannelStatus}
          channels={channelData[activeChannelStatus]}
          onClose={closePanel}
        />
      )}

      {["Critical", "Warning", "Processing"].includes(activePanel) && (
        <QueueStatusPanel
          activeFilter={activePanel}
          queues={filteredQueues}
          onClose={closePanel}
        />
      )}

      {/* ── Partial / upstream error cards ─────────────────────────────── */}
      {apiErrors.length > 0 && (
        <aside className="error-panel" aria-live="polite" aria-label="Partial load errors">
          {apiErrors.map((errorItem) => (
            <div key={errorItem.id} className="error-card">
              <div>
                <div className="error-card-title">Error</div>
                <div className="error-message">{errorItem.message}</div>
              </div>
              <button
                type="button"
                className="error-close"
                aria-label="Close error"
                onClick={() => dismissError(errorItem.id)}
              >
                ×
              </button>
            </div>
          ))}
        </aside>
      )}

      {/* ── Queue manager cards ─────────────────────────────────────────── */}
      <section className="stack">
        {sortedManagers.map((item, index) => (
          <QueueManagerCard
            key={`${item.name}-${index}`}
            item={item}
            index={index}
            expanded={expanded}
            expandedQueues={expandedQueues}
            expandedChannels={expandedChannels}
            onToggleManager={toggleExpanded}
            onToggleQueue={toggleQueueExpanded}
            onToggleChannel={toggleChannelExpanded}
            appConfig={appConfig}
          />
        ))}
      </section>

      <div className="footer-note">Designed &amp; Developed by Savinay Sinha.</div>

      {/* ── Login dialog ────────────────────────────────────────────────── */}
      {showLogin && (
        <LoginDialog
          title={appConfig?.ui?.loginTitle}
          description={appConfig?.ui?.loginDescription}
          onLogin={handleLogin}
          onCancel={() => setShowLogin(false)}
        />
      )}
    </main>
  );
}
