import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { rateLimit, stopRateLimitCleanup } from "./middleware/rate-limit.js";
import api from "./routes/api.js";
import pages from "./routes/pages.js";
import webhook from "./routes/webhook.js";
import { stopCleanup } from "./store.js";

const app = new Hono();

// CORS for API endpoints
app.use("/api/*", cors());

// Rate limiting for webhook and API endpoints
app.use("/api/*", rateLimit());
app.use("/w/*", rateLimit());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Static files
app.use("/public/*", serveStatic({ root: "./" }));

// Routes
app.route("/", webhook);
app.route("/", api);
app.route("/", pages);

const port = Number(process.env.PORT || "3000") || 3000;

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`🚀 EchoValue running on http://localhost:${port}`);
});

function shutdown() {
  console.log("Shutting down...");
  stopCleanup();
  stopRateLimitCleanup();
  server.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
