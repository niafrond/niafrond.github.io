# stats — mesure d'audience maison (remplace GoatCounter)

## Principe
- Script `https://stats.fontaine.one/count.js` (async, ≈ 3 Ko) inclus dans toutes les pages du dépôt à la place de GoatCounter. Tableau de bord : `https://stats.fontaine.one/`.
- Respect de la vie privée : aucun cookie, aucun stockage local, aucun identifiant, aucune adresse IP ni user-agent conservés, pas de requête ni de `#hash` (uniquement le chemin), provenance réduite au nom de domaine. « Ne pas suivre » et Global Privacy Control sont respectés ; robots, navigateurs pilotés (`navigator.webdriver`) et localhost sont ignorés. Données agrégées et anonymes : pas de bandeau de consentement nécessaire (mesure d'audience anonyme).
- Pas de visiteurs « uniques » (il faudrait un identifiant) : uniquement des pages vues.

## Métriques collectées (et pourquoi)
Chaque valeur est un compteur **séparé** (jamais de combinaison : appareil × pays × page…), sans cookie, sans identifiant, sans adresse IP conservée.
- **Pages vues** (par jour, site, page ; pages les plus vues) : `views`. **Pics** : `dims` `minute` (`HHMM` UTC) à chaque page vue ; le tableau de bord liste les 5 minutes les plus chargées.
- **Visites** = arrivées sur le site (pas de navigation interne : référent différent du site) : somme de `refs`. **Visites par heure** : `dims` `hour` (`HH` UTC, affichée en heure locale).
- **Sources du trafic** : `refs` = nom de domaine du site d'origine ou `(direct)` ; classées en Direct, Moteurs de recherche, Réseaux sociaux, Autres sites.
- À chaque visite, `dims` : `browser` (famille : chrome, safari, firefox, edge, opera, samsung, autre), `os` (windows, macos, linux, android, ios, chromeos, autre), `lang` (2 lettres de `navigator.language`), `tz` (fuseau IANA), `width` (tranches xs < 480, sm < 768, md < 1200, lg < 1920, xl), `ttfb` (temps de réponse de la page, `responseStart - requestStart` : lt100, lt300, lt1000, gte1000), `status` (code HTTP de la page via `responseStatus`, Chromium seulement).
- **Pays** : estimé à partir du fuseau horaire par une table du tableau de bord (fuseau inconnu affiché tel quel). Pas de géolocalisation par IP : ce site n'a pas de serveur qui voie l'IP, et appeler un service tiers lui enverrait l'IP du visiteur. Approximatif (VPN sans effet, voyageur compté dans son fuseau).
- **Codes HTTP** : seulement ceux de la page qui charge le script (une 404 n'est vue que si la page d'erreur inclut le script) ; pas de journaux serveur. **Temps de réponse** : délai du serveur (TTFB) côté navigateur.
- **Non collecté** : visiteurs uniques (exigent un identifiant ou un hachage d'IP), version précise du navigateur ou du système, résolution exacte, adresse IP.
- **Quota Spark** : 20 000 écritures par jour pour tout le projet ; une visite en consomme jusqu'à 11 (1 page + minute + provenance + 8 caractéristiques), soit environ 1 800 visites par jour avant refus des écritures (la page continue de fonctionner).

## Technique (aucun serveur, palier gratuit)
- Projet GCP dédié `fontaine-stats-one` (sans facturation) ; Firestore natif en `europe-west1` ; site Firebase Hosting `fontaine-stats-one` (`stats.fontaine.one`, URL de secours `fontaine-stats-one.web.app`).
- `count.js` écrit via l'API REST Firestore (`documents:commit`, transformation `increment`) des compteurs par visite : `dims/{jour}_{site}_{hash}` {day, host, dim, value, views, expireAt} ; `views/{jour}_{site}_{hash page}` {day, host, path, views, expireAt} et `refs/{jour}_{site}_{hash domaine}` {day, host, ref, views, expireAt}. `day` = AAAAMMJJ en UTC.
- `firestore.rules` : création seulement avec `views == 1`, jour = aujourd'hui (heure serveur), hôte dans la liste blanche, clés exactes ; mise à jour seulement « +1 sur `views` » du jour en cours ; aucune suppression ; lecture réservée aux administrateurs : documents `admins/{uid}` (créés avec les droits du projet, jamais par un client). Clé d'API restreinte aux sites autorisés (referrers) et à Firestore.
- Pas de TTL automatique (exige la facturation) : `expireAt` (+400 jours) est prêt pour une politique TTL ; purge manuelle sinon.
- Ajouter un nouveau site : ajouter son nom d'hôte dans `okHost` (`firestore.rules`) et son origine dans les referrers de la clé d'API.
- Déploiement : `cd stats && firebase deploy` (règles + hébergement).
- DNS one.com : `CNAME stats` → `fontaine-stats-one.web.app` ; `TXT _acme-challenge.stats` → `KI1w7tC4zTpZIGuF6m5EkA78185JEM8afnCwOeNyW0c`.
- Authentification : le tableau de bord exige une connexion Google (Firebase Auth, SDK compat chargé depuis gstatic) ; les lectures Firestore partent avec le jeton ID. **Liste blanche** : seuls les comptes dont l'adresse (vérifiée) figure comme identifiant d'un document `admins/{adresse}` peuvent lire ; ils sont ajoutés à la main (console Firestore ou API avec les droits du projet), jamais par un client, et aucune adresse n'est dans le dépôt. Un compte non listé est déconnecté aussitôt avec « accès refusé ». Google reste actif dans Firebase Auth (console, car l'API exige la facturation). Après la première connexion du propriétaire, on peut désactiver l'inscription de nouveaux comptes (Authentication > Paramètres > Actions de l'utilisateur) pour que seuls les comptes déjà connus puissent se connecter.
- Tableau de bord : pages vues par jour (7/30/90 jours), pages, sites, provenance ; données d'exemple si la lecture échoue.
