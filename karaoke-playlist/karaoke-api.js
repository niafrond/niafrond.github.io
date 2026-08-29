// Client de l'API "soirée karaoké" — aucune dépendance Firebase ici (pas de
// SDK, pas de config, pas d'accès direct à Firestore) : tout, y compris les
// lectures (statut d'une recherche/demande, file d'attente) et la
// modération ("Passer"/"Retirer"), passe par une Cloud Function HTTP
// classique. Voir SPECS.md (repo Spotify-mp3-downloader) > "Cloud Functions
// invités karaoke-playlist (Firestore)" — ces fonctions sont le SEUL point
// d'entrée vers Firestore ; les règles de sécurité y refusent tout accès
// client direct (allow read, write: if false).
const FUNCTIONS_BASE = 'https://us-central1-karaoke-506217.cloudfunctions.net';

// Pas de "temps réel" façon Firestore listener ici (justement pour ne pas
// avoir à embarquer son SDK) : l'écran maître et les écrans invités pollent
// ces fonctions à intervalle régulier à la place.
const QUEUE_POLL_MS = 3000;
const REQUEST_POLL_MS = 1500;

function functionUrl(name) {
  return `${FUNCTIONS_BASE}/${name}`;
}

// Les fonctions "callable" Firebase attendent le payload enveloppé dans
// { data: ... } et répondent { result: ... } (ou { error: { message } }) —
// un simple fetch JSON suffit, pas besoin du SDK client Functions pour ça.
async function callFunction(name, data) {
  const res = await fetch(functionUrl(name), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  const body = await res.json().catch(() => null);
  if (body?.error) throw new Error(body.error.message || 'Échec de la demande.');
  if (!res.ok || !body?.result) throw new Error(`HTTP ${res.status}`);
  return body.result;
}

// Poll `fetchOnce` à intervalle régulier et transmet chaque résultat à
// `onChange`, jusqu'à ce que l'appelant se désabonne (fonction retournée) ou
// — pour les suivis de statut ponctuels (recherche/demande) — jusqu'à ce que
// `stopIf(result)` renvoie true (ex: statut 'done'/'failed', plus la peine
// de continuer à interroger). Un échec ponctuel de poll est ignoré : on
// retente au prochain tick plutôt que d'abandonner le suivi.
function poll(fetchOnce, intervalMs, onChange, stopIf) {
  let stopped = false;
  let timer = null;

  async function tick() {
    try {
      const result = await fetchOnce();
      if (stopped) return;
      onChange(result);
      if (stopIf?.(result)) return;
    } catch (_) {
      // ignore, on retente au prochain tick
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  }

  tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

// ── File d'attente (lue par l'écran maître ET tous les invités ; modifiable
// par tout le monde — "Passer"/"Retirer" — voir removeQueueItem) ──────────

export function watchQueue(sessionId, onChange) {
  return poll(
    async () => (await callFunction('getQueue', { sessionId })).items,
    QUEUE_POLL_MS,
    onChange
  );
}

export async function removeQueueItem(sessionId, itemId) {
  await callFunction('removeQueueItem', { sessionId, itemId }).catch(() => {});
}

// ── Recherche (écran invité) ────────────────────────────────────────────

export async function submitSearchQuery(sessionId, queryText) {
  return callFunction('submitSearchQuery', { sessionId, query: queryText });
}

// Suit une recherche en cours : 'pending'/'processing' tant que
// karaokeRequestsWatcher.js n'a pas répondu, puis 'done' (avec results[]) ou
// 'failed' — le polling s'arrête alors de lui-même.
export function watchSearchQuery(sessionId, requestId, onChange) {
  return poll(
    () => callFunction('getSearchQuery', { sessionId, requestId }),
    REQUEST_POLL_MS,
    onChange,
    (data) => data.status === 'done' || data.status === 'failed'
  );
}

// ── Ajout à la file (invité choisit un résultat de recherche) ─────────────

// `result` = un élément de searchQueries.results (voir submitSearchQuery).
// Passe toujours par le serveur, même si result.isLocal (aucune écriture
// directe dans `queue` n'est permise aux clients) — mais reste quasi
// instantané dans ce cas puisque déjà en cache côté serveur (cacheState
// 'HIT' sur POST /api/video/download).
export async function submitAddRequest(sessionId, queryText, result) {
  return callFunction('submitSongRequest', {
    sessionId,
    query: queryText,
    youtubeUrl: result.videoUrl,
    title: result.videoTitle,
    channel: result.channelName,
    thumb: result.artworkUrl,
  });
}

// Suit une demande d'ajout : 'done' une fois que
// karaokeRequestsWatcher.js a fini avec succès (la chanson est dans
// `queue`), ou 'failed' — le polling s'arrête alors de lui-même.
export function watchAddRequest(sessionId, requestId, onChange) {
  return poll(
    () => callFunction('getRequestStatus', { sessionId, requestId }),
    REQUEST_POLL_MS,
    onChange,
    (data) => data.status === 'done' || data.status === 'failed'
  );
}
