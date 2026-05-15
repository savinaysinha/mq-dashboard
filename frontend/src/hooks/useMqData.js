// hooks/useMqData.js
import { useEffect, useMemo, useState } from "react";
import {
  addQueueStatus,
  buildChannelItem,
  buildDefaultManager,
  getBannerClass,
  getRegionAndEnvironmentDetails,
  initialData,
} from "../utils/mqHelpers";
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
 * Returns everything the App shell and child components need.
 */
export function useMqData() {
  // ── Core data state ───────────────────────────────────────────────────────
  const [mqData, setMqData] = useState(initialData.map(buildDefaultManager));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiErrors, setApiErrors] = useState([]);
  const [appConfig, setAppConfig] = useState(null);

  // ── Auth state ────────────────────────────────────────────────────────────
  const [credentials, setCredentials] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  // ── UI expansion state ────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState([]);
  const [expandedQueues, setExpandedQueues] = useState([]);
  const [expandedChannels, setExpandedChannels] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  // ── Derived / memoised values ─────────────────────────────────────────────
  const summary = useMemo(
    () => ({
      managers: mqData.length,
      abnormalQueues: mqData.reduce(
        (sum, item) =>
          sum + (Array.isArray(item.abnormalQueues) ? item.abnormalQueues.length : 0),
        0
      ),
      runningChannels: mqData.reduce(
        (sum, item) =>
          sum + (Array.isArray(item.channels?.running) ? item.channels.running.length : 0),
        0
      ),
      retryingChannels: mqData.reduce(
        (sum, item) =>
          sum +
          (Array.isArray(item.channels?.retrying) ? item.channels.retrying.length : 0),
        0
      ),
      stoppedChannels: mqData.reduce(
        (sum, item) =>
          sum + (Array.isArray(item.channels?.stopped) ? item.channels.stopped.length : 0),
        0
      ),
    }),
    [mqData]
  );

  const sortedManagers = useMemo(() => {
    const severityRank = { issue: 0, warning: 1, healthy: 2 };
    const openAlertCount = (item) =>
      (item.abnormalQueues?.length || 0) +
      (item.channels?.stopped?.length || 0) +
      (item.channels?.retrying?.length || 0);

    return [...mqData].sort((a, b) => {
      const alertsA = openAlertCount(a);
      const alertsB = openAlertCount(b);
      if (alertsA !== alertsB) return alertsB - alertsA;

      const severityA = severityRank[getBannerClass(a)];
      const severityB = severityRank[getBannerClass(b)];
      if (severityA !== severityB) return severityA - severityB;

      return a.name.localeCompare(b.name);
    });
  }, [mqData]);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Load config on mount, then attempt to restore saved credentials
  useEffect(() => {
    async function loadConfig() {
      try {
        const configResponse = await fetch("/api/config");
        if (!configResponse.ok) {
          throw new Error(`Unable to load config: ${configResponse.status}`);
        }
        const configData = await configResponse.json();
        setAppConfig(configData);

        const storageKey = configData.auth.credentialStorageKey;
        const expiryMs = configData.auth.credentialExpiryMs;
        const storedCredentials = loadCredentials(storageKey, expiryMs);

        if (storedCredentials) {
          setCredentials(storedCredentials);
          await callApi(storedCredentials);
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

  // Auto-refresh while authenticated
  useEffect(() => {
    if (!credentials || !appConfig) return;

    const refreshIntervalMs = appConfig?.ui?.refreshIntervalMs ?? 60000;
    const interval = setInterval(() => callApi(), refreshIntervalMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, appConfig]);

  // Restore scroll position after a data reload
  useEffect(() => {
    if (!loading && scrollPosition > 0 && credentials) {
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
        setScrollPosition(0);
      }, 100);
    }
  }, [loading, scrollPosition, credentials]);

  // ── API helpers ───────────────────────────────────────────────────────────

  async function fetchQueueManagerData(qmgrName, dspmqPayload, creds = credentials) {
    if (!creds) throw new Error("No credentials available");

    const authHeader = getAuthHeader(creds.username, creds.password);

    const [qmStatus, qmDisp, lstrStatus, chlStatus, qStatus] = await Promise.all([
      fetch(`/api/qmgr/${qmgrName}`, { headers: { Authorization: authHeader } }),
      fetch(`/api/qmgr/${qmgrName}/disp`, { headers: { Authorization: authHeader } }),
      fetch(`/api/qmgr/${qmgrName}/lstr`, { headers: { Authorization: authHeader } }),
      fetch(`/api/qmgr/${qmgrName}/chl`, { headers: { Authorization: authHeader } }),
      fetch(`/api/qmgr/${qmgrName}/queues`, { headers: { Authorization: authHeader } }),
    ]);

    const getErrorMessage = async (response, endpoint) => {
      try {
        const errorData = await response.json();
        return errorData.error || errorData.message || `${endpoint} failed: ${response.status}`;
      } catch {
        return `${endpoint} failed: ${response.status}`;
      }
    };

    if (!qmStatus.ok) throw new Error(await getErrorMessage(qmStatus, "QM status fetch"));
    if (!qmDisp.ok) throw new Error(await getErrorMessage(qmDisp, "QM properties fetch"));
    if (!lstrStatus.ok) throw new Error(await getErrorMessage(lstrStatus, "Listener status fetch"));
    if (!chlStatus.ok) throw new Error(await getErrorMessage(chlStatus, "Channel status fetch"));
    if (!qStatus.ok) throw new Error(await getErrorMessage(qStatus, "Queue status fetch"));

    const qmStatusPayload = await qmStatus.json();
    const qmDispPayload = await qmDisp.json();
    const lstrStatusPayload = await lstrStatus.json();
    const chlStatusPayload = await chlStatus.json();
    const qStatusPayload = await qStatus.json();

    const DefaultListenerKeyword = appConfig?.mq?.listenerName || "APP";
    const allQueues = addQueueStatus(qStatusPayload);

    return {
      name: qmgrName,
      baseUrl:
        appConfig?.queueManagers?.find(
          (m) => m.qmName.toLowerCase() === qmgrName.toLowerCase()
        )?.baseUrl || "",
      region: getRegionAndEnvironmentDetails(qmgrName).region,
      environment: getRegionAndEnvironmentDetails(qmgrName).environment,
      queueManager: {
        host: qmStatusPayload?.[0]?.HOSTNAME ?? "",
        port:
          lstrStatusPayload?.find((item) =>
            item.LISTENER?.toLowerCase().includes(DefaultListenerKeyword.toLowerCase())
          )?.PORT ?? "",
        status: `${
          dspmqPayload.qmgr.find((q) => q.name === qmgrName)?.state?.toUpperCase() ?? ""
        }`,
        commandServer: qmStatusPayload?.[0]?.CMDSERV ?? "",
        listener:
          lstrStatusPayload?.find((item) =>
            item.LISTENER?.toLowerCase().includes(DefaultListenerKeyword.toLowerCase())
          )?.STATUS ?? "",
        deadLetterQueue: qmDispPayload?.[0]?.DEADQ ?? "",
        startDate: `${qmStatusPayload?.[0]?.STARTDA ?? ""} ${
          qmStatusPayload?.[0]?.STARTTI ?? ""
        }`,
        activeConnections: qmStatusPayload?.[0]?.CONNS ?? 0,
        mqVersion: `${qmStatusPayload?.[0]?.INSTDESC ?? ""}`,
      },
      allQueues,
      abnormalQueues: allQueues.filter((q) => q.status !== "Processing"),
      channels: {
        running: (chlStatusPayload || [])
          .filter((item) => item.STATUS === "RUNNING" && item.CHLTYPE === "SDR")
          .map(buildChannelItem),
        retrying: (chlStatusPayload || [])
          .filter((item) => item.STATUS === "RETRYING" && item.CHLTYPE === "SDR")
          .map(buildChannelItem),
        stopped: (chlStatusPayload || [])
          .filter((item) => item.STATUS === "STOPPED" && item.CHLTYPE === "SDR")
          .map(buildChannelItem),
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
        } catch {}
        throw new Error(errorMessage);
      }

      const dspmqPayload = await dspmq.json();
      const qmgrNames = dspmqPayload?.qmgr?.map((q) => q.name).filter(Boolean) || [];
      if (qmgrNames.length === 0) throw new Error("No queue managers found");

      const loadResults = await Promise.all(
        qmgrNames.map(async (qmgrName) => {
          try {
            const manager = await fetchQueueManagerData(qmgrName, dspmqPayload, creds);
            return { status: "fulfilled", value: manager };
          } catch (loadError) {
            return { status: "rejected", reason: loadError, qmgrName };
          }
        })
      );

      const successfulManagers = loadResults
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);

      const partialErrors = loadResults
        .filter((r) => r.status === "rejected")
        .map((r, i) => ({
          id: `manager-${r.qmgrName}-${i}`,
          message: `Failed to load ${r.qmgrName}: ${r.reason?.message || String(r.reason)}`,
        }));

      const upstreamErrors = (dspmqPayload?.partialErrors || []).map((e, i) => ({
        id: `upstream-${i}`,
        message: `${e.server || "Server"}: ${e.error || e.upstreamBody || "Unknown error"}`,
      }));

      const allErrors = [...partialErrors, ...upstreamErrors];

      if (successfulManagers.length === 0) {
        throw new Error(allErrors.map((e) => e.message).join(" | ") || "Unable to load MQ data");
      }

      const apiDataNames = successfulManagers.map((item) => item.name);
      const mergedData = [
        ...successfulManagers,
        ...initialData
          .filter((item) => !apiDataNames.includes(item.name))
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
    const authHeader = getAuthHeader(username, password);
    const testResponse = await fetch("/api/qmgr", { headers: { Authorization: authHeader } });

    if (!testResponse.ok) {
      throw new Error(testResponse.status === 401 ? "Invalid username or password" : "Authentication failed");
    }

    const creds = { username, password };
    const storageKey = appConfig?.auth?.credentialStorageKey || "mq_credentials";
    saveCredentials(username, password, storageKey);
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
      curr.includes(managerName) ? curr.filter((n) => n !== managerName) : [...curr, managerName]
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

  function toggleTheme() {
    setIsDarkTheme((prev) => {
      document.documentElement.setAttribute("data-theme", !prev ? "dark" : "light");
      return !prev;
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    // State
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
  };
}
