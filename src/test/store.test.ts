import assert from "node:assert/strict";
import { after, afterEach, describe, it } from "node:test";
import {
  addListener,
  addRequest,
  clearSessions,
  createSession,
  getSession,
  MAX_SESSIONS,
  removeListener,
  stopCleanup,
} from "../store.js";

describe("store", () => {
  after(() => {
    stopCleanup();
  });

  afterEach(() => {
    clearSessions();
  });

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

    it("evicts oldest session when MAX_SESSIONS is reached", () => {
      // Create exactly MAX_SESSIONS sessions
      const first = createSession();
      for (let i = 0; i < MAX_SESSIONS - 1; i++) {
        createSession();
      }
      // The first session should still exist
      assert.ok(getSession(first.id));

      // Create one more — should evict the first
      createSession();
      assert.equal(getSession(first.id), undefined);
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
      const req = {
        method: "GET",
        headers: {},
        body: null,
        queryParams: {},
        timestamp: Date.now(),
        contentType: null,
        ip: null,
        path: "/",
        size: 0,
      };
      const a = addRequest(session.id, req);
      const b = addRequest(session.id, req);
      assert.ok(a && b);
      assert.notEqual(a.id, b.id);
    });

    it("returns null for unknown session", () => {
      const result = addRequest("ghost-session", {
        method: "GET",
        headers: {},
        body: null,
        queryParams: {},
        timestamp: Date.now(),
        contentType: null,
        ip: null,
        path: "/",
        size: 0,
      });
      assert.equal(result, null);
    });

    it("truncates body exceeding 1MB", () => {
      const session = createSession();
      const bigBody = "x".repeat(1024 * 1024 + 100);
      const captured = addRequest(session.id, {
        method: "POST",
        headers: {},
        body: bigBody,
        queryParams: {},
        timestamp: Date.now(),
        contentType: null,
        ip: null,
        path: "/",
        size: bigBody.length,
      });
      assert.ok(captured?.body?.includes("[truncated]"));
    });

    it("notifies listeners when a request is added", () => {
      const session = createSession();
      let notified = false;
      const listener = () => {
        notified = true;
      };
      addListener(session.id, listener);
      addRequest(session.id, {
        method: "GET",
        headers: {},
        body: null,
        queryParams: {},
        timestamp: Date.now(),
        contentType: null,
        ip: null,
        path: "/",
        size: 0,
      });
      assert.ok(notified);
    });

    it("caps requests at 100 per session", () => {
      const session = createSession();
      const req = {
        method: "GET",
        headers: {},
        body: null,
        queryParams: {},
        timestamp: Date.now(),
        contentType: null,
        ip: null,
        path: "/",
        size: 0,
      };
      for (let i = 0; i < 105; i++) addRequest(session.id, req);
      assert.equal(session.requests.length, 100);
    });

    it("notifies all listeners even if one removes itself during iteration", () => {
      const session = createSession();
      const results: number[] = [];

      const listener1 = () => {
        results.push(1);
        removeListener(session.id, listener1);
      };
      const listener2 = () => {
        results.push(2);
      };
      const listener3 = () => {
        results.push(3);
      };

      addListener(session.id, listener1);
      addListener(session.id, listener2);
      addListener(session.id, listener3);

      addRequest(session.id, {
        method: "GET",
        headers: {},
        body: null,
        queryParams: {},
        timestamp: Date.now(),
        contentType: null,
        ip: null,
        path: "/",
        size: 0,
      });

      // All three listeners should have fired (snapshot protects iteration)
      assert.deepEqual(results.sort(), [1, 2, 3]);
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
      const listener = () => {
        count++;
      };
      addListener(session.id, listener);
      addRequest(session.id, {
        method: "GET",
        headers: {},
        body: null,
        queryParams: {},
        timestamp: Date.now(),
        contentType: null,
        ip: null,
        path: "/",
        size: 0,
      });
      removeListener(session.id, listener);
      addRequest(session.id, {
        method: "GET",
        headers: {},
        body: null,
        queryParams: {},
        timestamp: Date.now(),
        contentType: null,
        ip: null,
        path: "/",
        size: 0,
      });
      assert.equal(count, 1);
    });
  });
});
