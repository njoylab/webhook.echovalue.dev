# EchoValue Webhook — CLAUDE.md

## What this project is

A free, open-source webhook relay and inspection tool at **webhook.echovalue.dev**. Users get a unique URL, send HTTP requests to it, and see them in real-time. No signup, no database, ephemeral by design. Built and maintained by [nJoyLab.com](https://njoylab.com).

## Tech stack

| Layer | Technology |
|---|---|
| Backend | [Hono](https://hono.dev/) + `@hono/node-server` |
| Real-time | Server-Sent Events (SSE) via `hono/streaming` |
| Frontend | Vanilla HTML / CSS / JS (no framework) |
| Language | TypeScript (ESM, `"type": "module"`) |
| ID generation | `nanoid` |
| Dev runner | `tsx watch` |
| Build | `tsc` → `dist/` |
| Deploy | Docker (multi-stage, `node:20-alpine`) on Coolify |

Runtime dependencies: only 3 (`hono`, `@hono/node-server`, `nanoid`).

## Project structure

```
src/
  server.ts          # Entry point — mounts all routes, starts server
  types.ts           # Session and CapturedRequest interfaces
  store.ts           # In-memory Map store, pub/sub listeners, TTL cleanup
  routes/
    webhook.ts       # app.all('/w/:id') — captures all HTTP methods
    api.ts           # POST/GET /api/sessions, GET /api/sessions/:id/stream (SSE)
    pages.ts         # Serves index.html, terms.html; reads files at startup
  test/
    store.test.ts    # Unit tests for store logic
    api.test.ts      # HTTP integration tests using Hono's app.request()

public/
  index.html         # Single HTML shell (serves both / and /s/:id)
  app.js             # Client-side routing, SSE consumer, DOM rendering
  styles.css         # CSS vars, dark/light mode, all component styles
  terms.html         # Standalone Terms & Conditions page
  favicon.ico        # Multi-size favicon (16+32px)
  favicon.png        # 32×32 PNG favicon
  favicon-64.png     # 64×64 PNG favicon (retina)
```

## Key commands

```bash
npm run dev      # tsx watch src/server.ts — hot reload on port $PORT (default 3000)
npm run build    # tsc → dist/
npm start        # node dist/server.js — production
npm test         # tsx --test src/test/*.test.ts
```

Node.js is managed via nvm. Always source nvm before running commands:
```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
```

## Runtime limits (defined in src/store.ts)

| Constant | Value | Description |
|---|---|---|
| `MAX_REQUESTS_PER_SESSION` | 100 | Oldest request discarded when exceeded |
| `MAX_SESSIONS` | 10,000 | Oldest session evicted when exceeded |
| `SESSION_TTL_MS` | 24h | Sessions auto-expire |
| `CLEANUP_INTERVAL_MS` | 5 min | Interval for expired session cleanup |
| `MAX_BODY_SIZE` | 1 MB | Larger bodies truncated with `[truncated]` marker |

## API surface

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sessions` | Create session → `{ id, webhookUrl, createdAt }` |
| `GET` | `/api/sessions/:id` | Get session + all captured requests |
| `GET` | `/api/sessions/:id/stream` | SSE stream (events: `ready`, `request`, `ping`) |
| `ANY` | `/w/:id` | Webhook endpoint — captures all HTTP methods |
| `GET` | `/health` | Health check → `{ status: "ok" }` |
| `GET` | `/` | Landing page (auto-creates session + redirects) |
| `GET` | `/s/:id` | Inspector page |
| `GET` | `/terms` | Terms & Conditions |

## Frontend routing

`app.js` uses `window.location.pathname` to decide what to render:
- `/` → `createAndRedirect()` — creates session via API, then `window.location.replace('/s/{id}')`
- `/s/:id` → `renderInspector(sessionId)` — SSE listener + request card rendering
- `/terms` → served directly as `terms.html` (no JS routing)

Static assets (`public/`) are served via `serveStatic` at `/public/*`.

## SSE lifecycle

1. Client opens `EventSource('/api/sessions/:id/stream')`
2. Server sends all existing requests as `request` events
3. Server sends `ready` event
4. New webhook requests trigger listener callbacks → immediate SSE push
5. Server sends `ping` every 30s to keep the connection alive
6. On client disconnect (`onAbort`): listener removed from session, ping interval cleared

## Dark/light mode

CSS uses `prefers-color-scheme` as base + `data-theme` attribute override (set by `app.js` via `localStorage`). Theme toggle button is injected into `document.body` by `initTheme()` in `app.js`.

## Deploy (Coolify)

- Build method: **Dockerfile** (multi-stage, `node:20-alpine`)
- Port: `3000` (override with `PORT` env var)
- Health check: `GET /health`
- Coolify handles SSL (Let's Encrypt) and reverse proxy (Traefik)
- DNS: A record for `webhook.echovalue.dev` → Coolify server IP

## Design decisions to preserve

- **No database** — all state is in-memory, intentionally ephemeral
- **No authentication** — sessions are public; anyone with the URL can view requests
- **Vanilla JS frontend** — no build step for the frontend, keeps it simple
- **Raw body capture** — always use `c.req.text()` to get the raw body, never parse JSON server-side
- **SSE over WebSocket** — communication is server-to-client only; SSE is simpler and sufficient
- **`window.location.replace`** for the redirect — avoids polluting browser history
