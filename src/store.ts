import { nanoid } from "nanoid";
import type { CapturedRequest, Session } from "./types.js";

const MAX_REQUESTS_PER_SESSION = 100;
export const MAX_SESSIONS = 10_000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

const sessions = new Map<string, Session>();

// Cleanup expired sessions periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.listeners.clear();
      sessions.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);

export function stopCleanup(): void {
  clearInterval(cleanupInterval);
}

export function clearSessions(): void {
  for (const session of sessions.values()) {
    session.listeners.clear();
  }
  sessions.clear();
}

export function createSession(): Session {
  if (sessions.size >= MAX_SESSIONS) {
    // Remove oldest session
    const oldest = sessions.keys().next().value;
    if (oldest) {
      sessions.get(oldest)?.listeners.clear();
      sessions.delete(oldest);
    }
  }

  const id = nanoid(12);
  const session: Session = {
    id,
    createdAt: Date.now(),
    requests: [],
    listeners: new Set(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function addRequest(
  sessionId: string,
  request: Omit<CapturedRequest, "id">,
): CapturedRequest | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Truncate body if too large
  let body = request.body;
  if (body && body.length > MAX_BODY_SIZE) {
    body = `${body.slice(0, MAX_BODY_SIZE)}\n... [truncated]`;
  }

  const captured: CapturedRequest = {
    ...request,
    body,
    id: nanoid(8),
  };

  session.requests.push(captured);

  // Keep only the latest requests
  if (session.requests.length > MAX_REQUESTS_PER_SESSION) {
    session.requests.shift();
  }

  // Snapshot listeners to avoid mutation during iteration
  for (const listener of [...session.listeners]) {
    listener(captured);
  }

  return captured;
}

export function addListener(sessionId: string, listener: (data: CapturedRequest) => void): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.listeners.add(listener);
  return true;
}

export function removeListener(sessionId: string, listener: (data: CapturedRequest) => void): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.listeners.delete(listener);
  }
}
