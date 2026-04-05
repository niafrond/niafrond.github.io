// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "copilot-dev-settings";
const HISTORY_KEY = "copilot-dev-history";
const CORS_PROXY = "https://corsproxy.io/?url=";
const MODELS_API = "https://models.inference.ai.azure.com/chat/completions";
const TEXT_EXTENSIONS = new Set([
  "js", "ts", "jsx", "tsx", "mjs", "cjs",
  "html", "htm", "css", "scss", "sass", "less",
  "json", "jsonc", "yaml", "yml", "toml", "xml",
  "md", "mdx", "txt", "rst",
  "py", "rb", "php", "java", "kt", "swift", "go", "rs",
  "c", "cpp", "cc", "h", "hpp",
  "sh", "bash", "zsh", "fish",
  "sql", "graphql", "gql",
  "env", "gitignore", "dockerfile", "makefile",
  "vue", "svelte",
]);

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  token: "",
  clientId: "",
  user: null,
  repo: { owner: "", name: "", branch: "" },
  pendingFiles: [],           // [{ path, content, action, originalContent }]
  deviceFlowAbort: null,
};

// ─── DOM refs ─────────────────────────────────────────────────────────────── 

const $ = (id) => document.getElementById(id);

const els = {
  // Auth
  btnLogin: $("btn-login"),
  btnLogout: $("btn-logout"),
  btnUseManualToken: $("btn-use-manual-token"),
  tokenManual: $("token-manual"),
  clientId: $("client-id"),
  authLoggedOut: $("auth-logged-out"),
  authLoggedIn: $("auth-logged-in"),
  userAvatar: $("user-avatar"),
  userLogin: $("user-login"),
  deviceFlowBanner: $("device-flow-banner"),
  deviceFlowUrl: $("device-flow-url"),
  deviceFlowCode: $("device-flow-code"),
  deviceFlowStatus: $("device-flow-status"),
  btnCopyCode: $("btn-copy-code"),
  btnCancelFlow: $("btn-cancel-flow"),
  // Repo
  repoSearch: $("repo-search"),
  btnSearchRepos: $("btn-search-repos"),
  repoOwner: $("repo-owner"),
  repoName: $("repo-name"),
  branchSelect: $("branch-select"),
  btnLoadBranches: $("btn-load-branches"),
  btnUseRepo: $("btn-use-repo"),
  repoStatus: $("repo-status"),
  currentRepoCard: $("current-repo-card"),
  currentRepoName: $("current-repo-name"),
  currentRepoBranch: $("current-repo-branch"),
  reposList: $("repos-list"),
  // Prompt
  promptInput: $("prompt-input"),
  includeReadme: $("include-readme"),
  contextFilePath: $("context-file-path"),
  btnAddFile: $("btn-add-file"),
  contextFilesList: $("context-files-list"),
  promptNoRepo: $("prompt-no-repo"),
  btnSendPrompt: $("btn-send-prompt"),
  btnSendLabel: $("btn-send-label"),
  btnSendSpinner: $("btn-send-spinner"),
  // Review
  reviewFiles: $("review-files"),
  reviewEmpty: $("review-empty"),
  commitSection: $("commit-section"),
  commitMessage: $("commit-message"),
  prBranchRow: $("pr-branch-row"),
  prBranchName: $("pr-branch-name"),
  btnApply: $("btn-apply"),
  btnApplyLabel: $("btn-apply-label"),
  btnApplySpinner: $("btn-apply-spinner"),
  applyResult: $("apply-result"),
  // History
  historyList: $("history-list"),
  historyEmpty: $("history-empty"),
  btnClearHistory: $("btn-clear-history"),
};

