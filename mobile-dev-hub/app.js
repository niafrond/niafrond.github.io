const storageKey = "mobile-dev-hub-settings";
const CORS_PROXY = "https://corsproxy.io/?url=";

const els = {
  owner: document.getElementById("owner"),
  repo: document.getElementById("repo"),
  token: document.getElementById("token"),
  clientId: document.getElementById("client-id"),
  repoForm: document.getElementById("repo-form"),
  saveCreds: document.getElementById("save-creds"),
  openRepo: document.getElementById("open-repo"),
  openCopilot: document.getElementById("open-copilot"),
  openGithubDev: document.getElementById("open-github-dev"),
  prompt: document.getElementById("prompt"),
  copyPrompt: document.getElementById("copy-prompt"),
  addNote: document.getElementById("add-note"),
  clearLog: document.getElementById("clear-log"),
  chatLog: document.getElementById("chat-log"),
  kpiIssues: document.getElementById("kpi-issues"),
  kpiPrs: document.getElementById("kpi-prs"),
  kpiBranch: document.getElementById("kpi-branch"),
  kpiCommit: document.getElementById("kpi-commit"),
  prList: document.getElementById("pr-list"),
  issueList: document.getElementById("issue-list"),
  btnLoginGitHub: document.getElementById("btn-login-github"),
  btnLoginCopilot: document.getElementById("btn-login-copilot"),
  deviceFlowBanner: document.getElementById("device-flow-banner"),
  deviceFlowUrl: document.getElementById("device-flow-url"),
  deviceFlowCode: document.getElementById("device-flow-code"),
  deviceFlowCopy: document.getElementById("device-flow-copy"),
  deviceFlowStatus: document.getElementById("device-flow-status"),
  deviceFlowCancel: document.getElementById("device-flow-cancel"),
};

let deviceFlowAbortController = null;

function getSettings() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSettings(next) {
  localStorage.setItem(storageKey, JSON.stringify(next));
}

function updateAuthButtonsState() {
  const hasToken = !!els.token.value.trim();
  if (hasToken) {
    els.btnLoginGitHub.classList.add("btn-auth-connected");
    els.btnLoginGitHub.title = "Cliquer pour se déconnecter";
  } else {
    els.btnLoginGitHub.classList.remove("btn-auth-connected");
    els.btnLoginGitHub.title = "";
  }
}

function hydrate() {
  const settings = getSettings();
  if (settings.owner) els.owner.value = settings.owner;
  if (settings.repo) els.repo.value = settings.repo;
  if (settings.token) els.token.value = settings.token;
  if (settings.clientId) els.clientId.value = settings.clientId;
  updateAuthButtonsState();
}

function authHeaders() {
  const token = els.token.value.trim();
  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function gh(path) {
  const owner = els.owner.value.trim();
  const repo = els.repo.value.trim();
  if (!owner || !repo) {
    throw new Error("owner/repo manquants");
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Erreur GitHub (${res.status})`);
  }

  return res.json();
}

function renderDataList(target, items, emptyText) {
  target.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = emptyText;
    target.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.title;
    li.appendChild(link);
    target.appendChild(li);
  });
}

async function loadRepoStats() {
  els.kpiIssues.textContent = "...";
  els.kpiPrs.textContent = "...";
  els.kpiBranch.textContent = "...";
  els.kpiCommit.textContent = "...";

  try {
    const [repo, pulls, issues, commits] = await Promise.all([
      gh(""),
      gh("/pulls?state=open&per_page=5"),
      gh("/issues?state=open&per_page=5"),
      gh("/commits?per_page=1"),
    ]);

    const realIssues = issues.filter((it) => !it.pull_request);

    els.kpiIssues.textContent = String(repo.open_issues_count || 0);
    els.kpiPrs.textContent = String(pulls.length);
    els.kpiBranch.textContent = repo.default_branch || "-";
    els.kpiCommit.textContent = commits[0]?.sha?.slice(0, 7) || "-";

    renderDataList(
      els.prList,
      pulls.map((p) => ({ title: `#${p.number} ${p.title}`, url: p.html_url })),
      "Aucune PR ouverte"
    );

    renderDataList(
      els.issueList,
      realIssues.map((i) => ({ title: `#${i.number} ${i.title}`, url: i.html_url })),
      "Aucune issue ouverte"
    );

    addLog("GitHub", `Dashboard charge pour ${repo.full_name}`);
  } catch (err) {
    addLog("Erreur", err.message);
    els.kpiIssues.textContent = "ERR";
    els.kpiPrs.textContent = "ERR";
    els.kpiBranch.textContent = "ERR";
    els.kpiCommit.textContent = "ERR";
    renderDataList(els.prList, [], "Impossible de charger les PR");
    renderDataList(els.issueList, [], "Impossible de charger les issues");
  }
}

