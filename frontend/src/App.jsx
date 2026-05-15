// App.jsx
import { createPortal } from "react-dom";
import "./App.css";

import LoginDialog from "./components/LoginDialog";
import QueueManagerCard from "./components/QueueManagerCard";
import SummaryGrid from "./components/SummaryGrid";
import { useMqData } from "./hooks/useMqData";

export default function App() {
  const {
    // State
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
    // Derived
    summary,
    sortedManagers,
    // Actions
    handleLogin,
    handleLogout,
    toggleExpanded,
    toggleQueueExpanded,
    toggleChannelExpanded,
    dismissError,
    toggleTheme,
  } = useMqData();

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
              <span>
                Logged in as: <strong>{credentials.username}</strong>
              </span>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
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
        <div
          className="footer-note"
          style={{ color: "var(--danger)", marginBottom: "18px" }}
        >
          {error}
        </div>
      )}

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <SummaryGrid summary={summary} />

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