// Context files selected by the user
let contextFiles = [];

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettings(patch) {
  const current = loadSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

function addHistoryItem(item) {
  const history = loadHistory();
  history.unshift({ ...item, ts: Date.now() });
  saveHistory(history.slice(0, 50));
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function authHeaders(extra = {}) {
  const h = { Accept: "application/vnd.github+json", ...extra };
  if (state.token) h.Authorization = `Bearer ${state.token}`;
  return h;
}

async function fetchUser(token) {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`Auth GitHub échouée (${res.status})`);
  return res.json();
}

function applyToken(token) {
  state.token = token;
  saveSettings({ token });
}

function renderAuthState() {
  const loggedIn = !!state.token;
  els.authLoggedOut.hidden = loggedIn;
  els.authLoggedIn.hidden = !loggedIn;
  if (loggedIn && state.user) {
    els.userAvatar.src = state.user.avatar_url || "";
    els.userLogin.textContent = `@${state.user.login}`;
  }
}

// ─── GitHub Device Flow ───────────────────────────────────────────────────────

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(id);
        reject(Object.assign(new Error("Annulé"), { name: "AbortError" }));
      }, { once: true });
    }
  });
}

async function pollForToken(clientId, deviceCode, intervalMs, deadline, signal) {
  while (Date.now() < deadline) {
    await sleep(intervalMs, signal);
    const res = await fetch(
      CORS_PROXY + encodeURIComponent("https://github.com/login/oauth/access_token"),
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }).toString(),
        signal,
      }
    );
    const data = await res.json();
    if (data.access_token) return data.access_token;
    if (data.error === "slow_down") intervalMs += 5000;
    else if (data.error === "authorization_pending") { /* wait */ }
    else if (data.error === "expired_token") throw new Error("Code expiré. Réessayez.");
    else if (data.error === "access_denied") throw new Error("Accès refusé.");
    else if (data.error) throw new Error(data.error_description || data.error);
  }
  throw new Error("Délai d'autorisation dépassé.");
}

async function startDeviceFlow() {
  const clientId = els.clientId.value.trim() || state.clientId;
  if (!clientId) {
    document.querySelector(".advanced-details").open = true;
    showStatus("Renseignez le Client ID dans les paramètres avancés.", "warn");
    return;
  }

  if (state.deviceFlowAbort) state.deviceFlowAbort.abort();
  const abort = new AbortController();
  state.deviceFlowAbort = abort;

  els.btnLogin.disabled = true;
  els.deviceFlowBanner.hidden = false;
  els.deviceFlowCode.textContent = "…";
  els.deviceFlowStatus.textContent = "Initialisation…";

  try {
    const codeRes = await fetch(
      CORS_PROXY + encodeURIComponent("https://github.com/login/device/code"),
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, scope: "repo read:user" }).toString(),
        signal: abort.signal,
      }
    );
    if (!codeRes.ok) throw new Error(`Erreur Device Flow (${codeRes.status})`);

    const { device_code, user_code, verification_uri, expires_in, interval } = await codeRes.json();

    els.deviceFlowCode.textContent = user_code;
    els.deviceFlowUrl.href = verification_uri || "https://github.com/login/device";
    els.deviceFlowUrl.textContent = verification_uri || "github.com/login/device";
    els.deviceFlowStatus.textContent = "En attente de votre autorisation…";

    const deadline = Date.now() + (expires_in || 900) * 1000;
    const pollMs = (interval || 5) * 1000;
    const token = await pollForToken(clientId, device_code, pollMs, deadline, abort.signal);

    applyToken(token);
    saveSettings({ clientId });
    state.clientId = clientId;

    const user = await fetchUser(token);
    state.user = user;
    saveSettings({ user });

    els.deviceFlowBanner.hidden = true;
    els.btnLogin.disabled = false;
    state.deviceFlowAbort = null;
    renderAuthState();
  } catch (err) {
    if (err.name === "AbortError") return;
    els.deviceFlowStatus.textContent = `Erreur : ${err.message}`;
    els.btnLogin.disabled = false;
    state.deviceFlowAbort = null;
  }
}

function cancelDeviceFlow() {
  if (state.deviceFlowAbort) {
    state.deviceFlowAbort.abort();
    state.deviceFlowAbort = null;
  }
  els.deviceFlowBanner.hidden = true;
  els.btnLogin.disabled = false;
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────

async function ghGet(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `GitHub ${res.status}`);
  }
  return res.json();
}