function addLog(author, message) {
  const li = document.createElement("li");
  const text = document.createElement("div");
  text.textContent = `${author}: ${message}`;
  const meta = document.createElement("small");
  meta.textContent = new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  li.append(text, meta);
  els.chatLog.prepend(li);
}

function openRepo() {
  const owner = els.owner.value.trim();
  const repo = els.repo.value.trim();
  if (!owner || !repo) return;
  window.open(`https://github.com/${owner}/${repo}`, "_blank", "noopener,noreferrer");
}

function openGithubDev() {
  const owner = els.owner.value.trim();
  const repo = els.repo.value.trim();
  if (!owner || !repo) return;
  window.open(`https://github.dev/${owner}/${repo}`, "_blank", "noopener,noreferrer");
}

function bindEvents() {
  els.repoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadRepoStats();
  });

  els.saveCreds.addEventListener("click", () => {
    const owner = els.owner.value.trim();
    const repo = els.repo.value.trim();
    const token = els.token.value.trim();
    const clientId = els.clientId.value.trim();
    setSettings({ owner, repo, token, clientId });
    addLog("App", "Parametres memorises localement");
  });

  els.openRepo.addEventListener("click", openRepo);
  els.openGithubDev.addEventListener("click", openGithubDev);

  els.btnLoginGitHub.addEventListener("click", () => {
    if (els.token.value.trim()) {
      els.token.value = "";
      const settings = getSettings();
      setSettings({ ...settings, token: "" });
      updateAuthButtonsState();
      addLog("Auth", "Déconnecté de GitHub");
      return;
    }
    startGitHubDeviceFlow(false);
  });

  els.btnLoginCopilot.addEventListener("click", () => {
    if (els.token.value.trim()) {
      window.open("https://github.com/copilot", "_blank", "noopener,noreferrer");
    } else {
      startGitHubDeviceFlow(true);
    }
  });

  els.deviceFlowCancel.addEventListener("click", cancelDeviceFlow);

  const deviceFlowCopyLabel = els.deviceFlowCopy.textContent;
  els.deviceFlowCopy.addEventListener("click", async () => {
    const code = els.deviceFlowCode.textContent.trim();
    if (!code || code === "…") return;
    try {
      await navigator.clipboard.writeText(code);
      els.deviceFlowStatus.textContent = "";
      els.deviceFlowCopy.textContent = "Copié ✅";
      setTimeout(() => { els.deviceFlowCopy.textContent = deviceFlowCopyLabel; }, 2000);
    } catch {
      els.deviceFlowStatus.textContent = "Impossible de copier automatiquement.";
    }
  });

  els.openCopilot.addEventListener("click", () => {
    window.open("https://github.com/copilot", "_blank", "noopener,noreferrer");
  });

  els.copyPrompt.addEventListener("click", async () => {
    const text = els.prompt.value.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      addLog("Prompt", "Copie dans le presse-papiers pour Copilot");
    } catch {
      addLog("Prompt", "Impossible de copier automatiquement");
    }
  });

  els.addNote.addEventListener("click", () => {
    const text = els.prompt.value.trim();
    if (!text) return;
    addLog("Moi", text);
    els.prompt.value = "";
  });

  els.clearLog.addEventListener("click", () => {
    els.chatLog.innerHTML = "";
  });
}

