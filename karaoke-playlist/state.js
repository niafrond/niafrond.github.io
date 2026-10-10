// La file d'attente vit désormais côté serveur (Firestore, jamais accédé
// directement par ce navigateur — voir karaoke-api.js), pas en localStorage :
// ce module ne garde plus que l'identifiant de session, le seul bout d'état
// réellement local à ce navigateur.
(function (global) {
  const SESSION_ID_KEY = 'karaoke_playlist_session_id';

  // 3 caractères alphanumériques (62^3 = 238 328 combinaisons) : court exprès
  // pour rester tapable à la main depuis l'URL affichée sous le QR code (voir
  // index.html), au prix d'un espace d'id plus facile à deviner qu'un UUID —
  // acceptable pour une appli de soirée entre invités de confiance.
  const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  function randomId(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => ID_CHARS[byte % ID_CHARS.length]).join('');
  }

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
      id = randomId(3);
      localStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  }

  global.KaraokeState = { getSessionId };
})(window);
