# EchoValue

Instant webhook testing. Get a unique URL, send requests, see them in real-time.

## Features

- **Unique webhook URLs** — each session gets an auto-generated URL (`/w/{id}`)
- **Real-time updates** — requests appear instantly via Server-Sent Events (SSE)
- **All HTTP methods** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Full request capture** — method, headers, body, query params, IP, timestamp
- **JSON pretty-printing** — JSON bodies are automatically formatted
- **Dark/light mode** — follows system preference
- **No database** — everything is in-memory; ephemeral by design
- **Self-hostable** — Docker image included

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | [Hono](https://hono.dev/) + [@hono/node-server](https://github.com/honojs/node-server) |
| Real-time | Server-Sent Events (SSE) |
| Frontend | Vanilla HTML / CSS / JS |
| ID generation | [nanoid](https://github.com/ai/nanoid) |
| Language | TypeScript |

## Getting Started

### Local development

```bash
npm install
npm run dev
```

Server starts on `http://localhost:3000` (configurable via `PORT` env var).

### Build for production

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t echovalue .
docker run -p 3000:3000 echovalue
```

## API

### `POST /api/sessions`

Creates a new webhook session.

**Response:**
```json
{
  "id": "r7-KFkXL3CDX",
  "webhookUrl": "https://echovalue.dev/w/r7-KFkXL3CDX",
  "createdAt": 1774010492479
}
```

### `GET /api/sessions/:id`

Returns session metadata and all captured requests.

**Response:**
```json
{
  "id": "r7-KFkXL3CDX",
  "createdAt": 1774010492479,
  "requests": [
    {
      "id": "vnCXB53U",
      "method": "POST",
      "headers": { "content-type": "application/json" },
      "body": "{\"hello\": \"world\"}",
      "queryParams": {},
      "timestamp": 1774010492495,
      "contentType": "application/json",
      "ip": "1.2.3.4",
      "path": "/w/r7-KFkXL3CDX",
      "size": 18
    }
  ]
}
```

### `GET /api/sessions/:id/stream`

SSE stream that pushes new requests in real-time.

**Events:**
- `ready` — stream is open and listening
- `request` — new request captured (same shape as above)
- `ping` — keepalive every 30 seconds

### `ANY /w/:id`

The webhook endpoint. Accepts any HTTP method. Returns `200 OK` immediately.

**Response:**
```json
{ "status": "ok", "message": "Webhook received" }
```

### `GET /health`

Health check endpoint for load balancers and container orchestrators.

**Response:**
```json
{ "status": "ok" }
```

## Limits

| Parameter | Value |
|---|---|
| Session TTL | 24 hours |
| Max requests per session | 100 |
| Max concurrent sessions | 10,000 |
| Max body size | 1 MB |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port to listen on |

## Deploy on Coolify

1. Push this repo to a Git provider (GitHub, GitLab, etc.)
2. In Coolify: **New Resource → Docker → Git Repository**
3. Set build method to **Dockerfile**
4. Add your domain (e.g. `echovalue.dev`)
5. Coolify handles SSL via Let's Encrypt and reverse proxy via Traefik automatically
6. Point your DNS A record to the Coolify server IP

## Self-hosting with Docker Compose

```yaml
services:
  echovalue:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
    environment:
      PORT: 3000
```

## License

MIT
