// État partagé entre l'écran de contrôle (index.html) et l'écran vidéo
// (player.html). Les deux pages tournent dans le même navigateur (même
// origine, deux fenêtres sur deux écrans physiques) donc on synchronise via
// localStorage (persistance + fallback) et BroadcastChannel (temps réel).
// Aucun appel serveur n'est nécessaire : la file d'attente vit entièrement
// côté client.
(function (global) {
  const STORAGE_KEY = 'karaoke_playlist_queue_state_v2';
  const CHANNEL_NAME = 'karaoke-playlist-sync';

  const channel = 'BroadcastChannel' in global ? new BroadcastChannel(CHANNEL_NAME) : null;

  function emptyState() {
    return { queue: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.queue)) return parsed;
    } catch (_) {
      // ignore, on repart d'un état vide
    }
    return emptyState();
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (channel) channel.postMessage({ type: 'state', state });
    return state;
  }

  // Appelé quand l'état change depuis une AUTRE fenêtre (BroadcastChannel ne
  // délivre jamais un message à son propre émetteur). Les mutations locales
  // (add/remove/dequeue ci-dessous) doivent être re-rendues directement par
  // l'appelant, sans passer par ce callback.
  function subscribe(callback) {
    if (channel) {
      channel.addEventListener('message', (event) => {
        if (event.data?.type === 'state') callback(event.data.state);
      });
    }
    global.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        callback(JSON.parse(event.newValue));
      } catch (_) {
        // ignore
      }
    });
  }

  function addTrack(track) {
    const state = load();
    state.queue.push({
      id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      addedAt: Date.now(),
      videoId: track.videoId,
      title: track.title || 'Titre inconnu',
      channel: track.channel || '',
      thumb: track.thumb || '',
    });
    return save(state);
  }

  function removeTrack(id) {
    const state = load();
    state.queue = state.queue.filter((track) => track.id !== id);
    return save(state);
  }

  // Retire la tête de file SEULEMENT si elle correspond encore à `id`.
  // Utilisé par l'écran vidéo quand une vidéo se termine : sans cette
  // vérification, un ENDED qui arrive juste après que l'écran de contrôle a
  // déjà retiré cette même chanson (bouton "Passer") ferait avancer la file
  // une seconde fois et pourrait la vider entièrement.
  function removeIfCurrent(id) {
    const state = load();
    if (state.queue[0]?.id !== id) return state;
    state.queue.shift();
    return save(state);
  }

  global.KaraokeState = { load, save, subscribe, addTrack, removeTrack, removeIfCurrent };
})(window);
