// Ajoute `token=...` aux URLs de l'API downloader. Si l'URL porte déjà un
// paramètre `token` (ex: le jeton de poll de /api/search/poll), on ne le
// remplace pas pour éviter d'écraser un paramètre déjà significatif.
export function appendApiToken(url, token) {
  if (!token) return url;
  if (/[?&]token=/.test(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

export function createDownloaderConfigManager(options) {
  const {
    defaultUrl,
    inputEl,
    saveBtn,
    statusEl,
    storageKey,
    testBtn,
    tokenInputEl,
    tokenStorageKey,
  } = options;

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#f87171' : 'var(--text-muted)';
  }

  function getDownloaderApiUrl() {
    return (localStorage.getItem(storageKey) || defaultUrl).trim().replace(/\/$/, '');
  }

  function getDownloaderApiToken() {
    return (localStorage.getItem(tokenStorageKey) || '').trim();
  }

  function loadIntoForm() {
    const url = localStorage.getItem(storageKey) || defaultUrl;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, url);
    }
    if (inputEl) inputEl.value = url;
    if (tokenInputEl) tokenInputEl.value = localStorage.getItem(tokenStorageKey) || '';
  }

  function saveFromForm() {
    const baseUrl = (inputEl?.value || defaultUrl).trim();
    localStorage.setItem(storageKey, baseUrl);
    if (tokenInputEl) {
      localStorage.setItem(tokenStorageKey, (tokenInputEl.value || '').trim());
    }
  }

  function setupEvents() {
    saveBtn?.addEventListener('click', () => {
      saveFromForm();
      setStatus('Configuration API enregistrée', false);
    });

    testBtn?.addEventListener('click', async () => {
      saveFromForm();
      setStatus('Test API en cours...', false);

      try {
        const baseUrl = getDownloaderApiUrl();
        if (!baseUrl) throw new Error('URL API manquante');
        const url = appendApiToken(`${baseUrl}/health`, getDownloaderApiToken());
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStatus('Serveur disponible ✓', false);
      } catch (err) {
        setStatus(`Serveur indisponible: ${err.message}`, true);
      }
    });
  }

  return {
    getDownloaderApiToken,
    getDownloaderApiUrl,
    loadIntoForm,
    saveFromForm,
    setStatus,
    setupEvents,
  };
}