async function ghPut(path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message || `GitHub PUT ${res.status}`);
  }
  return res.json();
}

async function ghPost(path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message || `GitHub POST ${res.status}`);
  }
  return res.json();
}

// ─── Repo screen ──────────────────────────────────────────────────────────────

function showStatus(msg, type = "info") {
  els.repoStatus.hidden = false;
  els.repoStatus.textContent = msg;
  els.repoStatus.className = `status-block status-${type}`;
}

async function loadBranches() {
  const owner = els.repoOwner.value.trim();
  const name = els.repoName.value.trim();
  if (!owner || !name) { showStatus("Renseignez owner et repo.", "warn"); return; }

  showStatus("Chargement des branches…");
  try {
    const branches = await ghGet(`/repos/${owner}/${name}/branches?per_page=50`);
    els.branchSelect.innerHTML = branches
      .map((b) => `<option value="${b.name}">${b.name}</option>`)
      .join("");
    els.repoStatus.hidden = true;
  } catch (err) {
    showStatus(`Erreur : ${err.message}`, "error");
  }
}

async function searchUserRepos() {
  if (!state.token) { showStatus("Connectez-vous d'abord.", "warn"); return; }
  const q = els.repoSearch.value.trim();
  try {
    const data = q
      ? await ghGet(`/search/repositories?q=${encodeURIComponent(q + " user:" + (state.user?.login || ""))}&per_page=10`)
      : await ghGet(`/user/repos?per_page=30&sort=updated`);
    const repos = data.items || data;
    els.reposList.innerHTML = repos
      .map((r) => `<option value="${r.full_name}">`)
      .join("");
    if (repos.length === 1) {
      const [owner, name] = repos[0].full_name.split("/");
      els.repoOwner.value = owner;
      els.repoName.value = name;
      await loadBranches();
    }
  } catch (err) {
    showStatus(`Erreur recherche : ${err.message}`, "error");
  }
}

function applyActiveRepo() {
  const owner = els.repoOwner.value.trim();
  const name = els.repoName.value.trim();
  const branch = els.branchSelect.value;
  if (!owner || !name || !branch) {
    showStatus("Renseignez owner, repo et branche.", "warn");
    return;
  }
  state.repo = { owner, name, branch };
  saveSettings({ repo: state.repo });
  els.currentRepoCard.hidden = false;
  els.currentRepoName.textContent = `${owner}/${name}`;
  els.currentRepoBranch.textContent = `🌿 ${branch}`;
  els.repoStatus.hidden = true;
  updatePromptRepoBanner();
}

function updatePromptRepoBanner() {
  const hasRepo = !!(state.repo.owner && state.repo.name && state.repo.branch);
  els.promptNoRepo.hidden = hasRepo;
  els.btnSendPrompt.disabled = !hasRepo;
}

// ─── File content fetch ───────────────────────────────────────────────────────

