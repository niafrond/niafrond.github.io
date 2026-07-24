// Ajoute `token=...` aux URLs de l'API downloader. Si l'URL porte déjà un
// paramètre `token`, on ne le remplace pas pour éviter d'écraser un
// paramètre déjà significatif.
export function appendApiToken(url, token) {
  if (!token) return url;
  if (/[?&]token=/.test(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

// Detects the classic "mixed content" browser block: the app itself is loaded
// in a secure context (HTTPS — e.g. the GitHub Pages deployment — or the
// installed/service-worker-controlled PWA) while the configured downloader
// API URL is plain HTTP on a non-localhost host (e.g. `http://vision:3000`).
// Browsers silently block that fetch as "mixed active content" and surface it
// as a generic `TypeError: Failed to fetch`, indistinguishable from a genuinely
// unreachable server — this lets the UI tell them apart and explain the real
// cause instead of just "Failed to fetch". `isSecureContext` is passed in
// explicitly (rather than read from `window` inline) to stay testable, same
// pattern as `clearLocalCache()` in settingsController.js.
export function isLikelyMixedContentBlock(err, baseUrl, isSecureContext) {
  const isFailedToFetch = err instanceof TypeError && /failed to fetch/i.test(err?.message || '');
  const isInsecureNonLocalTarget = /^http:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i.test(String(baseUrl || ''));
  return Boolean(isFailedToFetch && isInsecureNonLocalTarget && isSecureContext);
}

// Turns a raw fetch error into a message the user can act on, adding the
// mixed-content explanation when it applies (see isLikelyMixedContentBlock).
export function describeApiTestError(err, baseUrl, isSecureContext) {
  if (isLikelyMixedContentBlock(err, baseUrl, isSecureContext)) {
    return 'Bloqué par le navigateur (contenu mixte) : cette page est chargée en HTTPS, elle ne peut pas '
      + `contacter ${baseUrl} en http://. Servez l'API en HTTPS, ou utilisez une copie locale de l'app ouverte en http://.`;
  }
  return err?.message || String(err);
}

// Derives a CDN base URL from the API base URL by swapping the port to 3002,
// used as the CDN's default when the user hasn't explicitly configured one.
export function deriveCdnUrlFromApiUrl(apiUrl) {
  try {
    const url = new URL(apiUrl);
    url.port = '3002';
    return url.toString().replace(/\/$/, '');
  } catch (_) {
    return apiUrl;
  }
}

// Derives the relay server's base URL from the API base URL by swapping the
// port to 3003. The relay server (Maître/Relais sync) is a standalone process
// detached from the main API, so it can't be reached through the API's own
// base URL — see lib/relayModeManager.js.
export function deriveRelayUrlFromApiUrl(apiUrl) {
  try {
    const url = new URL(apiUrl);
    url.port = '3003';
    return url.toString().replace(/\/$/, '');
  } catch (_) {
    return apiUrl;
  }
}

export function createDownloaderConfigManager(options) {
  const {
    cdnDefaultUrl,
    cdnInputEl,
    cdnStorageKey,
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

  // Falls back to deriving from the *current* API URL (same host, port 3002)
  // when the user hasn't explicitly set a CDN URL — zero-config by default,
  // and follows the API URL if it changes at runtime (e.g. relay mode
  // syncing a master's API URL onto a relay client).
  function getDownloaderCdnUrl() {
    const stored = (cdnStorageKey ? localStorage.getItem(cdnStorageKey) : '') || '';
    if (stored.trim()) return stored.trim().replace(/\/$/, '');
    const apiUrl = getDownloaderApiUrl();
    if (apiUrl) return deriveCdnUrlFromApiUrl(apiUrl);
    return (cdnDefaultUrl || '').trim().replace(/\/$/, '');
  }

  // No override storage: unlike the CDN URL, the relay server's address is
  // always derived from the API URL (port 3003), following it if it changes
  // at runtime (e.g. relay mode syncing a master's API URL onto a relay client).
  function getDownloaderRelayUrl() {
    const apiUrl = getDownloaderApiUrl();
    return apiUrl ? deriveRelayUrlFromApiUrl(apiUrl) : '';
  }

  function loadIntoForm() {
    const url = localStorage.getItem(storageKey) || defaultUrl;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, url);
    }
    if (inputEl) inputEl.value = url;
    if (tokenInputEl) tokenInputEl.value = localStorage.getItem(tokenStorageKey) || '';
    if (cdnInputEl) cdnInputEl.value = (cdnStorageKey && localStorage.getItem(cdnStorageKey)) || getDownloaderCdnUrl();
  }

  function saveFromForm() {
    const baseUrl = (inputEl?.value || defaultUrl).trim();
    localStorage.setItem(storageKey, baseUrl);
    if (tokenInputEl) {
      localStorage.setItem(tokenStorageKey, (tokenInputEl.value || '').trim());
    }
    if (cdnInputEl && cdnStorageKey) {
      localStorage.setItem(cdnStorageKey, (cdnInputEl.value || '').trim());
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
        setStatus(`Serveur indisponible: ${describeApiTestError(err, getDownloaderApiUrl(), window.isSecureContext)}`, true);
      }
    });
  }

  return {
    getDownloaderApiToken,
    getDownloaderApiUrl,
    getDownloaderCdnUrl,
    getDownloaderRelayUrl,
    loadIntoForm,
    saveFromForm,
    setStatus,
    setupEvents,
  };
}
