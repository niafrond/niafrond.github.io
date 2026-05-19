export function createDownloaderConfigManager(options) {
  const {
    defaultUrl,
    inputEl,
    saveBtn,
    statusEl,
    storageKey,
    testBtn,
  } = options;

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#f87171' : 'var(--text-muted)';
  }

  function getDownloaderApiUrl() {
    return (localStorage.getItem(storageKey) || defaultUrl).trim().replace(/\/$/, '');
  }

  function loadIntoForm() {
    const url = localStorage.getItem(storageKey) || defaultUrl;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, url);
    }
    if (inputEl) inputEl.value = url;
  }

  function saveFromForm() {
    const baseUrl = (inputEl?.value || defaultUrl).trim();
    localStorage.setItem(storageKey, baseUrl);
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
        const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStatus('Serveur disponible ✓', false);
      } catch (err) {
        setStatus(`Serveur indisponible: ${err.message}`, true);
      }
    });
  }

  return {
    getDownloaderApiUrl,
    loadIntoForm,
    saveFromForm,
    setStatus,
    setupEvents,
  };
}