function isTextFile(path) {
  const ext = path.split(".").pop().toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

async function fetchFileContent(owner, repo, path) {
  const data = await ghGet(`/repos/${owner}/${repo}/contents/${path}`);
  if (data.encoding !== "base64") return null;
  if (data.size > 1_000_000) return null;
  return { content: atob(data.content.replace(/\n/g, "")), sha: data.sha };
}

// ─── Copilot / GitHub Models API ─────────────────────────────────────────────

async function callCopilot(systemMsg, userMsg) {
  const res = await fetch(MODELS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${state.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    const msg = b.error?.message || b.message || `Erreur API (${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function extractJsonFromResponse(text) {
  // Try to extract a JSON array from the LLM response
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1].trim() : text.trim();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Réponse Copilot non parseable : aucun tableau JSON trouvé.");
  return JSON.parse(raw.slice(start, end + 1));
}

// ─── Send prompt ──────────────────────────────────────────────────────────────

async function sendPrompt() {
  const prompt = els.promptInput.value.trim();
  if (!prompt) return;
  const { owner, name, branch } = state.repo;

  // Build context
  let contextParts = [];

  if (els.includeReadme.checked) {
    try {
      const readme = await fetchFileContent(owner, name, "README.md");
      if (readme) contextParts.push(`# README.md\n\`\`\`\n${readme.content}\n\`\`\``);
    } catch { /* ignore */ }
  }

  for (const filePath of contextFiles) {
    if (!isTextFile(filePath)) continue;
    try {
      const file = await fetchFileContent(owner, name, filePath);
      if (file) contextParts.push(`# ${filePath}\n\`\`\`\n${file.content}\n\`\`\``);
    } catch { /* ignore */ }
  }

  const systemMsg = [
    `Tu es un assistant de développement expert. Tu travailles sur le dépôt GitHub "${owner}/${name}", branche "${branch}".`,
    `Génère uniquement du code directement applicable.`,
    `Réponds EXCLUSIVEMENT avec un tableau JSON valide de la forme :`,
    `[{"path":"chemin/vers/fichier","content":"contenu complet du fichier","action":"create"|"update"|"delete"}]`,
    `- "path" : chemin relatif depuis la racine du repo.`,
    `- "content" : contenu complet et final du fichier (vide si action=delete).`,
    `- "action" : "create" si le fichier est nouveau, "update" si existant, "delete" si à supprimer.`,
    `Ne fournis aucun texte en dehors du tableau JSON. Pas d'explications, pas de markdown autour.`,
    contextParts.length ? `\n## Contexte des fichiers existants :\n${contextParts.join("\n\n")}` : "",
  ].filter(Boolean).join("\n");

  // Disable button & show spinner
  els.btnSendPrompt.disabled = true;
  els.btnSendLabel.hidden = true;
  els.btnSendSpinner.hidden = false;

  try {
    const raw = await callCopilot(systemMsg, prompt);
    const files = extractJsonFromResponse(raw);

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error("Copilot n'a retourné aucun fichier.");
    }

    // Enrich with originalContent for context
    const enriched = await Promise.all(files.map(async (f) => {
      let originalContent = "";
      if (f.action === "update" || f.action === "delete") {
        try {
          const existing = await fetchFileContent(owner, name, f.path);
          if (existing) originalContent = existing.content;
        } catch { /* new file */ }
      }
      return { ...f, originalContent };
    }));

    state.pendingFiles = enriched;

    // Auto commit message
    const slug = prompt.slice(0, 60).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/ +/g, " ");
    els.commitMessage.value = `feat: ${slug}`;

    addHistoryItem({
      prompt,
      repo: `${owner}/${name}`,
      branch,
      fileCount: enriched.length,
    });

    renderReviewScreen();
    switchScreen("review");
  } catch (err) {
    showPromptError(err.message);
  } finally {
    els.btnSendPrompt.disabled = false;
    els.btnSendLabel.hidden = false;
    els.btnSendSpinner.hidden = true;
  }
}

function showPromptError(msg) {
  const existing = document.getElementById("prompt-error");
  if (existing) existing.remove();
  const div = document.createElement("div");
  div.id = "prompt-error";
  div.className = "result-block error";
  div.textContent = `⚠️ ${msg}`;
  els.btnSendPrompt.insertAdjacentElement("beforebegin", div);
}

// ─── Review screen ────────────────────────────────────────────────────────────

