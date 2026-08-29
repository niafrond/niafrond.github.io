// Configuration du serveur dj-mix, utilisée uniquement par l'écran maître
// (index.html) pour construire les URLs de streaming vidéo
// (GET /api/video/stream?cachePath=...&token=...). La recherche et le
// téléchargement ne passent plus par un navigateur du tout : ils sont
// relayés côté serveur (karaokeRequestsWatcher.js, repo Spotify-mp3-downloader,
// via les Cloud Functions de karaoke-api.js). L'écran invité (guest.html) n'a
// donc jamais besoin de cette config.
(function (global) {
  const API_URL_KEY = 'karaoke_playlist_server_api_url';
  const TOKEN_KEY = 'karaoke_playlist_server_token';

  function getApiUrl() {
    return (localStorage.getItem(API_URL_KEY) || '').trim().replace(/\/$/, '');
  }

  function getToken() {
    return (localStorage.getItem(TOKEN_KEY) || '').trim();
  }

  // La CDN vidéo (audioCdnServer.js) est un process à part mais, en
  // production, reste derrière la même URL de reverse-proxy que l'API (nginx
  // route par chemin, pas par port) — même approche que dj-mix
  // (deriveCdnUrlFromApiUrl dans lib/downloaderConfig.js) : pas de champ
  // séparé à configurer, on réutilise directement l'URL de l'API.
  function getCdnUrl() {
    return getApiUrl();
  }

  function isConfigured() {
    return Boolean(getApiUrl());
  }

  // Ajoute ?token=... (ou &token=...) à une URL si un token est configuré.
  function withToken(url) {
    const token = getToken();
    if (!token) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }

  // Le "failed to fetch" générique du navigateur ne dit pas pourquoi : la
  // cause la plus fréquente ici est le contenu mixte (page HTTPS, ex. GitHub
  // Pages, qui appelle un serveur local en http://) — le navigateur bloque
  // silencieusement plutôt que de renvoyer une vraie erreur réseau.
  function describeFetchError(err, apiUrl) {
    const isFailedToFetch = err instanceof TypeError && /failed to fetch/i.test(err?.message || '');
    const isInsecureNonLocalTarget = /^http:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i.test(String(apiUrl || ''));
    if (isFailedToFetch && isInsecureNonLocalTarget && global.isSecureContext) {
      return `Bloqué par le navigateur (contenu mixte) : cette page est en HTTPS, elle ne peut pas contacter ${apiUrl} en http://.`;
    }
    return err?.message || String(err);
  }

  global.KaraokeServerConfig = { getApiUrl, getToken, getCdnUrl, isConfigured, withToken, describeFetchError };
})(window);
