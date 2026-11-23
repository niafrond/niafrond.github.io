# bus-naolib — Spécifications

App HTML autonome (`index.html`, sans build) qui indique à quelle heure sortir de chez soi pour prendre toujours le même bus.

- 2026-11-22 (création) :
  - Données : Open Data Naolib (`https://open.tan.fr/ewp/`) — `arrets.json` (recherche d'arrêt par nom) et `horairesarret.json/{arrêt}/{ligne}/{sens}/{date}` (horaires théoriques du jour, libellés des deux sens).
  - Réglages (une fois) : arrêt, ligne, sens, temps de marche maison → arrêt, durée du trajet en bus jusqu'au travail (marche d'arrivée comprise), heure de début habituelle.
  - Calcul : dernier bus partant au plus tard à `début − trajet` ; heure de sortie = départ du bus − marche. Affiche aussi le bus d'avant (marge) et le suivant.
  - Jour de début tardif : champ heure ou boutons +30 min / +1 h ; valable pour la journée seulement (revient à l'heure habituelle le lendemain) ; bouton pour annuler.
  - Stockage : `localStorage` uniquement (`bus-naolib:v1:*`) — config, début décalé du jour, liste des arrêts et horaires du jour en cache (repli si Naolib injoignable).
  - Hors périmètre volontaire : pas de temps réel, pas de trajet multi-lignes, pas de notifications.
  - Non vérifié contre l'API réelle depuis le bac à sable (réseau bloqué) : testé avec des réponses simulées au format documenté ; vérifier le CORS et les codes d'arrêt sur le vrai service.

- 2026-11-22 (semaine habituelle, exceptions, ligne → arrêts) :
  - Réglages : saisie de la ligne avec précomplétion (numéros tirés de `arrets.json`, saisie directe possible) ; le sens affiche les terminus ; l'arrêt se choisit dans la liste des arrêts desservant la ligne (filtrable, ordre alphabétique car l'API ne donne pas l'ordre de passage).
  - Semaine habituelle : pour chaque jour, case « travaillé » + heure de début (défaut lun–ven 08:30).
  - Exceptions : sur l'écran principal, vue « 5 jours à venir » ou « Semaine prochaine » ; toucher un jour permet un début décalé, un repos ou de rétablir le normal. Les exceptions passées sont purgées.
  - Chaque jour affiche l'heure de sortie calculée avec les horaires théoriques de la date concernée ; le bloc du haut traite aujourd'hui (compte à rebours, bus d'avant / suivant).
  - Stockage v2 (`bus-naolib:v2:*`) ; migration automatique de la config v1 (une heure unique appliquée à tous les jours, lun–ven).

- 2026-11-22 (arrêt d'arrivée, incidents) :
  - Réglages en 2 écrans : 1) ligne, sens, arrêt de départ, marche maison → départ ; 2) arrêt d'arrivée (même ligne), marche arrivée → travail, semaine habituelle. La durée de trajet saisie à la main est supprimée : elle est déduite des horaires aux deux arrêts.
  - Appariement départ/arrivée : l'API n'a pas d'identifiant de course ; décalage d'index entre les deux listes choisi pour des durées positives (≤ 150 min) et régulières (`pairTrips`). Limite : ambigu si les listes n'ont pas les mêmes courses avec cadencement parfaitement régulier.
  - Incidents : lecture de `ligne.etatTrafic` / `ligne.bloquant` renvoyés avec les horaires (départ et arrivée). Bandeau ⚠️ « trafic perturbé, prends de la marge » ou ⛔ « ligne bloquée » sur aujourd'hui, icône sur les jours à venir. Horaires du jour relus après 10 min de cache, état du trafic relu toutes les 5 min ; repli sur le cache si Naolib injoignable.
  - Migration : une config v1/v2 sans arrêt d'arrivée rouvre les réglages.
  - Non vérifié contre l'API réelle (réseau bloqué) : les champs `etatTrafic`/`bloquant` sont ceux documentés par Open TAN ; pas d'appel à un flux d'info trafic dédié.

- 2026-11-22 (source de données réelle : GTFS Nantes Métropole) :
  - `open.tan.fr` (Open TAN) ne répond plus (le domaine ne se résout plus) : l'app est migrée sur le GTFS officiel Naolib publié sur `data.nantesmetropole.fr` (jeu `244400404_transports_commun_naolib_nantes_metropole_gtfs`, zip ≈ 22 Mo, stop_times ≈ 470 Mo — trop gros pour un navigateur).
  - `tools/build-data.mjs` (Node ≥ 18, `unzip`) télécharge le GTFS courant et génère `data/index.json` (96 lignes, sens, validité du GTFS) et `data/l/<ligne>.json` (arrêts ordonnés par sens, calendriers, motifs de passage, courses ≈ 3,5 Mo au total). À relancer à chaque nouveau GTFS (actuel : 20/11/2026 → 21/02/2027). Option : `node tools/build-data.mjs <dossier-gtfs>`.
  - L'app lit ces fichiers statiques (`fetch('data/…')`, pas de localStorage pour les horaires). Un arrêt est identifié par son nom dans la ligne et le sens ; l'arrêt d'arrivée n'est proposé qu'après l'arrêt de départ.
  - L'appariement départ/arrivée est désormais exact (même course), l'heuristique `pairTrips` est supprimée.
  - Stockage passé en `bus-naolib:v3:*` (anciens réglages ignorés : les codes d'arrêt ont changé).
  - Supprimé : état du trafic / ligne bloquée (fourni par l'ancienne API). Le temps réel existe en SIRI sur le même portail mais n'est pas branché.
  - Testé avec Playwright sur les vraies données (ligne 1, Commerce → Beaujoire : bus de 07:57, sortie 07:52).

- 2026-11-22 (focus ligne 23) :
  - L'app ne traite plus que la ligne 23 : champ ligne retiré des réglages (fixe), titre « Mon bus 23 ». `tools/build-data.mjs` ne garde que les lignes de `LIGNES` (défaut `23`, ex. `LIGNES=23,C3 node tools/build-data.mjs`) : `data/` passe de 3,5 Mo à ≈ 0,1 Mo.
  - Sens : 1 → Haluchère - Batignolles, 2 → Mendès France - Bellevue. Test Playwright : Aquitaine → Terray (sens 1), bus de 07:27, sortie 07:22.

- 2026-11-23 (bascule à 9 h) :
  - Bloc du haut : avant 9 h il traite aujourd'hui ; à partir de 9 h il passe au prochain jour avec un bus (demain, ou ex. « lun. 30 nov. » si le week-end est en repos ; demain si aucun jour travaillé sous 7 jours). Le texte dit « aujourd'hui », « demain » ou la date ; le compte à rebours inclut le décalage de jours. Test Playwright avec horloge simulée (lun. 07:00 → aujourd'hui, lun. 10:00 → demain, ven. 10:00 → lun.).