function cancelDeviceFlow() {
  if (deviceFlowAbortController) {
    deviceFlowAbortController.abort();
    deviceFlowAbortController = null;
  }
  els.deviceFlowBanner.hidden = true;
  els.btnLoginGitHub.disabled = false;
  els.btnLoginCopilot.disabled = false;
}

async function startGitHubDeviceFlow(openCopilotAfter = false) {
  const clientId = els.clientId.value.trim();
  if (!clientId) {
    document.getElementById("token-details").open = true;
    addLog("Auth", "Renseignez le Client ID dans les paramètres avancés pour utiliser la connexion OAuth.");
    return;
  }

  if (deviceFlowAbortController) cancelDeviceFlow();
  deviceFlowAbortController = new AbortController();
  const { signal } = deviceFlowAbortController;

  els.btnLoginGitHub.disabled = true;
  els.btnLoginCopilot.disabled = true;
  els.deviceFlowBanner.hidden = false;
  els.deviceFlowCode.textContent = "…";
  els.deviceFlowStatus.textContent = "Initialisation…";

  try {
    const codeRes = await fetch(CORS_PROXY + encodeURIComponent("https://github.com/login/device/code"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, scope: "repo read:user" }).toString(),
      signal,
    });

    if (!codeRes.ok) {
      throw new Error(`Erreur Device Flow (${codeRes.status})`);
    }

    const {
      device_code,
      user_code,
      verification_uri,
      expires_in,
      interval: pollInterval,
    } = await codeRes.json();

    els.deviceFlowCode.textContent = user_code;
    els.deviceFlowUrl.href = verification_uri || "https://github.com/login/device";
    els.deviceFlowUrl.textContent = verification_uri || "github.com/login/device";
    els.deviceFlowStatus.textContent = "En attente de votre autorisation…";

    const deadline = Date.now() + (expires_in || 900) * 1000;
    const poll = Math.max((pollInterval || 5), 5) * 1000;

    const token = await pollForToken(clientId, device_code, poll, deadline, signal);

    els.token.value = token;
    const settings = getSettings();
    setSettings({ ...settings, token, clientId });

    els.deviceFlowBanner.hidden = true;
    els.btnLoginGitHub.disabled = false;
    els.btnLoginCopilot.disabled = false;
    deviceFlowAbortController = null;

    addLog("Auth", "Connecté à GitHub ✅");
    updateAuthButtonsState();

    if (openCopilotAfter) {
      window.open("https://github.com/copilot", "_blank", "noopener,noreferrer");
    }

    if (els.owner.value.trim() && els.repo.value.trim()) {
      loadRepoStats();
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    els.deviceFlowStatus.textContent = `Erreur: ${err.message}`;
    addLog("Auth", `Échec connexion: ${err.message}`);
    els.btnLoginGitHub.disabled = false;
    els.btnLoginCopilot.disabled = false;
    deviceFlowAbortController = null;
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(Object.assign(new Error("Operation was aborted"), { name: "AbortError" }));
    }, { once: true });
  });
}

async function pollForToken(clientId, deviceCode, intervalMs, deadline, signal) {
  while (Date.now() < deadline) {
    await sleep(intervalMs, signal);

    const res = await fetch(CORS_PROXY + encodeURIComponent("https://github.com/login/oauth/access_token"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }).toString(),
      signal,
    });

    const data = await res.json();

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === "slow_down") {
      intervalMs += 5000;
    } else if (data.error === "authorization_pending") {
      // still waiting
    } else if (data.error === "expired_token") {
      throw new Error("Le code a expiré, réessayez.");
    } else if (data.error === "access_denied") {
      throw new Error("Accès refusé par l'utilisateur.");
    } else if (data.error) {
      throw new Error(data.error_description || data.error);
    }
  }
  throw new Error("Délai d'autorisation dépassé.");
}

function init() {
  hydrate();
  bindEvents();

  if (els.owner.value && els.repo.value) {
    loadRepoStats();
  }
}

init();