function renderReviewScreen() {
  els.reviewFiles.innerHTML = "";
  const files = state.pendingFiles;

  if (!files.length) {
    els.reviewEmpty.hidden = false;
    els.commitSection.hidden = true;
    return;
  }

  els.reviewEmpty.hidden = true;
  els.commitSection.hidden = false;
  els.applyResult.hidden = true;

  files.forEach((file, idx) => {
    const details = document.createElement("details");
    details.className = "file-card";

    const summary = document.createElement("summary");
    summary.className = "file-card-header";
    summary.innerHTML = `
      <span class="file-card-toggle">▶</span>
      <span class="file-card-path">${file.path}</span>
      <span class="file-badge file-badge-${file.action}">${file.action}</span>
    `;
    details.appendChild(summary);

    if (file.action !== "delete") {
      const body = document.createElement("div");
      body.className = "file-card-body";

      // Code view
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = file.content;
      pre.appendChild(code);
      body.appendChild(pre);

      // Highlight
      if (window.hljs) {
        hljs.highlightElement(code);
      }

      // Edit area (hidden by default)
      const editArea = document.createElement("textarea");
      editArea.className = "file-edit-area";
      editArea.value = file.content;
      editArea.hidden = true;
      editArea.addEventListener("input", () => {
        state.pendingFiles[idx].content = editArea.value;
      });
      body.appendChild(editArea);

      // Actions
      const actions = document.createElement("div");
      actions.className = "file-card-actions";

      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn btn-outline btn-small";
      btnEdit.textContent = "✏️ Modifier";
      btnEdit.addEventListener("click", () => {
        const editing = !editArea.hidden;
        editArea.hidden = editing;
        pre.hidden = !editing;
        btnEdit.textContent = editing ? "✏️ Modifier" : "👁 Voir";
        if (!editing) editArea.value = state.pendingFiles[idx].content;
      });

      const btnDiscard = document.createElement("button");
      btnDiscard.type = "button";
      btnDiscard.className = "btn btn-ghost btn-small";
      btnDiscard.textContent = "🗑 Exclure";
      btnDiscard.addEventListener("click", () => {
        state.pendingFiles.splice(idx, 1);
        renderReviewScreen();
      });

      actions.appendChild(btnEdit);
      actions.appendChild(btnDiscard);
      body.appendChild(actions);
      details.appendChild(body);
    }

    els.reviewFiles.appendChild(details);
  });
}

// ─── Apply (commit / PR) ──────────────────────────────────────────────────────

