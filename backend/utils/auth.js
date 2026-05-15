// utils/auth.js
// Helpers for reading and building Basic Auth credentials.

/**
 * Extracts username and password from an incoming request's
 * Authorization: Basic <base64> header.
 *
 * Returns { username, password } or null if the header is absent / malformed.
 */
export function getCredentials(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');
    return { username, password };
  }
  return null;
}

/**
 * Builds a Base64-encoded Basic Auth string suitable for upstream requests.
 *
 * @param {string} username
 * @param {string} password
 * @returns {string}  e.g. "dXNlcjpwYXNz"
 */
export function buildBasicAuth(username, password) {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

/**
 * Express middleware that rejects requests without valid Basic Auth credentials.
 * Attaches `req.credentials` and `req.basicAuth` for downstream handlers.
 */
export function requireAuth(req, res, next) {
  const credentials = getCredentials(req);
  if (!credentials?.username || !credentials?.password) {
    return res.status(401).json({
      error: 'Authentication required. Please provide MQ credentials.',
    });
  }
  req.credentials = credentials;
  req.basicAuth = buildBasicAuth(credentials.username, credentials.password);
  next();
}
