import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { addListener, createSession, getSession, removeListener } from "../store.js";
import type { CapturedRequest } from "../types.js";

const api = new Hono();

// Create a new session
api.post("/api/sessions", (c) => {
  const session = createSession();
  const protocol = c.req.header("x-forwarded-proto") || "http";
  const host = c.req.header("host") || "localhost:3000";
  const webhookUrl = `${protocol}://${host}/w/${session.id}`;

  return c.json({
    id: session.id,
    webhookUrl,
    createdAt: session.createdAt,
  });
});

// Get session info + existing requests
api.get("/api/sessions/:id", (c) => {
  const session = getSession(c.req.param("id"));
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({
    id: session.id,
    createdAt: session.createdAt,
    requests: session.requests,
  });
});

// SSE stream for real-time updates
api.get("/api/sessions/:id/stream", (c) => {
  const sessionId = c.req.param("id");
  const session = getSession(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Disable proxy buffering so SSE events are flushed immediately
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("X-Accel-Buffering", "no");
  c.header("Connection", "keep-alive");

  return streamSSE(c, async (stream) => {
    // Send existing requests first
    for (const req of session.requests) {
      await stream.writeSSE({
        event: "request",
        data: JSON.stringify(req),
        id: req.id,
      });
    }

    // Send a ready event
    await stream.writeSSE({
      event: "ready",
      data: JSON.stringify({ sessionId }),
    });

    // Force upstream proxies (Cloudflare, Traefik, etc.) to flush the response
    // by sending a padding comment that exceeds typical buffer thresholds
    await stream.write(`:${" ".repeat(2048)}\n\n`);

    // Listen for new requests
    const listener = async (data: CapturedRequest) => {
      try {
        await stream.writeSSE({
          event: "request",
          data: JSON.stringify(data),
          id: data.id,
        });
      } catch {
        // Stream closed, listener will be removed on abort
      }
    };

    addListener(sessionId, listener);

    // Keep the stream alive with periodic pings
    const pingInterval = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: "ping",
          data: JSON.stringify({ time: Date.now() }),
        });
      } catch {
        clearInterval(pingInterval);
      }
    }, 30_000);

    // Cleanup on disconnect
    stream.onAbort(() => {
      clearInterval(pingInterval);
      removeListener(sessionId, listener);
    });

    // Keep stream open
    await new Promise(() => {});
  });
});

export default api;
