import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import api from "../routes/api.js";
import webhook from "../routes/webhook.js";

// Build a test app with both routers
function buildApp() {
  const app = new Hono();
  app.route("/", api);
  app.route("/", webhook);
  return app;
}

async function json(res: Response) {
  return res.json();
}

describe("POST /api/sessions", () => {
  it("creates a session and returns id + webhookUrl", async () => {
    const app = buildApp();
    const res = await app.request("/api/sessions", { method: "POST" });
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.ok(body.id);
    assert.ok(body.webhookUrl);
    assert.ok(body.createdAt);
    assert.ok(body.webhookUrl.endsWith(`/w/${body.id}`));
  });
});

describe("GET /api/sessions/:id", () => {
  it("returns session data for a valid id", async () => {
    const app = buildApp();
    const created = await (await app.request("/api/sessions", { method: "POST" })).json() as { id: string };
    const res = await app.request(`/api/sessions/${created.id}`);
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.id, created.id);
    assert.deepEqual(body.requests, []);
  });

  it("returns 404 for unknown id", async () => {
    const app = buildApp();
    const res = await app.request("/api/sessions/does-not-exist");
    assert.equal(res.status, 404);
  });
});

describe("ANY /w/:id", () => {
  it("returns 404 for unknown session id", async () => {
    const app = buildApp();
    const res = await app.request("/w/ghost-id", { method: "POST", body: "{}" });
    assert.equal(res.status, 404);
  });

  it("captures a POST request with JSON body", async () => {
    const app = buildApp();
    const { id } = await (await app.request("/api/sessions", { method: "POST" })).json() as { id: string };

    const whRes = await app.request(`/w/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    assert.equal(whRes.status, 200);
    const ack = await whRes.json() as { status: string };
    assert.equal(ack.status, "ok");

    // Verify captured
    const session = await (await app.request(`/api/sessions/${id}`)).json() as { requests: Array<{ method: string; body: string }> };
    assert.equal(session.requests.length, 1);
    assert.equal(session.requests[0].method, "POST");
    assert.equal(session.requests[0].body, JSON.stringify({ hello: "world" }));
  });

  it("captures a GET request with query params", async () => {
    const app = buildApp();
    const { id } = await (await app.request("/api/sessions", { method: "POST" })).json() as { id: string };

    await app.request(`/w/${id}?foo=bar&baz=42`, { method: "GET" });

    const session = await (await app.request(`/api/sessions/${id}`)).json() as { requests: Array<{ method: string; queryParams: Record<string, string> }> };
    assert.equal(session.requests[0].method, "GET");
    assert.equal(session.requests[0].queryParams.foo, "bar");
    assert.equal(session.requests[0].queryParams.baz, "42");
  });

  it("captures PUT and DELETE methods", async () => {
    const app = buildApp();
    const { id } = await (await app.request("/api/sessions", { method: "POST" })).json() as { id: string };

    await app.request(`/w/${id}`, { method: "PUT", body: "updated" });
    await app.request(`/w/${id}`, { method: "DELETE" });

    const session = await (await app.request(`/api/sessions/${id}`)).json() as { requests: Array<{ method: string }> };
    assert.equal(session.requests.length, 2);
    assert.equal(session.requests[0].method, "PUT");
    assert.equal(session.requests[1].method, "DELETE");
  });
});

describe("GET /health", () => {
  it("returns 200 ok", async () => {
    const app = new Hono();
    app.get("/health", (c) => c.json({ status: "ok" }));
    const res = await app.request("/health");
    assert.equal(res.status, 200);
    const body = await res.json() as { status: string };
    assert.equal(body.status, "ok");
  });
});
