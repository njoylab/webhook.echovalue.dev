// EchoValue - Client-side application
(function () {
  const path = window.location.pathname;
  const app = document.getElementById("app");

  // Theme management
  function getEffectiveTheme() {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function updateThemeBtn(btn) {
    const isDark = getEffectiveTheme() === "dark";
    btn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
    btn.innerHTML = isDark
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  }

  function initTheme() {
    applyTheme(getEffectiveTheme());
    const btn = document.createElement("button");
    btn.id = "theme-btn";
    btn.className = "btn-theme";
    updateThemeBtn(btn);
    btn.addEventListener("click", () => {
      const next = getEffectiveTheme() === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      applyTheme(next);
      updateThemeBtn(btn);
    });
    document.body.appendChild(btn);
  }

  initTheme();

  if (path.startsWith("/s/")) {
    const sessionId = path.split("/s/")[1];
    renderInspector(sessionId);
  } else {
    createAndRedirect();
  }

  async function createAndRedirect() {
    app.innerHTML = `<div class="landing"><p style="color:var(--text-secondary)">Creating webhook...</p></div>${renderFooter()}`;
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      const data = await res.json();
      window.location.replace("/s/" + data.id);
    } catch {
      app.innerHTML = `<div class="landing"><p style="color:var(--text-secondary)">Failed to create session. <a href="/" style="color:var(--accent)">Retry</a></p></div>${renderFooter()}`;
    }
  }

  function renderInspector(sessionId) {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const webhookUrl = `${protocol}//${host}/w/${sessionId}`;

    app.innerHTML = `
      <div class="inspector">
        <a href="/" class="back-link">&larr; New webhook</a>
        <div class="inspector-header">
          <h2>Webhook Inspector</h2>
          <div class="webhook-url-box">
            <span class="webhook-url" id="webhook-url">${webhookUrl}</span>
            <button class="btn-copy" id="copy-btn">Copy</button>
          </div>
          <div class="status">
            <span class="status-dot" id="status-dot"></span>
            <span id="status-text">Connecting...</span>
          </div>
        </div>
        <div class="request-list" id="request-list">
          <div class="empty-state" id="empty-state">
            <p>Waiting for requests...</p>
            <p>Send a request to your webhook URL:</p>
            <div class="curl-command">
              <code id="curl-code">curl -X POST -H "Content-Type: application/json" -d '{"hello": "world"}' ${webhookUrl}</code>
              <button class="btn-copy-curl" id="copy-curl-btn" title="Copy curl command">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      ${renderInfoSection()}
      ${renderFooter()}
    `;

    // Copy button
    document.getElementById("copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(webhookUrl).then(() => {
        const btn = document.getElementById("copy-btn");
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      });
    });

    // Copy curl command button
    const curlBtn = document.getElementById("copy-curl-btn");
    if (curlBtn) {
      curlBtn.addEventListener("click", () => {
        const curlCode = document.getElementById("curl-code");
        navigator.clipboard.writeText(curlCode.textContent).then(() => {
          curlBtn.classList.add("copied");
          setTimeout(() => curlBtn.classList.remove("copied"), 1500);
        });
      });
    }

    // SSE connection
    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);
    const statusDot = document.getElementById("status-dot");
    const statusText = document.getElementById("status-text");

    eventSource.addEventListener("ready", () => {
      statusDot.classList.remove("disconnected");
      statusText.textContent = "Connected - listening for requests";
    });

    eventSource.addEventListener("request", (e) => {
      const data = JSON.parse(e.data);
      addRequestCard(data);
    });

    eventSource.addEventListener("error", () => {
      statusDot.classList.add("disconnected");
      statusText.textContent = "Disconnected - reconnecting...";
    });

    eventSource.addEventListener("open", () => {
      statusDot.classList.remove("disconnected");
      statusText.textContent = "Connected - listening for requests";
    });
  }

  function addRequestCard(req) {
    const emptyState = document.getElementById("empty-state");
    if (emptyState) emptyState.remove();

    const list = document.getElementById("request-list");
    const card = document.createElement("div");
    card.className = "request-card";
    card.innerHTML = buildCardHTML(req);

    // Insert at the top
    list.prepend(card);

    // Toggle expand
    card.querySelector(".request-card-header").addEventListener("click", () => {
      card.classList.toggle("expanded");
    });
  }

  function buildCardHTML(req) {
    const time = new Date(req.timestamp).toLocaleTimeString();
    const methodClass = `method-${req.method}`;
    const sizeStr = formatSize(req.size);

    let bodySection = "";
    if (req.body) {
      let formattedBody = req.body;
      if (req.contentType && req.contentType.includes("json")) {
        try {
          formattedBody = JSON.stringify(JSON.parse(req.body), null, 2);
        } catch {
          // Keep as-is
        }
      }
      bodySection = `
        <div class="section-title">Body</div>
        <div class="code-block">${escapeHtml(formattedBody)}</div>
      `;
    }

    let querySection = "";
    const queryKeys = Object.keys(req.queryParams || {});
    if (queryKeys.length > 0) {
      const params = queryKeys
        .map(
          (k) => `<span class="query-param"><span class="query-param-key">${escapeHtml(k)}</span><span class="query-param-value">${escapeHtml(req.queryParams[k])}</span></span>`
        )
        .join("");
      querySection = `
        <div class="section-title">Query Parameters</div>
        <div class="query-params">${params}</div>
      `;
    }

    const headerRows = Object.entries(req.headers || {})
      .map(
        ([k, v]) =>
          `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`
      )
      .join("");

    return `
      <div class="request-card-header">
        <span class="method-badge ${methodClass}">${req.method}</span>
        <div class="request-meta">
          <span class="request-time">${time}</span>
          ${sizeStr ? `<span class="request-size">${sizeStr}</span>` : ""}
        </div>
        <span class="expand-icon">&#9654;</span>
      </div>
      <div class="request-card-body">
        ${querySection}
        ${bodySection}
        <div class="section-title">Headers</div>
        <table class="header-table">
          ${headerRows}
        </table>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function renderInfoSection() {
    return `
      <div class="info-section">
        <h3>How it works &amp; Fair Usage</h3>
        <div class="info-grid">
          <div class="info-card">
            <strong>How it works</strong>
            <p>Each session gets a unique URL. Any HTTP request sent to that URL - GET, POST, PUT, DELETE and more - is instantly captured and displayed here in real-time via Server-Sent Events.</p>
          </div>
          <div class="info-card">
            <strong>Data retention</strong>
            <p>Sessions and all captured requests are stored in memory only. Data is automatically deleted after <strong>24 hours</strong>. We store no data on disk and run no database.</p>
          </div>
          <div class="info-card">
            <strong>Request limits</strong>
            <p>Up to <strong>100 requests</strong> are stored per session. Request bodies are capped at <strong>1 MB</strong>. Older requests are discarded once the limit is reached.</p>
          </div>
          <div class="info-card">
            <strong>Fair usage</strong>
            <p>This is a free tool. Please do not use it for spam, abuse, or high-volume automated testing. Excessive use may result in rate limiting. See <a href="/terms">Terms &amp; Conditions</a>.</p>
          </div>
        </div>
      </div>
    `;
  }

  function renderFooter() {
    return `
      <footer class="site-footer">
        <span>Built by <a href="https://njoylab.com" class="footer-brand" target="_blank" rel="noopener">nJoyLab.com</a></span>
        <span class="footer-sep">·</span>
        <a href="https://www.echovalue.dev/#tools" target="_blank" rel="noopener">More Tools</a>
        <span class="footer-sep">·</span>
        <a href="https://github.com/njoylab/webhook.echovalue.dev" target="_blank" rel="noopener">GitHub</a>
        <span class="footer-sep">·</span>
        <a href="/terms">Terms &amp; Conditions</a>
      </footer>
    `;
  }
})();
