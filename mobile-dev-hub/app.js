const storageKey = "mobile-dev-hub-settings";

const els = {
  owner: document.getElementById("owner"),
  repo: document.getElementById("repo"),
  token: document.getElementById("token"),
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
};

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

function hydrate() {
  const settings = getSettings();
  if (settings.owner) els.owner.value = settings.owner;
  if (settings.repo) els.repo.value = settings.repo;
  if (settings.token) els.token.value = settings.token;
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
    setSettings({ owner, repo, token });
    addLog("App", "Parametres memorises localement");
  });

  els.openRepo.addEventListener("click", openRepo);
  els.openGithubDev.addEventListener("click", openGithubDev);

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

function init() {
  hydrate();
  bindEvents();

  if (els.owner.value && els.repo.value) {
    loadRepoStats();
  }
}

init();
