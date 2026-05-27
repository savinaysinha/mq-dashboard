# MQ Dashboard

A real-time IBM MQ Administrative Dashboard built with **React** (frontend) and **Express** (backend proxy).

---

## Project Structure

```
mq-dashboard/
├── backend/
│   ├── server.js           ← Express entry point
│   ├── config.js           ← Loads config.json, exports constants
│   ├── routes/
│   │   ├── configRoute.js  ← GET /api/config
│   │   └── qmgrRoutes.js   ← All /api/qmgr/* endpoints
│   └── utils/
│       ├── auth.js         ← Basic Auth middleware
│       └── mqParser.js     ← MQ response parsers
├── frontend/
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── components/     ← LoginDialog, QueueManagerCard, SummaryGrid
│       ├── hooks/          ← useMqData (all state + API logic)
│       ├── utils/          ← credentials.js, mqHelpers.js
│       └── data/           ← initialData.js
├── config.json             ← Queue manager config (edit this)
└── package.json
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- Access to IBM MQ REST API servers

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure queue managers
Edit `config.json` and update the `queueManagers` array with your real server details:
```json
{
  "queueManagers": [
    {
      "name": "prod_emea",
      "baseUrl": "https://your-mq-server.internal",
      "qmName": "YOUR_QM_NAME"
    }
  ]
}
```

| Field     | Description                                    |
|-----------|------------------------------------------------|
| `name`    | Friendly label used internally                 |
| `baseUrl` | Base URL of the IBM MQ REST API server         |
| `qmName`  | Queue manager name as known to MQ (e.g. QM_1) |

### 3. Other config options (`config.json`)

| Field                             | Default         | Description                               |
|-----------------------------------|-----------------|-------------------------------------------|
| `server.port`                     | `3000`          | Express server port                       |
| `server.mqFilter`                 | `"IS"`        | Filter string for queue manager names     |
| `server.credentialExpiryHours`    | `4`             | Session expiry (username only persisted)  |
| `server.DefaultListenerKeyword`   | `"APP"`         | Keyword to match the MQ listener name     |
| `ui.refreshIntervalSeconds`       | `60`            | Auto-refresh interval                     |
| `ui.mqWebConsoleSuffix`           | `"/ibmmq/console/"` | Suffix appended to baseUrl for console link |

---

## Running

### Development (two terminals)

**Terminal 1 — React frontend** (with hot reload):
```bash
npm run dev
```

**Terminal 2 — Express backend**:
```bash
npm run dev:server
```

The Vite dev server proxies `/api/*` requests to `http://localhost:3000` automatically.

### Production
```bash
npm run build     # Build React frontend into /public
npm start         # Start Express server (serves /public + API)
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Security Notes

- **Passwords are never persisted.** Only the username is stored in `sessionStorage` (cleared on tab close). The password lives in React state only.
- **`config.json` `baseUrl` values are never sent to the browser.** The API strips them before responding.
- `NODE_TLS_REJECT_UNAUTHORIZED=0` is set via `cross-env` in the `start` and `dev:server` scripts to allow self-signed MQ server certificates. Remove this flag if your MQ servers use valid CA-signed certificates.

---

## Login

Enter your Active Directory / IBM MQ credentials in the login dialog. These are forwarded as HTTP Basic Auth to the MQ REST API — the Express server acts purely as a proxy and never stores credentials.
