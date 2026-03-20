import { Hono } from "hono";
import { addRequest, getSession } from "../store.js";

const webhook = new Hono();

webhook.all("/w/:id", async (c) => {
  const id = c.req.param("id");
  const session = getSession(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Capture headers
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Capture query params
  const url = new URL(c.req.url);
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  // Capture body (raw text, regardless of content type)
  let body: string | null = null;
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    try {
      body = await c.req.text();
    } catch {
      body = null;
    }
  }

  const contentType = headers["content-type"] || null;
  const ip =
    (c.req.header("x-forwarded-for") || "").split(",")[0].trim() ||
    c.req.header("x-real-ip") ||
    null;

  addRequest(id, {
    method: c.req.method,
    headers,
    body,
    queryParams,
    timestamp: Date.now(),
    contentType,
    ip,
    path: url.pathname + url.search,
    size: body ? body.length : 0,
  });

  return c.json({ status: "ok", message: "Webhook received" });
});

export default webhook;