async function applyChanges() {
  const { owner, name, branch } = state.repo;
  const commitMsg = els.commitMessage.value.trim() || "feat: changements Copilot";
  const mode = document.querySelector('input[name="apply-mode"]:checked')?.value || "direct";
  const prBranch = els.prBranchName.value.trim() || `copilot/${slugify(commitMsg)}`;
  const targetBranch = mode === "pr" ? prBranch : branch;

  els.btnApply.disabled = true;
  els.btnApplyLabel.hidden = true;
  els.btnApplySpinner.hidden = false;
  els.applyResult.hidden = true;

  try {
    // 1. If PR mode, create a new branch from base
    if (mode === "pr") {
      const refData = await ghGet(`/repos/${owner}/${name}/git/ref/heads/${branch}`);
      const baseSha = refData.object.sha;
      await ghPost(`/repos/${owner}/${name}/git/refs`, {
        ref: `refs/heads/${prBranch}`,
        sha: baseSha,
      });
    }

    // 2. Commit each file
    let lastCommitSha = "";
    for (const file of state.pendingFiles) {
      if (file.action === "delete") {
        // Get SHA to delete
        try {
          const existing = await ghGet(`/repos/${owner}/${name}/contents/${file.path}?ref=${targetBranch}`);
          await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${file.path}`, {
            method: "DELETE",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({
              message: commitMsg,
              sha: existing.sha,
              branch: targetBranch,
            }),
          });
        } catch { /* file may not exist */ }
        continue;
      }

      const encodedContent = btoa(unescape(encodeURIComponent(file.content)));
      const body = { message: commitMsg, content: encodedContent, branch: targetBranch };

      // Get existing SHA if updating
      try {
        const existing = await ghGet(`/repos/${owner}/${name}/contents/${file.path}?ref=${targetBranch}`);
        body.sha = existing.sha;
      } catch { /* new file, no sha needed */ }

      const result = await ghPut(`/repos/${owner}/${name}/contents/${file.path}`, body);
      lastCommitSha = result.commit?.sha || "";
    }

    // 3. If PR mode, open a PR
    let resultHtml = "";
    if (mode === "pr") {
      const pr = await ghPost(`/repos/${owner}/${name}/pulls`, {
        title: commitMsg,
        head: prBranch,
        base: branch,
        body: `Généré par Copilot Dev 🤖\n\n> ${els.promptInput.value.trim()}`,
      });
      resultHtml = `✅ Pull Request créée : <a href="${pr.html_url}" target="_blank" rel="noopener noreferrer">${pr.title} #${pr.number}</a>`;
    } else {
      const commitUrl = `https://github.com/${owner}/${name}/commit/${lastCommitSha}`;
      resultHtml = lastCommitSha
        ? `✅ ${state.pendingFiles.length} fichier(s) commités sur <code>${branch}</code>. <a href="${commitUrl}" target="_blank" rel="noopener noreferrer">Voir le commit</a>`
        : `✅ ${state.pendingFiles.length} fichier(s) commités sur <code>${branch}</code>.`;
    }

    els.applyResult.innerHTML = resultHtml;
    els.applyResult.className = "result-block success";
    els.applyResult.hidden = false;
    state.pendingFiles = [];
    renderReviewScreen();
  } catch (err) {
    els.applyResult.textContent = `⚠️ Erreur : ${err.message}`;
    els.applyResult.className = "result-block error";
    els.applyResult.hidden = false;
  } finally {
    els.btnApply.disabled = false;
    els.btnApplyLabel.hidden = false;
    els.btnApplySpinner.hidden = true;
  }
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// ─── History screen ───────────────────────────────────────────────────────────

function renderHistory() {
  const items = loadHistory();
  if (!items.length) {
    els.historyEmpty.hidden = false;
    els.historyList.innerHTML = "";
    return;
  }
  els.historyEmpty.hidden = true;
  els.historyList.innerHTML = items.map((item) => `
    <li class="history-item" data-prompt="${encodeURIComponent(item.prompt || "")}">
      <p class="history-item-prompt">${escHtml(item.prompt || "")}</p>
      <div class="history-item-meta">
        <span class="history-item-repo">${escHtml(item.repo || "")}</span>
        <span>🌿 ${escHtml(item.branch || "")}</span>
        <span>${item.fileCount ?? 0} fichier(s)</span>
        <span>${new Date(item.ts).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
      </div>
    </li>
  `).join("");

  els.historyList.querySelectorAll(".history-item").forEach((li) => {
    li.addEventListener("click", () => {
      const prompt = decodeURIComponent(li.dataset.prompt || "");
      els.promptInput.value = prompt;
      switchScreen("prompt");
    });
  });
}

function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Context file list ────────────────────────────────────────────────────────

function addContextFile() {
  const path = els.contextFilePath.value.trim();
  if (!path || contextFiles.includes(path)) return;
  contextFiles.push(path);
  els.contextFilePath.value = "";
  renderContextFiles();
}

function renderContextFiles() {
  els.contextFilesList.innerHTML = contextFiles.map((f, i) => `
    <li><span>${escHtml(f)}</span><button type="button" class="tag-remove" data-idx="${i}" aria-label="Retirer">×</button></li>
  `).join("");
  els.contextFilesList.querySelectorAll(".tag-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      contextFiles.splice(Number(btn.dataset.idx), 1);
      renderContextFiles();
    });
  });
}

// ─── Navigation ───────────────────────────────────────────────────────────────

const SCREENS = ["auth", "repo", "prompt", "review", "history"];

