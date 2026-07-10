# plex-mobile

Web app mobile (PWA) pour parcourir et regarder les films/séries d'un serveur **Plex Media Server** qui tourne sur cet ordinateur, depuis le téléphone sur le même Wi-Fi.

Architecture : un petit serveur Express sert la page + fait proxy vers ton Plex local (`server.js`, même pattern que `alldebrid-fdm/`). Le token Plex reste côté serveur, jamais exposé au téléphone. La lecture vidéo passe par le transcodeur universel de Plex (HLS, via `hls.js` vendorisé) pour rester compatible avec la plupart des formats sources.

## Configuration

1. `cp .env.example .env`
2. Renseigne `PLEX_SERVER_URL` (par défaut `http://127.0.0.1:32400`, à changer seulement si Plex tourne ailleurs).
3. Récupère ton `X-Plex-Token` :
   - Ouvre l'app web Plex (`http://<IP-de-ce-PC>:32400/web`), connecte-toi.
   - Sur un film/épisode, clique **⋮ → Obtenir des infos → Afficher le XML** : le token apparaît dans l'URL (`...?X-Plex-Token=xxxxxxxx`).
   - Colle-le dans `.env` (`PLEX_TOKEN=...`).
   - Doc officielle si besoin : https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
4. `npm install`
5. `npm start` (port par défaut : 3400)

## Utilisation depuis le téléphone

- Vérifie l'IP locale de ce PC (`ipconfig` → adresse IPv4, ex. `192.168.1.42`).
- Sur le téléphone (même Wi-Fi), ouvre `http://192.168.1.42:3400`.
- Menu du navigateur → **Ajouter à l'écran d'accueil** pour une icône type app.

## Limites connues (v1)

- Réseau local uniquement (pas d'accès à distance).
- Pas de recherche, pas de reprise de lecture, pas de sous-titres.
- Non testé contre un vrai serveur Plex dans cet environnement de dev — à valider en conditions réelles, notamment la lecture HLS.
