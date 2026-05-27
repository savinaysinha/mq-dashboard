// utils/credentials.js
// Handles saving, loading, and clearing session credentials.
// SECURITY: Only the username and session timestamp are persisted in
// sessionStorage. The password is NEVER written to disk or storage —
// it lives only in React state for the lifetime of the browser tab.

/**
 * Persists the username + timestamp (NOT the password) in sessionStorage.
 * sessionStorage is cleared automatically when the tab/browser closes.
 */
export function saveCredentials(username, storageKey) {
  const session = { username, timestamp: Date.now() };
  sessionStorage.setItem(storageKey, JSON.stringify(session));
}

/**
 * Loads a saved session. Returns { username, timestamp } or null if
 * absent, malformed, or expired.
 */
export function loadCredentials(storageKey, expiryMs) {
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return null;

    const session = JSON.parse(stored);
    if (Date.now() - session.timestamp > expiryMs) {
      sessionStorage.removeItem(storageKey);
      return null;
    }

    return session; // { username, timestamp } — no password
  } catch {
    return null;
  }
}

/**
 * Clears the stored session.
 */
export function clearCredentials(storageKey) {
  sessionStorage.removeItem(storageKey);
}

/**
 * Builds a Basic Auth header value from username + password.
 * Called at request time using the in-memory password from React state.
 */
export function getAuthHeader(username, password) {
  return `Basic ${btoa(`${username}:${password}`)}`;
}
