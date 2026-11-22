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