function switchScreen(name) {
  SCREENS.forEach((s) => {
    const screen = document.getElementById(`screen-${s}`);
    screen.hidden = s !== name;
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.screen === name);
  });
  if (name === "history") renderHistory();
  if (name === "review") {
    if (!state.pendingFiles.length) {
      els.reviewEmpty.hidden = false;
      els.commitSection.hidden = true;
    }
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

function init() {
  const settings = loadSettings();

  // Restore settings
  if (settings.token) state.token = settings.token;
  if (settings.clientId) {
    state.clientId = settings.clientId;
    els.clientId.value = settings.clientId;
  }
  if (settings.user) state.user = settings.user;
  if (settings.repo) {
    state.repo = settings.repo;
    els.repoOwner.value = settings.repo.owner || "";
    els.repoName.value = settings.repo.name || "";
  }

  // Render auth state
  renderAuthState();

  // Render active repo card
  if (state.repo.owner && state.repo.name && state.repo.branch) {
    els.currentRepoCard.hidden = false;
    els.currentRepoName.textContent = `${state.repo.owner}/${state.repo.name}`;
    els.currentRepoBranch.textContent = `🌿 ${state.repo.branch}`;
  }
  updatePromptRepoBanner();

  // ── Events: Auth ──────────────────────────────────────────

  els.btnLogin.addEventListener("click", startDeviceFlow);

  els.btnCancelFlow.addEventListener("click", cancelDeviceFlow);

  els.btnCopyCode.addEventListener("click", async () => {
    const code = els.deviceFlowCode.textContent.trim();
    if (!code || code === "…") return;
    try {
      await navigator.clipboard.writeText(code);
      const orig = els.btnCopyCode.textContent;
      els.btnCopyCode.textContent = "Copié ✅";
      setTimeout(() => { els.btnCopyCode.textContent = orig; }, 2000);
    } catch { /* ignore */ }
  });

  els.btnUseManualToken.addEventListener("click", async () => {
    const token = els.tokenManual.value.trim();
    if (!token) return;
    try {
      const user = await fetchUser(token);
      state.user = user;
      applyToken(token);
      saveSettings({ user });
      renderAuthState();
    } catch (err) {
      alert(`Token invalide : ${err.message}`);
    }
  });

  els.btnLogout.addEventListener("click", () => {
    state.token = "";
    state.user = null;
    saveSettings({ token: "", user: null });
    renderAuthState();
  });

  // ── Events: Repo ──────────────────────────────────────────

  els.btnSearchRepos.addEventListener("click", searchUserRepos);
  els.repoSearch.addEventListener("keydown", (e) => { if (e.key === "Enter") searchUserRepos(); });
  els.repoSearch.addEventListener("change", () => {
    const val = els.repoSearch.value.trim();
    if (val.includes("/")) {
      const [owner, name] = val.split("/");
      els.repoOwner.value = owner;
      els.repoName.value = name;
    }
  });

  els.btnLoadBranches.addEventListener("click", loadBranches);
  els.repoName.addEventListener("blur", loadBranches);

  els.btnUseRepo.addEventListener("click", applyActiveRepo);

  // ── Events: Prompt ────────────────────────────────────────

  els.btnSendPrompt.addEventListener("click", sendPrompt);

  els.btnAddFile.addEventListener("click", addContextFile);
  els.contextFilePath.addEventListener("keydown", (e) => { if (e.key === "Enter") addContextFile(); });

  // ── Events: Review ────────────────────────────────────────

  document.querySelectorAll('input[name="apply-mode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      els.prBranchRow.hidden = radio.value !== "pr";
    });
  });

  els.btnApply.addEventListener("click", applyChanges);

  // Auto-fill PR branch name from commit message
  els.commitMessage.addEventListener("input", () => {
    if (!els.prBranchName.value || els.prBranchName.dataset.auto === "1") {
      els.prBranchName.value = `copilot/${slugify(els.commitMessage.value)}`;
      els.prBranchName.dataset.auto = "1";
    }
  });
  els.prBranchName.addEventListener("input", () => {
    els.prBranchName.dataset.auto = "";
  });

  // ── Events: History ───────────────────────────────────────

  els.btnClearHistory.addEventListener("click", () => {
    saveHistory([]);
    renderHistory();
  });

  // ── Events: Bottom nav ────────────────────────────────────

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchScreen(btn.dataset.screen));
  });

  // ── Initial screen ────────────────────────────────────────

  switchScreen(state.token ? "prompt" : "auth");
}

init();
