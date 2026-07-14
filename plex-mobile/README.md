# plex-mobile

Web app mobile (PWA statique, sans backend) pour parcourir et regarder les films/séries d'un serveur **Plex Media Server** hébergé sur cet ordinateur, depuis le téléphone sur le même Wi-Fi.

Aucun serveur à faire tourner : la page (servie par GitHub Pages, `https://niafrond.github.io/plex-mobile/`) parle **directement**, depuis le navigateur du téléphone, à l'API `plex.tv` puis à ton serveur Plex local — exactement comme le fait `app.plex.tv`. La lecture vidéo passe par le transcodeur universel de Plex (HLS, via `hls.js` vendorisé en local dans `vendor/`).

## Pourquoi une adresse `*.plex.direct` et pas juste l'IP locale ?

La page est servie en HTTPS (GitHub Pages). Un navigateur bloque les appels `fetch` d'une page HTTPS vers une adresse `http://` locale ("contenu mixte"). Plex résout ça avec des certificats HTTPS valides pour des noms comme `192-168-1-42.<id>.plex.direct`, qui pointent vers l'IP locale de ton PC. Au premier lancement, l'app appelle `https://plex.tv/api/v2/resources` avec ton token pour trouver automatiquement cette adresse.

## Configuration (au premier lancement, dans l'app)

1. Ouvre `https://niafrond.github.io/plex-mobile/` sur ton téléphone (même Wi-Fi que le PC).
2. L'écran de réglages s'ouvre automatiquement. Récupère ton `X-Plex-Token` :
   - Ouvre l'app web Plex (`http://<IP-de-ce-PC>:32400/web`), connecte-toi.
   - Sur un film/épisode, clique **⋮ → Obtenir des infos → Afficher le XML** : le token apparaît dans l'URL (`...?X-Plex-Token=xxxxxxxx`).
   - Doc officielle si besoin : https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
3. Colle le token, laisse le champ "Adresse du serveur" vide (détection automatique), clique **Se connecter**.
4. Si la détection échoue (ex: pas de "Secure connections" activé côté Plex), tu peux forcer une adresse manuellement dans ce champ.
5. Menu du navigateur → **Ajouter à l'écran d'accueil** pour une icône type app.

Le token et l'adresse restent uniquement dans le `localStorage` du navigateur du téléphone — rien n'est stocké côté serveur ou dans ce repo.

## Limites connues (v1)

- Réseau local uniquement (le PC et le téléphone doivent voir la même adresse `plex.direct` locale).
- Nécessite que "Connexions sécurisées" soit activé côté Plex (réglage par défaut : `Préféré`), sinon la détection automatique ne trouvera pas d'adresse HTTPS locale.
- Pas de recherche, pas de reprise de lecture, pas de sous-titres.
- Testé (chargement, écran de réglages, gestion d'erreurs) avec Playwright contre un faux serveur — le flux réel (découverte plex.tv + lecture HLS) n'a pas pu être validé ici faute de compte/serveur Plex disponible dans cet environnement de dev, à vérifier en conditions réelles.
