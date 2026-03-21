import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { getSession } from "../store.js";

const pages = new Hono();

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "..", "public");

let indexHtml: string;
let termsHtml: string;
try {
  indexHtml = readFileSync(join(publicDir, "index.html"), "utf-8");
} catch {
  indexHtml = "<h1>index.html not found</h1>";
}
try {
  termsHtml = readFileSync(join(publicDir, "terms.html"), "utf-8");
} catch {
  termsHtml = "<h1>terms.html not found</h1>";
}

// Landing page
pages.get("/", (c) => {
  return c.html(indexHtml);
});

// Inspector page (same HTML, client-side routing)
pages.get("/s/:id", (c) => {
  const session = getSession(c.req.param("id"));
  if (!session) {
    return c.html(indexHtml); // Let client handle 404
  }
  return c.html(indexHtml);
});

// Terms & Conditions
pages.get("/terms", (c) => {
  return c.html(termsHtml);
});

export default pages;
