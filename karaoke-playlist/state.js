// La file d'attente vit désormais côté serveur (Firestore, jamais accédé
// directement par ce navigateur — voir karaoke-api.js), pas en localStorage :
// ce module ne garde plus que l'identifiant de session, le seul bout d'état
// réellement local à ce navigateur.
(function (global) {
  const SESSION_ID_KEY = 'karaoke_playlist_session_id';

  // Identifiant de la soirée karaoké en cours, encodé dans le QR code que les
  // invités scannent (voir index.html). Créé une seule fois puis persisté
  // dans ce navigateur — stable tant que le localStorage n'est pas effacé.
  //
  // IMPORTANT : ce même id doit être copié dans KARAOKE_SESSION_ID côté
  // serveur (Spotify-mp3-downloader/.env), sans quoi
  // karaokeRequestsWatcher.js ne traite aucune demande pour cette session.
  function getSessionId() {
    let id = localStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      localStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  }

  global.KaraokeState = { getSessionId };
})(window);
