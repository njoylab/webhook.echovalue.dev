// EchoValue - Client-side application
(() => {
  const path = window.location.pathname;
  const app = document.getElementById("app");

  // ==========================================
  // Theme management
  // ==========================================

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

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (!localStorage.getItem("theme")) {
        applyTheme(getEffectiveTheme());
        updateThemeBtn(btn);
      }
    });
  }

  initTheme();

  // ==========================================
  // Routing
  // ==========================================

  if (path.startsWith("/s/")) {
    const sessionId = path.match(/\/s\/([^/]+)/)?.[1] || "";
    validateAndRender(sessionId);
  } else {
    createAndRedirect();
  }

  async function validateAndRender(sessionId) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.status === 404) {
        app.innerHTML = `
          <div class="landing">
            <h1 style="font-size:2rem">Session not found</h1>
            <p style="color:var(--text-secondary)">This session may have expired or never existed. Sessions expire after 24 hours.</p>
            <a href="/" class="btn" style="display:inline-block;margin-top:1rem;text-decoration:none">Create a new webhook</a>
          </div>
          ${renderFooter()}
        `;
        return;
      }
      renderInspector(sessionId);
    } catch {
      renderInspector(sessionId);
    }
  }

  async function createAndRedirect() {
    app.innerHTML = `<div class="landing"><p style="color:var(--text-secondary)">Creating webhook...</p></div>${renderFooter()}`;
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      const data = await res.json();
      window.location.replace(`/s/${data.id}`);
    } catch {
      app.innerHTML = `<div class="landing"><p style="color:var(--text-secondary)">Failed to create session. <a href="/" style="color:var(--accent)">Retry</a></p></div>${renderFooter()}`;
    }
  }

  // ==========================================
  // Inspector — Split View
  // ==========================================

  let requests = [];
  let selectedId = null;
  let hasReceivedFirstRequest = false;

  function renderInspector(sessionId) {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const webhookUrl = `${protocol}//${host}/w/${sessionId}`;

    app.innerHTML = `
      <div class="inspector-wrapper">
        <div class="inspector-layout">
          <div class="inspector-sidebar">
            <div class="sidebar-header">
              <div class="sidebar-header-row">
                <h2>
                  <span class="sidebar-brand">echo<span>value</span></span>
                  <span class="sidebar-count" id="request-count">0</span>
                </h2>
                <div class="sidebar-actions">
                  <button class="btn-new-session" id="clear-btn" title="Clear history">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Clear
                  </button>
                  <a href="/" class="btn-new-session" title="Create new session">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    New
                  </a>
                </div>
              </div>
              <div class="sidebar-url-box">
                <span class="sidebar-url" title="${escapeHtml(webhookUrl)}">${escapeHtml(webhookUrl)}</span>
                <button class="btn-copy-url" id="copy-btn" title="Copy URL">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                </button>
              </div>
              <div class="sidebar-status">
                <span class="status-dot" id="status-dot"></span>
                <span id="status-text">Connecting...</span>
              </div>
            </div>
            <div class="request-list-sidebar" id="request-list-sidebar">
              <div class="sidebar-empty" id="sidebar-empty">
                <div class="sidebar-empty-icon">&#9678;</div>
                <p>Waiting for requests...</p>
              </div>
            </div>
          </div>
          <div class="detail-panel" id="detail-panel">
            <div class="detail-body-scroll" id="detail-body">
              <div id="detail-empty-content">
                <div class="empty-curl-section">
                  <div class="detail-section-title">Try it out</div>
                  <p class="empty-hint">Send a request to your webhook URL to see it appear here in real-time.</p>
                  <div class="curl-block">
                    <code id="curl-code">curl -X POST ${escapeHtml(webhookUrl)} \\
  -H "Content-Type: application/json" \\
  -d '{"hello": "world"}'</code>
                    <button class="btn-copy-curl" id="copy-curl-btn" title="Copy curl command">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                    </button>
                  </div>
                </div>
                ${renderInfoSection()}
              </div>
              <div id="detail-request-content" style="display:none"></div>
              <div id="detail-info-collapsible" style="display:none">
                ${renderInfoSection(true)}
              </div>
            </div>
          </div>
        </div>
        ${renderFooter()}
      </div>
    `;

    // Reset state
    requests = [];
    selectedId = null;

    // Copy URL button
    document.getElementById("copy-btn").addEventListener("click", () => {
      navigator.clipboard
        .writeText(webhookUrl)
        .then(() => {
          const btn = document.getElementById("copy-btn");
          btn.classList.add("copied");
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          setTimeout(() => {
            btn.classList.remove("copied");
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`;
          }, 1500);
        })
        .catch(() => {});
    });

    // Copy curl command button
    document.getElementById("copy-curl-btn")?.addEventListener("click", () => {
      const curlCode = document.getElementById("curl-code");
      navigator.clipboard
        .writeText(curlCode.textContent)
        .then(() => {
          const btn = document.getElementById("copy-curl-btn");
          btn.classList.add("copied");
          setTimeout(() => btn.classList.remove("copied"), 1500);
        })
        .catch(() => {});
    });

    // Close info button (in collapsible section)
    document.getElementById("close-info-btn")?.addEventListener("click", () => {
      const collapsible = document.getElementById("detail-info-collapsible");
      if (collapsible) collapsible.style.display = "none";
    });

    // Clear history button
    document.getElementById("clear-btn").addEventListener("click", () => {
      requests = [];
      selectedId = null;
      hasReceivedFirstRequest = false;

      // Reset sidebar
      const list = document.getElementById("request-list-sidebar");
      list.innerHTML = `
        <div class="sidebar-empty" id="sidebar-empty">
          <div class="sidebar-empty-icon">&#9678;</div>
          <p>Waiting for requests...</p>
        </div>
      `;
      document.getElementById("request-count").textContent = "0";

      // Reset detail panel to empty state
      document.getElementById("detail-empty-content").style.display = "block";
      document.getElementById("detail-request-content").style.display = "none";
      document.getElementById("detail-request-content").innerHTML = "";
      document.getElementById("detail-info-collapsible").style.display = "none";
    });

    // SSE connection
    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);
    const statusDot = document.getElementById("status-dot");
    const statusText = document.getElementById("status-text");

    eventSource.addEventListener("ready", () => {
      statusDot.classList.remove("disconnected");
      statusText.textContent = "Connected";
    });

    eventSource.addEventListener("request", (e) => {
      try {
        const data = JSON.parse(e.data);
        addRequest(data);
      } catch {
        // skip malformed
      }
    });

    eventSource.addEventListener("error", () => {
      statusDot.classList.add("disconnected");
      statusText.textContent = "Reconnecting...";
    });

    eventSource.addEventListener("open", () => {
      statusDot.classList.remove("disconnected");
      statusText.textContent = "Listening";
    });
  }

  // ==========================================
  // Request management
  // ==========================================

  function addRequest(req) {
    requests.push(req);

    // Remove sidebar empty state
    const emptyState = document.getElementById("sidebar-empty");
    if (emptyState) emptyState.remove();

    // On first request: hide empty content, show request content + collapsible info
    if (!hasReceivedFirstRequest) {
      hasReceivedFirstRequest = true;
      const emptyContent = document.getElementById("detail-empty-content");
      if (emptyContent) emptyContent.style.display = "none";
      const requestContent = document.getElementById("detail-request-content");
      if (requestContent) requestContent.style.display = "block";
      const collapsible = document.getElementById("detail-info-collapsible");
      if (collapsible) collapsible.style.display = "block";
    }

    // Add sidebar entry
    const list = document.getElementById("request-list-sidebar");
    const entry = createSidebarEntry(req, true);
    list.prepend(entry);

    // Update count
    const countEl = document.getElementById("request-count");
    if (countEl) countEl.textContent = requests.length;

    // Auto-select if nothing is selected
    if (selectedId === null) {
      selectRequest(req.id);
    }
  }

  function selectRequest(id) {
    selectedId = id;

    // Update sidebar selection
    const entries = document.querySelectorAll(".sidebar-entry");
    entries.forEach((el) => {
      el.classList.toggle("selected", el.dataset.id === id);
    });

    // Render detail
    const req = requests.find((r) => r.id === id);
    if (req) {
      renderDetail(req);
    }
  }

  // ==========================================
  // Sidebar entry
  // ==========================================

  function createSidebarEntry(req, isNew) {
    const time = new Date(req.timestamp).toLocaleTimeString();
    const sizeStr = formatSize(req.size);

    const entry = document.createElement("div");
    entry.className = `sidebar-entry${isNew ? " new-arrival" : ""}${req.id === selectedId ? " selected" : ""}`;
    entry.dataset.id = req.id;
    entry.tabIndex = 0;

    entry.innerHTML = `
      <span class="entry-method method-${req.method}">${escapeHtml(req.method)}</span>
      <div class="entry-info">
        <div class="entry-path">${escapeHtml(req.path || "/")}</div>
        <div class="entry-meta">
          <span>${time}</span>
          ${sizeStr ? `<span class="entry-size">${sizeStr}</span>` : ""}
        </div>
      </div>
    `;

    entry.addEventListener("click", () => selectRequest(req.id));
    entry.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectRequest(req.id);
      }
    });

    return entry;
  }

  // ==========================================
  // Detail panel
  // ==========================================

  function renderDetail(req) {
    const container = document.getElementById("detail-request-content");
    const time = new Date(req.timestamp).toLocaleTimeString();
    const sizeStr = formatSize(req.size);

    let bodySection = "";
    if (req.body) {
      let formattedBody = req.body;
      if (req.contentType?.includes("json")) {
        try {
          formattedBody = JSON.stringify(JSON.parse(req.body), null, 2);
        } catch {
          // keep raw
        }
      }
      bodySection = `
        <div class="detail-section">
          <div class="detail-section-title">Body</div>
          <div class="code-block">${escapeHtml(formattedBody)}</div>
        </div>
      `;
    }

    let querySection = "";
    const queryKeys = Object.keys(req.queryParams || {});
    if (queryKeys.length > 0) {
      const params = queryKeys
        .map(
          (k) =>
            `<span class="query-param"><span class="query-param-key">${escapeHtml(k)}</span><span class="query-param-value">${escapeHtml(req.queryParams[k])}</span></span>`,
        )
        .join("");
      querySection = `
        <div class="detail-section">
          <div class="detail-section-title">Query Parameters</div>
          <div class="query-params">${params}</div>
        </div>
      `;
    }

    const headerRows = Object.entries(req.headers || {})
      .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
      .join("");

    container.innerHTML = `
      <div class="detail-header">
        <div class="detail-method-row">
          <span class="detail-method method-${req.method}">${escapeHtml(req.method)}</span>
          <span class="detail-time">${time}</span>
          ${sizeStr ? `<span class="detail-size">${sizeStr}</span>` : ""}
        </div>
        <div class="detail-ip">${escapeHtml(req.path || "/")}${req.ip ? ` &middot; ${escapeHtml(req.ip)}` : ""}</div>
      </div>
      <div class="detail-section">
        ${querySection}
        ${bodySection}
        <div class="detail-section">
          <div class="detail-section-title">Headers</div>
          <table class="header-table">
            ${headerRows}
          </table>
        </div>
      </div>
    `;
  }

  // ==========================================
  // Utilities
  // ==========================================

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderInfoSection(closable) {
    return `
      <div class="info-section">
        <div class="info-section-header">
          <h3>How it works &amp; Fair Usage</h3>
          ${closable ? `<button class="btn-close-info" id="close-info-btn" title="Close">&times;</button>` : ""}
        </div>
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
