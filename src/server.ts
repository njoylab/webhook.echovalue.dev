import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import webhook from "./routes/webhook.js";
import api from "./routes/api.js";
import pages from "./routes/pages.js";

const app = new Hono();

// CORS for API endpoints
app.use("/api/*", cors());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Static files
app.use("/public/*", serveStatic({ root: "./" }));

// Routes
app.route("/", webhook);
app.route("/", api);
app.route("/", pages);

const port = parseInt(process.env.PORT || "3000", 10);

console.log(`🚀 EchoValue running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
