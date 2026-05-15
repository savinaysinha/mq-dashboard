// utils/credentials.js
// Handles saving, loading, clearing credentials in localStorage
// and building the Basic Auth header.

export function saveCredentials(username, password, storageKey) {
  const credentials = {
    username,
    password,
    timestamp: Date.now()
  };
  localStorage.setItem(storageKey, JSON.stringify(credentials));
}

export function loadCredentials(storageKey, expiryMs) {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;

    const credentials = JSON.parse(stored);
    if (Date.now() - credentials.timestamp > expiryMs) {
      localStorage.removeItem(storageKey);
      return null;
    }

    return credentials;
  } catch {
    return null;
  }
}

export function clearCredentials(storageKey) {
  localStorage.removeItem(storageKey);
}

export function getAuthHeader(username, password) {
  return `Basic ${btoa(`${username}:${password}`)}`;
}
