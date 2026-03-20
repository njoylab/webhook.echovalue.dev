import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createSession, getSession, addRequest, addListener, removeListener } from "../store.js";

describe("store", () => {
  describe("createSession", () => {
    it("creates a session with a unique id", () => {
      const a = createSession();
      const b = createSession();
      assert.ok(a.id);
      assert.ok(b.id);
      assert.notEqual(a.id, b.id);
    });

    it("initializes with empty requests and no listeners", () => {
      const session = createSession();
      assert.deepEqual(session.requests, []);
      assert.equal(session.listeners.size, 0);
    });

    it("sets createdAt to approximately now", () => {
      const before = Date.now();
      const session = createSession();
      const after = Date.now();
      assert.ok(session.createdAt >= before && session.createdAt <= after);
    });
  });

  describe("getSession", () => {
    it("returns the session by id", () => {
      const session = createSession();
      assert.equal(getSession(session.id), session);
    });

    it("returns undefined for unknown id", () => {
      assert.equal(getSession("nonexistent-id"), undefined);
    });
  });

  describe("addRequest", () => {
    it("adds a request to the session", () => {
      const session = createSession();
      const req = {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"hello":"world"}',
        queryParams: {},
        timestamp: Date.now(),
        contentType: "application/json",
        ip: "1.2.3.4",
        path: `/w/${session.id}`,
        size: 17,
      };
      const captured = addRequest(session.id, req);
      assert.ok(captured);
      assert.equal(captured.method, "POST");
      assert.equal(captured.body, '{"hello":"world"}');
      assert.equal(session.requests.length, 1);
      assert.equal(session.requests[0].id, captured.id);
    });

    it("generates a unique id for each request", () => {
      const session = createSession();
      const req = { method: "GET", headers: {}, body: null, queryParams: {}, timestamp: Date.now(), contentType: null, ip: null, path: "/", size: 0 };
      const a = addRequest(session.id, req);
      const b = addRequest(session.id, req);
      assert.ok(a && b);
      assert.notEqual(a.id, b.id);
    });

    it("returns null for unknown session", () => {
      const result = addRequest("ghost-session", { method: "GET", headers: {}, body: null, queryParams: {}, timestamp: Date.now(), contentType: null, ip: null, path: "/", size: 0 });
      assert.equal(result, null);
    });

    it("truncates body exceeding 1MB", () => {
      const session = createSession();
      const bigBody = "x".repeat(1024 * 1024 + 100);
      const captured = addRequest(session.id, {
        method: "POST", headers: {}, body: bigBody, queryParams: {},
        timestamp: Date.now(), contentType: null, ip: null, path: "/", size: bigBody.length,
      });
      assert.ok(captured?.body?.includes("[truncated]"));
    });

    it("notifies listeners when a request is added", () => {
      const session = createSession();
      let notified = false;
      const listener = () => { notified = true; };
      addListener(session.id, listener);
      addRequest(session.id, { method: "GET", headers: {}, body: null, queryParams: {}, timestamp: Date.now(), contentType: null, ip: null, path: "/", size: 0 });
      assert.ok(notified);
    });

    it("caps requests at 100 per session", () => {
      const session = createSession();
      const req = { method: "GET", headers: {}, body: null, queryParams: {}, timestamp: Date.now(), contentType: null, ip: null, path: "/", size: 0 };
      for (let i = 0; i < 105; i++) addRequest(session.id, req);
      assert.equal(session.requests.length, 100);
    });
  });

  describe("addListener / removeListener", () => {
    it("returns true when adding to an existing session", () => {
      const session = createSession();
      const ok = addListener(session.id, () => {});
      assert.equal(ok, true);
    });

    it("returns false for unknown session", () => {
      const ok = addListener("ghost", () => {});
      assert.equal(ok, false);
    });

    it("removes a listener so it no longer receives events", () => {
      const session = createSession();
      let count = 0;
      const listener = () => { count++; };
      addListener(session.id, listener);
      addRequest(session.id, { method: "GET", headers: {}, body: null, queryParams: {}, timestamp: Date.now(), contentType: null, ip: null, path: "/", size: 0 });
      removeListener(session.id, listener);
      addRequest(session.id, { method: "GET", headers: {}, body: null, queryParams: {}, timestamp: Date.now(), contentType: null, ip: null, path: "/", size: 0 });
      assert.equal(count, 1);
    });
  });
});
