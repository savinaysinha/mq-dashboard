// hooks/useMqData.js
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addQueueStatus,
  buildChannelItem,
  buildDefaultManager,
  getBannerClass,
  getRegionAndEnvironmentDetails,
} from "../utils/mqHelpers";
import { initialData } from "../data/initialData";
import {
  clearCredentials,
  getAuthHeader,
  loadCredentials,
  saveCredentials,
} from "../utils/credentials";

/**
 * Central hook that owns all MQ dashboard state:
 * - Authentication (credentials, showLogin)
 * - App config fetched from /api/config
 * - MQ data fetched from the various /api/qmgr/* endpoints
 * - UI expansion state for managers, queues, and channels
 * - Dark-theme toggle
 *
 * SECURITY: The password is held only in React state (in-memory).
 * Only the username is persisted to sessionStorage, which is cleared
 * automatically when the browser tab closes.
 */
export function useMqData() {
  // ── Core data state ───────────────────────────────────────────────────────
  const [mqData, setMqData]     = useState(initialData.map(buildDefaultManager));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [apiErrors, setApiErrors] = useState([]);
  const [appConfig, setAppConfig] = useState(null);

  // ── Auth state ────────────────────────────────────────────────────────────
  // credentials = { username, password } — password lives only here in memory
  const [credentials, setCredentials] = useState(null);
  const [showLogin, setShowLogin]     = useState(false);

  // ── UI expansion state ────────────────────────────────────────────────────
  const [expanded, setExpanded]               = useState([]);
  const [expandedQueues, setExpandedQueues]   = useState([]);
  const [expandedChannels, setExpandedChannels] = useState([]);
  const [isDarkTheme, setIsDarkTheme]         = useState(false);

  // Keep a stable ref to credentials for use inside intervals/callbacks
  const credentialsRef = useRef(credentials);
  useEffect(() => { credentialsRef.current = credentials; }, [credentials]);

  // ── Derived / memoised values ─────────────────────────────────────────────
  const summary = useMemo(
    () => ({
      managers: mqData.length,
      abnormalQueues: mqData.reduce(
        (sum, item) => sum + (item.abnormalQueues?.length ?? 0),
        0
      ),
      runningChannels: mqData.reduce(
        (sum, item) => sum + (item.channels?.running?.length ?? 0),
        0
      ),
      retryingChannels: mqData.reduce(
        (sum, item) => sum + (item.channels?.retrying?.length ?? 0),
        0
      ),
      stoppedChannels: mqData.reduce(
        (sum, item) => sum + (item.channels?.stopped?.length ?? 0),
        0
      ),
    }),
    [mqData]
  );

  const sortedManagers = useMemo(() => {
    const severityRank  = { issue: 0, warning: 1, healthy: 2 };
    const openAlertCount = (item) =>
      (item.abnormalQueues?.length  ?? 0) +
      (item.channels?.stopped?.length  ?? 0) +
      (item.channels?.retrying?.length ?? 0);

    return [...mqData].sort((a, b) => {
      const alertDiff = openAlertCount(b) - openAlertCount(a);
      if (alertDiff !== 0) return alertDiff;

      const severityDiff =
        severityRank[getBannerClass(a)] - severityRank[getBannerClass(b)];
      if (severityDiff !== 0) return severityDiff;

      return a.name.localeCompare(b.name);
    });
  }, [mqData]);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Load config on mount, then attempt to restore saved session
  useEffect(() => {
    async function loadConfig() {
      try {
        const configResponse = await fetch("/api/config");
        if (!configResponse.ok) {
          throw new Error(`Unable to load config: ${configResponse.status}`);
        }
        const configData = await configResponse.json();
        setAppConfig(configData);

        const { credentialStorageKey: storageKey, credentialExpiryMs: expiryMs } =
          configData.auth;

        // Only username is stored — password must be re-entered after tab close
        const savedSession = loadCredentials(storageKey, expiryMs);
        if (savedSession?.username) {
          // We have a username but no password — show login pre-filled
          setShowLogin(true);
        } else {
          setShowLogin(true);
        }
      } catch (fetchError) {
        setError(fetchError.message || "Unable to load application configuration");
        setShowLogin(true);
      }
    }

    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh while authenticated — skips if tab is hidden
  useEffect(() => {
    if (!credentials || !appConfig) return;

    const refreshIntervalMs = appConfig?.ui?.refreshIntervalMs ?? 60000;
    const interval = setInterval(() => {
      if (!document.hidden) {
        callApi(credentialsRef.current);
      }
    }, refreshIntervalMs);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, appConfig]);

  // Sync dark theme to <html> attribute — kept separate from the toggle
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkTheme ? "dark" : "light"
    );
  }, [isDarkTheme]);

  // ── API helpers ───────────────────────────────────────────────────────────

  async function fetchQueueManagerData(qmgrName, dspmqPayload, creds) {
    if (!creds) throw new Error("No credentials available");

    const authHeader = getAuthHeader(creds.username, creds.password);
    const headers    = { Authorization: authHeader };

    // Fetch all 5 endpoints in parallel
    const [qmStatus, qmDisp, lstrStatus, chlStatus, qStatus] =
      await Promise.all([
        fetch(`/api/qmgr/${qmgrName}`,        { headers }),
        fetch(`/api/qmgr/${qmgrName}/disp`,   { headers }),
        fetch(`/api/qmgr/${qmgrName}/lstr`,   { headers }),
        fetch(`/api/qmgr/${qmgrName}/chl`,    { headers }),
        fetch(`/api/qmgr/${qmgrName}/queues`, { headers }),
      ]);

    const getErrorMessage = async (response, endpoint) => {
      try {
        const errorData = await response.json();
        return (
          errorData.error || errorData.message || `${endpoint} failed: ${response.status}`
        );
      } catch {
        return `${endpoint} failed: ${response.status}`;
      }
    };

    if (!qmStatus.ok)   throw new Error(await getErrorMessage(qmStatus,   "QM status fetch"));
    if (!qmDisp.ok)     throw new Error(await getErrorMessage(qmDisp,     "QM properties fetch"));
    if (!lstrStatus.ok) throw new Error(await getErrorMessage(lstrStatus, "Listener status fetch"));
    if (!chlStatus.ok)  throw new Error(await getErrorMessage(chlStatus,  "Channel status fetch"));
    if (!qStatus.ok)    throw new Error(await getErrorMessage(qStatus,    "Queue status fetch"));

    const [qmStatusPayload, qmDispPayload, lstrStatusPayload, chlStatusPayload, qStatusPayload] =
      await Promise.all([
        qmStatus.json(),
        qmDisp.json(),
        lstrStatus.json(),
        chlStatus.json(),
        qStatus.json(),
      ]);

    const DefaultListenerKeyword = appConfig?.mq?.DefaultListenerKeyword || "APP";
    const allQueues = addQueueStatus(qStatusPayload);

    const listenerEntry = lstrStatusPayload?.find((item) =>
      item.LISTENER?.toLowerCase().includes(DefaultListenerKeyword.toLowerCase())
    );

    return {
      name: qmgrName,
      baseUrl:
        appConfig?.queueManagers?.find(
          (m) => m.qmName?.toLowerCase() === qmgrName.toLowerCase()
        )?.baseUrl || "",
      region:      getRegionAndEnvironmentDetails(qmgrName).region,
      environment: getRegionAndEnvironmentDetails(qmgrName).environment,
      queueManager: {
        host:              qmStatusPayload?.[0]?.HOSTNAME ?? "",
        port:              listenerEntry?.PORT ?? "",
        status:            dspmqPayload.qmgr.find((q) => q.name === qmgrName)?.state?.toUpperCase() ?? "",
        commandServer:     qmStatusPayload?.[0]?.CMDSERV ?? "",
        listener:          listenerEntry?.STATUS ?? "",
        deadLetterQueue:   qmDispPayload?.[0]?.DEADQ ?? "",
        startDate:         `${qmStatusPayload?.[0]?.STARTDA ?? ""} ${qmStatusPayload?.[0]?.STARTTI ?? ""}`.trim(),
        activeConnections: qmStatusPayload?.[0]?.CONNS ?? 0,
        mqVersion:         qmStatusPayload?.[0]?.INSTDESC ?? "",
      },
      allQueues,
      abnormalQueues: allQueues.filter((q) => q.status !== "Processing"),
      channels: {
        running:  (chlStatusPayload || []).filter((c) => c.STATUS === "RUNNING"  && c.CHLTYPE === "SDR").map(buildChannelItem),
        retrying: (chlStatusPayload || []).filter((c) => c.STATUS === "RETRYING" && c.CHLTYPE === "SDR").map(buildChannelItem),
        stopped:  (chlStatusPayload || []).filter((c) => c.STATUS === "STOPPED"  && c.CHLTYPE === "SDR").map(buildChannelItem),
      },
    };
  }

  async function callApi(creds = credentials) {
    if (!creds) return;

    setLoading(true);
    setError("");

    const authHeader = getAuthHeader(creds.username, creds.password);

    try {
      const dspmq = await fetch("/api/qmgr", { headers: { Authorization: authHeader } });

      if (!dspmq.ok) {
        let errorMessage = `HTTP ${dspmq.status}`;
        try {
          const errorData = await dspmq.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch { /* ignore */ }
        throw new Error(errorMessage);
      }

      const dspmqPayload = await dspmq.json();
      const qmgrNames = dspmqPayload?.qmgr?.map((q) => q.name).filter(Boolean) || [];
      if (qmgrNames.length === 0) throw new Error("No queue managers found");

      // Fetch all managers in parallel using Promise.allSettled
      const loadResults = await Promise.allSettled(
        qmgrNames.map((name) => fetchQueueManagerData(name, dspmqPayload, creds))
      );

      const successfulManagers = loadResults
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);

      const partialErrors = loadResults
        .filter((r) => r.status === "rejected")
        .map((r, i) => ({
          id:      `manager-${qmgrNames[i]}-${i}`,
          message: `Failed to load ${qmgrNames[i]}: ${r.reason?.message || String(r.reason)}`,
        }));

      const upstreamErrors = (dspmqPayload?.partialErrors || []).map((e, i) => ({
        id:      `upstream-${i}`,
        message: `${e.server || "Server"}: ${e.error || e.upstreamBody || "Unknown error"}`,
      }));

      const allErrors = [...partialErrors, ...upstreamErrors];

      if (successfulManagers.length === 0) {
        throw new Error(
          allErrors.map((e) => e.message).join(" | ") || "Unable to load MQ data"
        );
      }

      const apiDataNames = new Set(successfulManagers.map((item) => item.name));
      const mergedData = [
        ...successfulManagers,
        ...initialData
          .filter((item) => !apiDataNames.has(item.name))
          .map(buildDefaultManager),
      ];

      setMqData(mergedData);
      setApiErrors(allErrors);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load MQ data");
      setApiErrors([]);
      setMqData(initialData.map(buildDefaultManager));
    } finally {
      setLoading(false);
    }
  }

  // ── Auth actions ──────────────────────────────────────────────────────────

  const handleLogin = async (username, password) => {
    const authHeader   = getAuthHeader(username, password);
    const testResponse = await fetch("/api/qmgr", { headers: { Authorization: authHeader } });

    if (!testResponse.ok) {
      throw new Error(
        testResponse.status === 401
          ? "Invalid username or password"
          : "Authentication failed"
      );
    }

    const creds    = { username, password };
    const storageKey = appConfig?.auth?.credentialStorageKey || "mq_credentials";

    // Only persist username — password stays in memory only
    saveCredentials(username, storageKey);
    setCredentials(creds);
    setShowLogin(false);
    await callApi(creds);
  };

  const handleLogout = () => {
    const storageKey = appConfig?.auth?.credentialStorageKey || "mq_credentials";
    clearCredentials(storageKey);
    setCredentials(null);
    setMqData(initialData.map(buildDefaultManager));
    setError("");
    setApiErrors([]);
    setShowLogin(true);
  };

  // ── UI toggle actions ─────────────────────────────────────────────────────

  function toggleExpanded(managerName) {
    setExpanded((curr) =>
      curr.includes(managerName)
        ? curr.filter((n) => n !== managerName)
        : [...curr, managerName]
    );
  }

  function toggleQueueExpanded(managerName, queueName) {
    const key = `${managerName}::${queueName}`;
    setExpandedQueues((curr) =>
      curr.includes(key) ? curr.filter((k) => k !== key) : [...curr, key]
    );
  }

  function toggleChannelExpanded(managerName, channelName) {
    const key = `${managerName}::${channelName}`;
    setExpandedChannels((curr) =>
      curr.includes(key) ? curr.filter((k) => k !== key) : [...curr, key]
    );
  }

  function dismissError(id) {
    setApiErrors((curr) => curr.filter((e) => e.id !== id));
  }

  // Side effect is handled by useEffect above — no DOM mutation here
  function toggleTheme() {
    setIsDarkTheme((prev) => !prev);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    mqData,
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
    handleLogin,
    handleLogout,
    toggleExpanded,
    toggleQueueExpanded,
    toggleChannelExpanded,
    dismissError,
    toggleTheme,
  };
}
