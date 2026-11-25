# Jardin — specs

Application **mobile Android uniquement** d'aménagement de jardin, **France uniquement** : l'utilisateur décrit son terrain (région, exposition, dimensions métrées), place des zones (mare, terrasse, massifs, arbres…), choisit des essences adaptées, obtient un plan vectoriel puis un guide de plantation, d'entretien et d'arrosage.

Statut : **implémenté (MVP + une partie des jalons 2 et 3)**, voir §17. Dossier : `jardin/` (web) et `jardin-android/` (enveloppe Capacitor).

## 1. Principes

- **Application mobile** : web (HTML/CSS/JS, comme les autres apps du dépôt) empaqueté en app native avec **Capacitor** (accès GPS, boussole, notifications locales, stockage). Voir §10. Le dessin se fait au doigt ; le métré reste lisible sur petit écran.
- **Pas de serveur à nous** : l'app appelle directement des API publiques gratuites et sans clé (§11), mises en cache. Aucun compte.
- Données utilisateur stockées localement ; export/import JSON pour sauvegarde et partage.
- **Hors ligne** : le jardin, le plan, le catalogue, les conseils et les notifications déjà planifiées fonctionnent sans réseau ; seules la météo et la recherche d'adresse en ont besoin.
- Interface en français, unités métriques (m, m², L), **France seule** (métropole ; DROM en jalon ultérieur car le climat et le catalogue diffèrent).
- Les recommandations sont **explicables** : chaque essence conseillée ou déconseillée affiche la raison (« tolère le gel jusqu'à −15 °C », « exige plein soleil »…).

## 2. Parcours utilisateur (9 étapes : context, boundary, wished, sun, items, zones, beds, plants, render)

1. **Accueil** : liste des jardins enregistrés (vignette vectorielle, nom, surface, région) + bouton « Nouveau jardin ». Plusieurs jardins possibles.
2. **Contexte** (assistant, étape 1) :
   - **Localisation** : par **GPS** (« Je suis dans mon jardin ») ou par recherche d'adresse/commune. On en déduit la commune, la région, l'altitude, puis la zone de rusticité, le climat (températures mini, pluviométrie) et le calendrier de plantation (§11). La position est corrigeable à la main sur une carte.
   - **Exposition** : par la **boussole du téléphone** (§4 bis), ou saisie manuelle (N, NE, E, SE, S, SO, O, NO) ou « je ne sais pas ». Le nord oriente aussi le plan.
   - Facultatif : type de sol (argileux, calcaire, sableux, limoneux, humifère, « je ne sais pas »), pente (nulle/légère/forte), vent dominant, exposition au vent.
3. **Tracé du terrain** (étape 2) : dessin du contour en mode **polyligne métrée** (§4).
4. **Zones souhaitées** (étape 3) : l'utilisateur coche/ajoute les types de zones qu'il veut (§5).
5. **Ensoleillement** (étape 4, facultatif) : renseigner l'ensoleillement de la surface (§6).
6. **Dessin des zones** (étape 5) : formes tracées sur le plan.
6 bis. **Massifs** (étape 6, id `beds`, 🌸) : en mode auto, l'app calcule les massifs (voir « Massifs automatiques (interface) »).
7. **Choix des essences** (étape 7) : pour chaque zone, sélection avec recommandations (§7).
8. **Rendu** (étape 9) : génération du plan vectoriel (§8) ; si l'utilisateur valide → sauvegarde et accès aux conseils (§9). S'il refuse, retour à l'étape de son choix sans perte.

Navigation : barre d'étapes, retour arrière libre, tout est modifiable après coup. Un jardin brouillon est enregistré automatiquement à chaque étape ; seul le statut « validé » débloque les conseils.

## 3. Modèle de données

```text
Garden {
  id, name, createdAt, updatedAt, status: 'draft' | 'validated',
  context: { region, hardinessZone, orientation, soil?, slope?, wind? },
  boundary: Point[]            // polygone fermé, en mètres, repère local (origine = 1er sommet)
  obstacles: Obstacle[]        // maison, mur, arbre existant, clôture (influencent l'ombre)
  sunMap: SunSetting           // §6
  zones: Zone[]
  plan: { svg?: string, validatedAt? }
}
Point    { x, y }              // mètres
Zone     { id, type, label, polygon: Point[] | circle, area, plantings: Planting[], notes }
Planting { plantId, count?, density?, spacingOverride? }   // quantité calculée par défaut
Plant    { id, commonName, latinName, category, heightAdult, widthAdult,
           sun: ('full'|'partial'|'shade')[], hardiness: number /*°C mini*/,
           water: 'low'|'medium'|'high', soil: string[], regions?: string[],
           foliage: 'deciduous'|'evergreen'|'semi', bloom: months[], harvest?: months[],
           zones: ZoneType[], invasive?: boolean, toxic?: boolean, melliferous?: boolean,
           care: { planting, pruning, fertilizer, watering, issues } }   // §9
```

Le catalogue de plantes est un fichier de données statique versionné (`data/plants.json`), séparé du code, enrichissable sans toucher à la logique.

## 4. Dessin du terrain (mode ligne métrée)

Deux façons de tracer, combinables : **dessin manuel** (ci-dessous) ou **relevé GPS sur place** (§4 bis).

- Canvas/SVG avec grille et échelle affichée, zoom/déplacement (molette, pincement).
- **Saisie par segments** : l'utilisateur pose un premier point, puis pour chaque côté il peut soit cliquer/toucher, soit **taper la longueur** (en m, au cm près) et l'angle ou la direction ; le côté s'ajoute à la bonne longueur. Un panneau liste tous les côtés (éditables après coup).
- Aimantation : angles droits (90°), alignement horizontal/vertical, points existants, grille (0,1 / 0,5 / 1 m).
- Fermeture du contour : bouton « Fermer » ou clic sur le premier point ; fermeture assistée si l'écart de métré est faible (proposition de correction répartie).
- Cotes affichées sur chaque côté ; surface et périmètre calculés en direct (formule du lacet).
- Annuler/rétablir, déplacer un sommet, insérer/supprimer un sommet, côtés courbes hors périmètre v1.
- Validation : polygone simple (pas d'auto-intersection), surface > 1 m².
- Obstacles ponctuels/polygonaux à placer (maison, mur, abri, arbre existant avec hauteur) : servent à l'ombre et à interdire des zones.
- Plusieurs jardins : chaque jardin a son propre repère ; duplication d'un jardin possible (« variante »).

### Saisie rapide des dimensions (ergonomie)

- **Démarrage guidé** : sur un plan vide, trois choix : « Je connais les dimensions » (rectangle : largeur et longueur), « Je dessine au doigt », « Je fais le tour au GPS ».
- **Appui long (≈ 0,5 s, avec vibration)** : sur un côté → fenêtre de saisie de sa longueur ; sur un sommet → fenêtre du sommet (suppression) ; sur le plan vide → rectangle (si aucun point) ou « côté suivant » depuis le dernier sommet (longueur + direction ↑ → ↓ ←).
- **Toucher une cote** (étiquette de longueur) ou le point au milieu d'un côté → même fenêtre de saisie ; **glisser** ce point insère un sommet.
- **Unités** : la saisie se fait en **centimètres** (« 350 » = 3,50 m) ; « 3,5 » ou « 3,5 m » sont aussi compris (`parseLength`). Boutons −10 / +10 cm, Entrée valide, Échap annule ; le côté en cours d'édition est surligné.
- Le tableau « Côtés » reste disponible, en mètres.

## 4 bis. GPS et boussole

### Relevé GPS guidé du contour

« 📍 Je fais le tour au GPS » (panneau de démarrage) et « 📍 Relevé GPS » (barre) ouvrent un **mode plein écran** : l'utilisateur marche le long de sa limite et pose un point à chaque angle ; la forme se construit seule sur le plan. Logique pure dans `gps-survey.js`, interface dans `ui/gps-survey-ui.js`, suivi dans `geo.js` (`watchFix`).

- **Étapes affichées en gros** : 1. Placez-vous sur le 1er angle. 2. Attendez que la précision passe au vert. 3. Touchez « Mettre un point ici » et restez immobile. 4. Marchez jusqu'à l'angle suivant. 5. Après le dernier angle, « Terminer ». Une consigne contextuelle (« Marchez jusqu'à l'angle 3… ») suit l'état.
- **États** : `idle → waiting-fix → ready → recording → closed`. **Qualité** (précision `accuracy` et récence, échantillon périmé après 15 s) : ≤ 3 m bonne (vert), ≤ 6 m moyenne (orange), > 6 m faible (rouge), sinon aucun signal. Pastille « ±2,4 m · bonne ». Le bouton « Mettre un point ici » est désactivé tant que le signal est faible ; « Poser quand même » demande confirmation.
- **Capture d'un point** : fenêtre d'échantillons de ≈ 5 s (barre de progression dans le bouton) ; rejet des valeurs aberrantes par médiane (`combineFixes`), moyenne pondérée par 1/accuracy², précision estimée du point (≥ 0,5 m). Vibration et bip bref à chaque point. Point à moins de 1 m du précédent : refusé sauf confirmation.
- **Repère** : plan tangent, x = est, y = −nord (nord en haut), origine = 1er point ; `garden.context.gpsOrigin = {lat, lon}`. L'origine précédente est remplacée.
- **Sur le plan** : points numérotés (avec cercle de précision), côtés avec longueur en direct, trace du chemin, point bleu de la position et cercle de précision, segment pointillé « 12,4 m depuis le point 3 », cadrage automatique qui suit l'utilisateur (un geste le libère, « Recentrer » le rétablit), alerte si le contour se croise.
- **Retour au départ** : à moins de 4 m du 1er point (≥ 3 points), « Vous êtes à 2,4 m du 1er point : fermer le tour ? » mesure un point de fermeture (non sommet) qui donne l'écart de fermeture.
- **Terminer (≥ 3 points)** : écran de vérification : surface (± incertitude en m²), périmètre, écart de fermeture ; options réversibles avec aperçu avant (pointillé) / après : « Répartir l'écart de fermeture » (`closeGapReport`) et « Redresser les angles droits » (angles à moins de 8 ° de 90°, `squareCorners`). Valider écrit `garden.boundary` / `boundaryClosed` ; l'éditeur normal reprend (cotes en cm, appui long…) et « Où suis-je » continue de marcher.
- **Contour existant** : « Remplacer le contour actuel par le relevé GPS ? » ; le remplacement se fait à la validation et s'annule avec ↶ (origine GPS comprise).
- **Interruption** : le brouillon (points avec précisions) est conservé dans `garden.context.gpsSurveyDraft` à chaque point ; il est proposé à la reprise (bouton « Reprendre le relevé GPS (n points) »). Au retour de l'application au premier plan, le suivi est relancé ; l'écran est maintenu allumé (Wake Lock, repli silencieux).
- **Erreurs** : refus, indisponible, délai dépassé ou non pris en charge → message en français et repli « Saisir les côtés à la main » ; au-delà de ~6 m de précision l'app avertit que le GPS d'un téléphone est peu fiable sous couvert.

- **Orientation par boussole** : « Placez-vous dos à la maison / face au jardin et pointez le téléphone ». L'azimut (capteur magnétique, corrigé de la déclinaison locale) donne l'orientation du fond du jardin et le nord du plan. Avertissement si le capteur est mal calibré (geste en 8 proposé).
- **Position de l'utilisateur sur le plan** : point GPS en direct sur le plan pour vérifier le tracé ou repérer où planter. Mode « sur le terrain » avec fond de carte satellite optionnel (§11) pour caler le plan.
- **Permissions** : localisation « pendant l'utilisation » uniquement ; refus géré (saisie manuelle toujours possible).
- Le GPS ne sert qu'à localiser le jardin, il n'est jamais envoyé à un serveur autre que les API publiques du §11 (coordonnées arrondies à ~100 m dans les requêtes météo quand c'est suffisant).

### Indicateur du nord

- **Pastille** (`createNorthBadge`, `ui/draw-util.js`) : rose des vents ronde de 52 px (cible tactile ≥ 44 px) en haut à droite du plan, sur les écrans contour, zones, aménagements, ensoleillement et relevé GPS (partage le plan du contour). Aiguille rouge (nord, avec « N » toujours lisible) et grise (sud) tournée de `context.northAngle` degrés dans le sens horaire (0 = nord en haut), transition douce, thèmes via `--jd-*`. `aria-label`/`title` dynamiques par pas de 45° (« Le nord est à droite du plan »). Orientation jamais renseignée (`orientation` nul, `northAngle` 0, pas de `gpsOrigin`) : contour en pointillés, « ? », « Orientation non renseignée : nord supposé en haut. Touchez pour la régler ». Mise à jour à chaque redessin (réglage, annuler/rétablir, import) ; détruite au démontage.
- **Réglage** (`ui/north-pop.js`, `openNorthDialog(container, {garden, onChange})`) : « Orienter le plan » avec aperçu, boutons « Nord en haut/à droite/en bas/à gauche » (appliquent aussitôt), saisie d'un angle 0–359, et « 🧭 Utiliser la boussole du téléphone » (`watchHeading` : haut du plan face à soi, `northAngle = 360 − cap`, puis « Valider » ; message clair si capteur absent ou refusé). `setNorthAngle(context, deg)` (pure) écrit `northAngle` et `orientation = (360 − northAngle) % 360` ensemble.
- **Relevé GPS** : le plan est « nord en haut » ; la pastille affiche 0 pendant le relevé et, à la validation, `northAngle = orientation = 0` avec le message « Le relevé GPS place le nord en haut du plan ». La convention est la même que `northSVG` du rendu final (rotation horaire de `northAngle`). Tests : `north.test.js`, `north-badge.dom.test.js`, `north-gps.dom.test.js`, `e2e/nord.spec.js`.

## 5. Zones

Types prédéfinis (icône, couleur, motif de remplissage, règles par défaut) :

| Type | Notes |
|---|---|
| Mare / bassin | profondeur min., exposition ≥ 4 h de soleil conseillée, pas sous les arbres à feuilles caduques denses ; essences : aquatiques, berge |
| Piscine | distance mini aux arbres (racines, feuilles), exposition sud conseillée |
| Terrasse | revêtement (bois, pierre, gravier), proximité maison |
| Allée / cheminement | largeur par défaut 0,8–1,2 m, tracée en ligne épaisse ou polygone |
| Pelouse | |
| Plantes basses / couvre-sol | < 50 cm |
| Massif de plantes moyennes / vivaces | 50 cm – 1,5 m |
| Plantes hautes / haie | > 1,5 m ; haie = zone linéaire (longueur × largeur) |
| Arbres | arbre isolé (cercle d'emprise = largeur adulte) ou bosquet |
| Potager | planches, rotation, besoin en soleil élevé |
| Verger | arbres fruitiers, distances de plantation |
| Autre | libre (nom, couleur) |

L'utilisateur peut ajouter des types personnalisés. Une même zone ne contient qu'une catégorie principale ; les zones peuvent se superposer **uniquement** en couches distinctes (ex. arbre au-dessus d'une pelouse), jamais deux zones « au sol » au même endroit (contrôle de chevauchement avec avertissement).

À cette étape, la liste choisie sert de **checklist** : une zone souhaitée sans forme dessinée est signalée avant le rendu.

### Éditeur de zones : ergonomie téléphone

- **Palette** : cartes larges (icône, couleur, nom) ; les types souhaités (`wishedZoneTypes`) d'abord, avec l'état « à dessiner » ou « ✓ dessiné (n) » ; « Autres types » déploie les autres. **Démarrage guidé** sur un plan sans zone : « Choisissez une zone puis dessinez-la » avec un bouton par type souhaité.
- **Création** : polygone = rectangle en 2 touches (coins opposés, ou toucher puis glisser) par défaut, bascule « Forme libre » (un point par angle, « Terminer » ou retouche du 1er point) ; cercle = toucher le centre puis glisser ou toucher le bord ; ligne (allée, haie) = points successifs, largeur en cm réglable. Aperçu en direct des dimensions et de la surface, « Terminer » et « Annuler le tracé ».
- **Aimantation** : sommets du contour et des autres zones, côtés du contour prolongés, grille. Une zone qui sort du terrain a un contour rouge (⚠) ; un chevauchement de zones au sol est signalé.
- **Sélection** (toucher une zone, son nom ou sa cote) : bandeau en bas (nom éditable, type, surface, dimensions, essences choisies, « Dimensions… », « Dupliquer », « Supprimer »). Poignées : sommets glissables (un rectangle reste un rectangle), ＋ au milieu des côtés pour insérer un sommet, glisser la zone sélectionnée pour la déplacer. Annuler / Rétablir global.
- **Nom et ambiance à la création** (`ui/ambiance-picker.js`, modèle `zone.ambiance: string|null`) : dès qu'une zone est dessinée (rectangle, forme libre, cercle, ligne ou dimensions en cm), le bandeau s'ouvre sur « Donnez-lui un nom » (champ mis en évidence, exemple « ex. Massif bucolique devant la terrasse », pas de clavier forcé sur mobile : focus automatique seulement avec un pointeur précis, texte sélectionné au toucher) avec une pastille par ambiance qui ajoute (ou remplace) le mot dans le nom (« Terrasse — bucolique ») et renseigne `zone.ambiance`. Un champ « Ambiance » distinct (pastilles, une seule valeur ou « Aucune ») est présent pour toute zone sélectionnée. Si le nom tapé contient un mot d'ambiance (`detectAmbiance`), « Ambiance détectée : … » propose « Appliquer » sans l'imposer. L'emoji de l'ambiance s'affiche à côté du nom sur le plan et dans la liste des zones de l'étape essences.
- **Aménagements déjà posés** : l'étape « Aménagements » précède le dessin des zones ; le mobilier posé avant les zones est visible pendant le dessin des zones (calque en lecture seule `pointer-events:none`, sous les formes : mobilier avec nom court, côtés murs / clôtures / haies, ouvertures, obstacles maison / abri / arbre existant nommés). Les coins du mobilier (non rond) et des obstacles polygonaux s'ajoutent aux points d'accrochage : une zone peut être dessinée par-dessus du mobilier sans conflit.
- **Rotation de chaque forme** (`zone-rotate.js`, pur : `rotatePoints`, `rotationOf`, `rotateShapeTo`/`rotateShapeBy`, `rebuildRect`) : polygones, rectangles et lignes pivotent autour de leur centre (centroïde ; milieu moyen pour une ligne), la forme reste un polygone/une ligne (`shape.points` mis à jour, aucune propriété nouvelle). Angle en degrés, sens horaire, 0–359, = angle du premier côté. Dans le bandeau : champ « Rotation (°) », « ↺ −15° », « ↻ +15° », « ⟲ 90° », « Remettre droit » (multiple de 90° le plus proche) et bascule « 🧲 15° ». Sur le plan : poignée ⟳ au-dessus de la zone sélectionnée, reliée au centre, à glisser (aimantation tous les 15° et sur les côtés du terrain à ±3°, désactivable ; angle affiché en direct). Cercle : boutons désactivés (« Un cercle n’a pas d’orientation »). Annuler / rétablir, chevauchement et « hors du terrain » se recalculent. Appui long sur un rectangle : champ « Rotation (°) » en plus de largeur × longueur ; changer les dimensions reconstruit le rectangle autour du même centre avec le même angle. La création en 2 touches reste axe-alignée.
- **Piscine enterrée ou hors sol** : `zone.variant: 'inground' | 'above'` (absent = enterrée ; `createZone` met `inground`), forme polygone ou cercle (piscines rondes Ø 3–5 m). Dans le bandeau d'une piscine (aussi juste après sa création) : deux pastilles « Enterrée » / « Hors sol » avec l'aide « Une piscine hors sol dépasse du sol : prévoyez un dégagement d'au moins 1 m autour et un accès ». Le libellé par défaut suit la variante (« Piscine » ↔ « Piscine hors sol », numéro conservé) ; un nom saisi n'est jamais écrasé (`setPoolVariant`). Aucune erreur de validation nouvelle.
- **Appui long** : sur une zone → saisie en cm (rectangle = largeur × longueur, cercle = rayon, ligne = largeur) ; sur le plan vide avec un type choisi → même fenêtre pour créer une zone de dimensions connues posée à cet endroit (style `jd-pop`, mêmes règles de saisie que le contour).

## 5 bis. Aménagements (mobilier, murs, clôtures, portes)

Étape « Aménagements » (route `items`, 🪑), entre `zones` et `plants` : l'assistant compte 8 étapes. Trois onglets : Mobilier, Murs & clôtures, Portes & accès.

- **Modèle** (rétro-compatible, valeurs par défaut `[]` ; `ensureAmenagements` complète les anciens jardins à la lecture et à l'import) : `items[{id, kind, x, y, rotation, width, depth, radius?, label?}]` (centre en m, cercle = `radius`), `boundaryEdges[{kind:'open'|'wall'|'fence'|'hedge', height}]` indexé par côté du contour (absent = ouvert), `openings[{id, kind:'gate'|'wicket'|'door'|'garage'|'double_gate', ref:{type:'boundary'|'obstacle', obstacleId?, side}, t, width, swing:'in'|'out'|'sliding'}]`. `validateGarden` avertit si un élément sort du terrain ou si une ouverture n'a plus de côté.
- **`items.js`** (pur) : catalogue `ITEM_KINDS` (27 éléments, dimensions, prix indicatif France, hauteur d'ombre), `OPENING_KINDS` (portail 3 m, portillon 1 m, porte 0,9 m, garage 2,4 m, double portail 4 m ; garage et porte sur maison/abri), `itemPolygon`, `openingGeometry`, `snapOpeningToSides`, `edgeObstacles` (mur 2 m, clôture 1,2 m, haie 1,8 m), `itemObstacles`.
- **Ombre** : `sun.shadowObstacles(garden)` = obstacles + côtés bâtis + éléments hauts ; utilisé par `estimateSunMap`. Les passages ne sont pas décomptés.
- **UI** : `ui/step-items.js`, `ui/draw-items.js` (+ `draw-items.css`, `ui/pop.js`). Mobilier : palette puis toucher le plan (aimantation aux côtés, grille), glisser, poignée de rotation, ↺ ↻ 90°, appui long = taille en cm, dupliquer, supprimer. Murs : toucher un côté numéroté, type + hauteur en cm, « appliquer à tous », murs/clôtures libres (obstacles `wall`/`fence`). Portes : type puis toucher un côté, glisser le long du côté, largeur par appui long, sens d'ouverture. Annuler/rétablir partout ; utilisable sans contour.
- **Rendu** : `render-items.js` (`renderItemsSVG`, `itemsLegendEntries`) ; à brancher dans `render.js`.

## 6. Ensoleillement

Facultatif, mais utilisé pour filtrer et noter les essences.

- **Mode rapide** : un seul niveau pour tout le jardin (plein soleil ≥ 6 h, mi-ombre 3–6 h, ombre < 3 h).
- **Mode cartographié** : peinture de zones d'ensoleillement sur le plan (pinceau / polygone), 3 à 4 niveaux avec légende ; cartes par saison possibles (été/hiver) en v2.
- **Mode estimé** (v2) : calcul automatique à partir de la position GPS, de l'orientation, de la trajectoire du soleil (calcul astronomique local, saisonnier), de l'horizon lointain (relief, PVGIS §11) et des obstacles saisis (hauteur de la maison, murs, arbres) → carte d'ensoleillement approximative, modifiable à la main. L'ombre des bâtiments voisins n'est pas connue des API : elle est saisie par l'utilisateur. Affichée comme estimation, jamais comme vérité.
- **Mode mesuré** (v2) : l'utilisateur marche dans son jardin, la caméra/le capteur de lumière donne une indication « soleil direct / ombre » à des moments différents de la journée, pour affiner la carte (à valider en prototype, la fiabilité du capteur variant selon les téléphones).
- Si non renseigné : une valeur inconnue → aucune essence exclue sur ce critère, mais un avertissement « ensoleillement non renseigné » sur les recommandations.
- L'ensoleillement d'une zone = niveau dominant sous sa surface (surface pondérée) ; une zone à cheval sur deux niveaux affiche les deux.

## 7. Choix des essences et recommandations

Pour chaque zone, l'écran « Essences » propose le catalogue **filtré par défaut** sur :

1. la région / zone de rusticité (exclusion des essences non rustiques) ;
2. le type de zone (une essence de mare ne s'affiche pas en zone Terrasse) ;
3. l'ensoleillement de la zone ;
4. la place disponible (dimensions adultes vs surface/dimension de la zone) ;
5. le sol et le vent s'ils sont connus.

Chaque essence reçoit un **score de compatibilité** (0–100) et un statut : « Idéale », « Possible », « Déconseillée » (masquée par défaut, affichable) avec la liste des critères satisfaits ou non. Filtres manuels : feuillage, floraison (mois), hauteur, mellifère, comestible, faible entretien, faible besoin en eau, non toxique (enfants/animaux), non invasive. Recherche texte (nom commun/latin).

- Sélection d'une essence → ajout à la zone avec **quantité suggérée** calculée (surface ÷ emprise adulte, densité de plantation) ; ajustable.
- Contrôle de cohérence : surdensité, essence trop haute près d'une terrasse/piscine, racines agressives près de la maison, association défavorable ou favorable (compagnonnage au potager), mélange de besoins en eau très différents dans une même zone (avertissement).
- Mode « Surprends-moi » : proposition automatique d'une sélection équilibrée pour une zone (hauteurs étagées, floraison étalée sur l'année, persistants/caducs), que l'utilisateur peut accepter ou retoucher.
  - **Demande d'ambiance** : « 🎲 Surprends-moi » (zone) ouvre d'abord « Quelle ambiance pour cette zone ? » (pastilles emoji + nom + description, « Peu importe » ; défaut = `zone.ambiance` ou ambiance détectée dans le nom). « Surprends-moi pour tout le jardin » demande l'ambiance zone par zone dans une seule fenêtre (une ligne par zone plantable, « Même ambiance pour toutes », « Valider »). La validation enregistre `zone.ambiance` puis appelle `suggestSelection(…, {ambiance})` ; « Autre proposition » reprend la même ambiance (nouvelle graine, sans nouvelle fenêtre) ; budget max et annulation inchangés. Résumé : « 8 essences · ambiance bucolique · floraison de mars à octobre · ≈ 210 € ». En tête de chaque zone : nom, ambiance et « Changer l'ambiance ». Les recommandations manuelles tiennent compte de l'ambiance (raison « ambiance ») avec une pastille « ✓ ambiance » sur les essences typiques.

### Ambiances (« Surprends-moi »)

Chaque zone peut avoir une **ambiance souhaitée** (`zone.ambiance`, id ou `null` = peu importe ; champ absent = `null`). `ambiances.js` fournit `AMBIANCES` (`{id, label, emoji, desc, keywords}`), `getAmbiance(id)`, `detectAmbiance(texte)` (mot d'ambiance explicite dans le nom de la zone, insensible à la casse et aux accents, mots entiers ou radicaux : « Massif bucolique » → `bucolique`, « jardin japonais » → `zen`), `plantAmbiances(plant)`, `plantAmbianceScore(plant, id)` (0–1 : 1 très typique, 0,5 compatible, 0 contraire ; typique à partir de 0,7) et `isTypical`.

- Les affinités viennent de `data/plants/ambiances-tags.js` : pour chacune des 213 essences, 2 à 4 ambiances typiques (par pertinence) et éventuellement `avoid` (ambiances à éviter). Repli heuristique pour une essence sans tag (comestible → gourmand, mellifère → pollinisateurs, graminée → contemporain/zen/sauvage…).
- Ambiances : `bucolique` (champêtre, vivaces rustiques), `decoratif` (floraisons et feuillages spectaculaires), `sauvage` (indigènes, peu d'entretien, faune), `zen` (sobre, japonais), `mediterraneen` (plantes sèches, feuillage gris), `gourmand` (comestibles), `romantique` (roses, clématites, pastels), `contemporain` (minimaliste, graminées), `exotique` (grands feuillages), `pollinisateurs` (mellifères), `apaisant` (blanc, bleu, vert), `colore` (couleurs, floraison étalée).
- `scorePlant(plant, ctx)` accepte `ctx.ambiance` : bonus jusqu'à +15, malus de 20 pour une essence à éviter, raison `{criterion:'ambiance'}` ; le résultat porte alors `rank` (score non plafonné, utilisé pour le tri). `contextForZone` / `recommendForZone` prennent par défaut `zone.ambiance`, sinon `detectAmbiance(zone.label)` ; `ambiance: null` désactive.
- `suggestSelection(garden, zone, {seed, budget, max, plants, ambiance})` pondère fortement les essences de l'ambiance et garantit au moins 70 % d'essences typiques quand le catalogue le permet (sans exclusion dure), en gardant hauteurs étagées et floraison étalée. `suggestForGarden(garden, {seed, budget, ambiances:{zoneId:id|null}, plants})` → `[{zoneId, selection}]` pour toutes les zones plantables (hors piscine et allée), chacune avec son ambiance (celle de `ambiances`, sinon `zone.ambiance`, sinon détectée dans le nom).

### Niveau d'entretien (« Main verte », « Peu d'entretien », « Pas d'entretien »)

- Niveau souhaité pour le jardin (`garden.context.maintenance`) et, facultativement, par zone (`zone.maintenance`, absent = celui du jardin) : `'green'` (🧤 Main verte, tout est permis), `'low'` (🌿 Peu d'entretien, quelques gestes par an), `'none'` (🛋 Pas d'entretien, on plante et on oublie). Absent ou `null` = `'green'` : aucune restriction (comportement antérieur).
- `maintenance.js` (pur) : `MAINTENANCE_LEVELS`, `getMaintenanceLevel`, `levelForZone(garden, zone)` (zone > jardin > green), `plantEffort(plant)` (1 léger, 2 moyen, 3 soutenu), `effortLabel`, `effortBadge` (🧤×n), `fitsMaintenance(plant, level)` → `{ok, penalty, bonus, discouraged, text}`.
- Effort : base `maintenance` (low 1, medium 2, high 3) ; +1 pour potager, pelouse, haie, fruitier, `water: 'high'`, taille sur plus de 2 mois (`care.pruneMonths`) ; −1 pour graminées, couvre-sols, arbustes persistants rustiques (≤ −10 °C) et essences `windTolerant` à `water: 'low'` (sauf catégories exigeantes) ; borné à 1–3 (plus de 100 essences d'effort 1).
- `low` : effort 3 = −25 et « Demande pas mal d'entretien : déconseillée si vous voulez peu d'entretien ». `none` : effort 1 = +10 (« Très peu d'entretien : on plante et on oublie »), effort 2 = −30, effort 3 = écartée (déconseillée). Raison `{criterion:'entretien'}` seulement pour `low`/`none` ; le tri (`rank`) met en tête les essences légères.
- `scorePlant(plant, {…, maintenance})`, `contextForZone`, `recommendForZone(…, {maintenance})`, `suggestSelection(…, {maintenance})`, `suggestForGarden(…, {maintenance})` (défaut : `levelForZone`) : `none` ne choisit que des essences d'effort 1 tant que le catalogue le permet (sinon complète avec effort 2), `low` privilégie effort ≤ 2. `checkCoherence` avertit si une zone `none` contient une essence d'effort ≥ 2.
- UI : en tête de l'étape Essences, « Quel niveau d'entretien ? » (3 grosses pastilles) ; dans l'en-tête de zone, « Entretien de cette zone » (comme le jardin / 🧤 / 🌿 / 🛋) ; chaque carte affiche « 🧤×n Entretien : léger/moyen/soutenu » et, si elle ne convient pas, « demande de l'entretien » (raison dépliable dans « Pourquoi ? »). Le filtre « Faible entretien » suit le niveau (`none` : effort 1 seulement). « Surprends-moi » utilise le niveau de la zone, sinon du jardin, sans question ; la fenêtre d'ambiance le rappelle (« Niveau d'entretien : 🌿 peu d'entretien — changer ») et le résumé l'indique (« … · 🌿 peu d'entretien · … »). Le niveau du jardin se règle aussi à l'étape Contexte (« Votre niveau de jardinage »). L'annulation d'une proposition ne touche pas au niveau d'entretien (jamais modifié par la proposition).
- Fichiers : `maintenance.js`, `ui/maintenance-picker.js` ; tests `maintenance.test.js`, `recommend-maintenance.test.js`, `maintenance-picker.dom.test.js`, e2e `entretien.spec.js`.

## 8. Rendu vectoriel

- Génération d'un **plan SVG** : contour coté, zones colorées avec motifs, essences représentées par des symboles (cercle d'emprise adulte + pictogramme par catégorie), obstacles, nord, échelle, légende, cartouche (nom du jardin, surface, région, date).
- Deux vues : « Plan » (technique, cotes) et « Illustré » (couleurs plus riches, ombres portées simples). Option : afficher l'emprise à 1 an / à maturité (curseur d'âge).
- Zoom/pan, bascule des calques (cotes, légende, ensoleillement, noms des essences).
- Actions : **Valider** (statut `validated`, enregistrement du SVG et de la date, déverrouille les conseils), **Modifier** (retour aux étapes), **Exporter** (SVG, PNG, PDF à l'échelle imprimable A4/A3, JSON).
- **Piscine hors sol** : plan 2D = double contour (liseré sombre, margelle claire, liseré fin) et motif d'eau dédié, légende « Piscine hors sol » ; vue isométrique / élévations = paroi extrudée de 1,2 m ombrée selon l'orientation, intérieur, eau à 1,05 m, margelle et échelle d'accès. La piscine enterrée est inchangée.
- Le SVG est régénérable à tout moment depuis le modèle : il n'est pas la source de vérité.

## 9. Conseils (après validation)

Écran « Conseils » du jardin, organisé par zone et par essence, avec un **calendrier mensuel** consolidé pour tout le jardin.

- **Plantation** : meilleure période selon la région, profondeur/distance, préparation du sol, tuteurage, paillage, ordre de plantation conseillé du chantier (gros œuvre → arbres → arbustes → vivaces → couvre-sols).
- **Entretien** : taille (période et méthode), division, nettoyage, tonte, curage de la mare, traitements naturels des problèmes fréquents, protection hivernale selon la rusticité et la région.
- **Arrosage** (voir ci-dessous).
- **Engrais** : type conseillé (compost, fumier, engrais organique, engrais spécifique), période, dose indicative par m² ou par plante, précautions.
- **Récolte** pour les comestibles.
- Alertes saisonnières « ce mois-ci » sur l'accueil du jardin (liste de tâches cochables, stockée localement).

### Arrosage

- Chaque essence a un besoin (faible/moyen/élevé), chaque zone est classée en **hydrozone** (regroupement des besoins). Le plan met en évidence les hydrozones et signale les incompatibilités.
- Calcul indicatif des besoins : litres/semaine par zone selon le besoin des essences, la saison, la pluviométrie de la région, le sol (retenue d'eau), l'ensoleillement et l'âge de la plantation (arrosage de reprise la première année).
- **Notifications d'arrosage** (§9 bis).
- Planning : fréquence et moment de la journée, par mois ; recommandation de paillage et de récupération d'eau de pluie (volume de cuve suggéré à partir de la surface de toit renseignée, si disponible).
- Matériel suggéré par zone : goutte-à-goutte, tuyau poreux, arrosage au pied, aspersion pour la pelouse ; longueurs et nombre de points d'arrosage estimés depuis le plan.
- Les chiffres sont des **ordres de grandeur** ; le texte le rappelle et invite à adapter au terrain.

Les conseils proviennent du catalogue (`care` par essence) et de règles génériques par catégorie (arbre, arbuste, vivace, couvre-sol, aquatique, pelouse, potager) ; le contenu est rédigé à la main, sans appel à un service externe.

## 9 bis. Notifications d'arrosage

- **Locales** (aucun serveur ni push distant) : planifiées par l'app via les notifications locales Capacitor, donc gratuites et fonctionnelles hors ligne.
- **Contenu** : « Arroser le massif sud ce soir (≈ 15 L) », par hydrozone, avec action « Fait », « Reporter » ou « Il a plu ». Regroupement d'une seule notification par jour à l'heure choisie (soirée ou matin tôt par défaut en été).
- **Calcul** : bilan hydrique simple par zone, alimenté par la pluie réelle et prévue et l'évapotranspiration de référence (ET₀) de la météo (§11), pondérée par un coefficient par essence/zone, le sol et l'âge de la plantation. Déclenchement quand le déficit estimé dépasse un seuil. La pluie prévue ou tombée supprime ou décale l'arrosage.
- **Fraîcheur des données** : la météo est récupérée à l'ouverture de l'app et, par tâche de fond périodique (WorkManager, via Capacitor ; l'exécution exacte reste à la discrétion d'Android : mode économie d'énergie, Doze) ; l'app planifie à l'avance les 3 à 7 prochains jours et **ré-évalue** à chaque rafraîchissement (annule/remplace les notifications obsolètes). Si aucune donnée récente, repli sur le calendrier théorique (fréquence moyenne mensuelle du §9) et mention « estimation sans météo ».
- **Réglages** : heure, jours, par zone ou par jardin, activation/désactivation, « ne pas déranger », mode vacances, alertes gel (protéger les plantes frileuses) et canicule.
- Autres notifications facultatives : tâche du mois (taille, plantation), rappel de rentrer une plante en pot.
- Permission demandée au moment de l'activation (pas au premier lancement), avec explication préalable.

## 10. Architecture technique (proposition)

- **Plateforme** : application web en modules ES (sans framework imposé, SVG pour le plan) empaquetée avec **Capacitor** pour **Android uniquement** (dossier `jardin-android/` sur le modèle de `flash-guess-android`, `mob-rush-android`, `reveil-xtrem-android` : `capacitor.config.json`, `package.json`, `src/`) ; plugins : géolocalisation, boussole/orientation, notifications locales, tâches de fond, système de fichiers/stockage, partage. Cela garde la même base de code que les autres apps du dépôt ; une app React Native/Expo n'est envisagée que si le dessin tactile se révèle insuffisant en webview (à prototyper tôt, §15).
- `jardin/index.html` (liste des jardins) + `jardin/editor.html` (assistant).
- Modules : `geometry.js` (aire, périmètre, intersection, point-dans-polygone, lacet, conversion GPS→mètres — pur et testé), `model.js` (types, validation), `storage.js` (IndexedDB, export/import), `catalog.js` + `data/plants.json`, `recommend.js` (filtres, score — pur et testé), `sun.js` (trajectoire du soleil, cartographie, estimation), `weather.js` (appels Open-Meteo, cache, repli hors ligne), `watering.js` (bilan hydrique, planification des notifications — pur et testé), `notify.js` (pont Capacitor), `geo.js` (GPS, boussole, géocodage), `render.js` (SVG), `advice.js` (conseils, calendrier), `ui/*` (étapes).
- Tests Jest (comme le reste du dépôt) sur `geometry`, `recommend`, `watering`, `advice`, `storage` (mock) ; test Playwright du parcours complet (créer un jardin, tracer, zoner, choisir, valider) avec GPS/boussole simulés.
- Accessibilité : alternatives clavier au dessin (saisie numérique des côtés), contrastes, textes alternatifs du plan (liste des zones et essences).

## 11. Sources de données (API gratuites)

Principe : n'utiliser que des API **gratuites, sans compte ou sans clé secrète**, appelées depuis l'app (une clé embarquée dans une app mobile n'est pas secrète). Chaque appel est mis en cache localement, avec repli hors ligne. Les points marqués « à vérifier » n'ont pas pu être confirmés par la recherche et doivent être validés (conditions d'usage, quotas) avant d'être figés dans le code.

| Besoin | Source | Remarques |
|---|---|---|
| **Météo, pluie, ET₀** (arrosage, gel) | [Open-Meteo](https://open-meteo.com/en/docs) : prévision jusqu'à 16 jours, variable `et0_fao_evapotranspiration` (ET₀ FAO-56, recommandée pour l'irrigation), précipitations, températures ; modèles Météo-France ([doc](https://open-meteo.com/en/docs/meteofrance-api)) | Gratuit **pour usage non commercial**, sans clé. Si l'app devient commerciale : offre payante ou autre source. Historique et climatologie via l'API archive d'Open-Meteo (à vérifier). Détails : [ET₀](https://openmeteo.substack.com/p/reference-evapotranspiration-for) |
| **Commune, département, région** depuis des coordonnées | [API Géo / Découpage administratif](https://www.data.gouv.fr/en/dataservices/api-decoupage-administratif-api-geo/) (geo.api.gouv.fr) | Recherche par coordonnées, nom, code postal. Gratuité et absence de clé : à vérifier sur la doc officielle |
| **Géocodage / recherche d'adresse** | [Géoplateforme IGN, service de géocodage](https://www.data.gouv.fr/dataservices/api-geoplateforme-geocodage/discussions) | `api-adresse.data.gouv.fr` est **en cours d'arrêt** (fin janvier 2026) au profit de la Géoplateforme : utiliser la Géoplateforme uniquement |
| **Altitude** (rusticité, climat) | Altimétrie de la Géoplateforme IGN (à vérifier : URL et quotas) ; alternative : API Elevation d'Open-Meteo | L'altitude corrige la zone de rusticité (≈ −0,6 °C / 100 m) |
| **Horizon / relief lointain** (ensoleillement estimé, v2) | [PVGIS (Commission européenne, JRC)](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en) : `printhorizon`, rayonnement | Gratuit, sans inscription ; limites : relief au pas de ~90 m, ignore maisons et arbres proches ; conditions d'usage commercial non confirmées. Le calcul de la course du soleil se fait localement |
| **Fond de carte / vue satellite** | Géoplateforme IGN (tuiles WMTS orthophotos et plan IGN) ou OpenStreetMap (usage modéré, respecter la politique d'usage des tuiles) | Pour caler le plan ; tuiles à mettre en cache raisonnablement |
| **Sol** (argile, sable) | SoilGrids (ISRIC) : le service REST est **actuellement suspendu** ([source](https://rest.isric.org/)) ; données sous CC BY 4.0 mais non interrogeables en direct. À défaut : saisie par l'utilisateur, aide par test du boudin/test de l'eau expliqué dans l'app | Ne pas bâtir de fonctionnalité sur SoilGrids en v1 |
| **Noms de plantes** (nom latin, synonymes, vérification) | [TAXREF / INPN](https://inpn.mnhn.fr/) (référentiel taxonomique français), [GBIF Species API](https://techdocs.gbif.org/en/openapi/) (`/species/match`, sans clé) | Pour **normaliser** les noms du catalogue, pas pour les conseils de culture |
| ~~Identification d'une plante par photo~~ | Pl@ntNet API | **Écarté** (pas de mode « jardin existant ») ; voir ci-dessous |
| **Photos de plantes** | Wikimedia Commons / Wikipédia (API libre, licences à respecter et à créditer) | Chargées à la demande, mises en cache |
| **Données de culture** (soleil, arrosage, rusticité) | **Aucune API gratuite fiable adaptée au jardinage français** identifiée | Voir ci-dessous |

### Pl@ntNet : écarté

Pl@ntNet (identification par photo, gratuit jusqu'à 500 requêtes/jour par clé, quota partagé entre utilisateurs et clé non secrète dans un APK) a été étudié pour un mode « jardin existant ». Ce mode n'est **pas retenu** : aucune dépendance à Pl@ntNet. Il ne fournirait de toute façon pas de données de culture.

### Le catalogue de plantes : décision

Les API de plantes grand public (Perenual, Trefle, etc.) sont soit limitées en gratuit, soit non vérifiées, soit sans données pertinentes pour la France (rusticité en zones USDA, essences américaines) ; les limites exactes du plan gratuit de Perenual n'ont pas pu être confirmées. Elles ne conviennent pas comme dépendance d'une app dont le cœur est la recommandation. **Décision : un catalogue embarqué, rédigé et vérifié par nous (`data/plants.json`, ~150 essences courantes en France pour le MVP), servi hors ligne**, dont les noms sont validés par TAXREF/GBIF et les illustrations obtenues via Wikimedia. On pourra l'enrichir à la marge (descriptions, photos) par API, jamais pour les critères qui pilotent les filtres (rusticité, ensoleillement, besoin en eau). La rusticité est exprimée en température minimale (°C), convertible en zone USDA.

### Données climatiques par zone

La zone de rusticité et la pluviométrie de référence ne viennent pas d'une API en direct : table embarquée par département/altitude (températures minimales de référence), complétée par le climat réel de la position via Open-Meteo.

## 12. Hors périmètre v1

Côtés courbes et relief 3D, estimation d'ombre précise heure par heure, mode « jardin existant » et reconnaissance de plantes par photo, import de plan cadastral, synchronisation multi-appareils, partage en ligne, achat de plantes, **notifications push distantes**, DROM, autres pays.

## 13. Jalons

0. **Prototype** : tracé tactile du contour au doigt (zoom, déplacement, saisie des longueurs) en Capacitor sur un vrai téléphone ; critère de réussite : fluide à 60 ips avec ~30 sommets, sinon bascule de plateforme.
1. **MVP** : localisation GPS, contexte (région, exposition à la boussole), contour métré et relevé GPS, zones, ensoleillement rapide, catalogue embarqué (~150 essences), recommandation filtrée, rendu SVG, validation, conseils généraux, arrosage avec **notifications locales** alimentées par Open-Meteo, stockage local, app Android via Capacitor (APK/AAB).
2. Export PDF/PNG,  ensoleillement cartographié, calendrier consolidé, tâches du mois.
3. Ensoleillement estimé (PVGIS + soleil local), mode « Surprends-moi », association de plantes, évolution à maturité, DROM.

## 14. Risques

- **Open-Meteo : usage non commercial seulement** : compatible avec la diffusion retenue (perso/amis) ; toute publication monétisée imposerait un abonnement ou une autre source.
- **Tâches de fond Android** non garanties (Doze, économie de batterie, constructeurs agressifs) : d'où la planification à l'avance de plusieurs jours et le repli calendaire. Les notifications exactes demandent la permission « alarmes et rappels » (Android 12+) et la permission de notification (Android 13+), à demander au moment de l'activation ; guider l'utilisateur vers les réglages si la batterie bloque l'app.
- **Précision du GPS et de la boussole** d'un téléphone (plusieurs mètres, interférences magnétiques) : toujours afficher la précision et permettre la correction manuelle.
- **Dépendance à des API publiques** qui évoluent (cf. arrêt de l'API Adresse, suspension de SoilGrids) : isoler chaque source derrière un module et prévoir des replis.
- **Effort éditorial** du catalogue (150 essences fiables) : c'est le vrai coût du projet.
- **Webview vs natif** pour le dessin tactile fluide : à prototyper avant de s'engager.

## 15. Décisions

- **Diffusion** : usage personnel / amis, APK installé à la main, sans revenu (donc Open-Meteo gratuit utilisable).
- **Android minimum** : Android 13 (API 33) : permission de notification native, pas de gestion des anciennes versions.
- **Métré** : précision au centimètre ; **pas d'import** de plan (ni cadastre ni image de fond) : on part d'une feuille blanche ou du relevé GPS.
- **Pas de mode « jardin existant »** ni d'identification par photo (Pl@ntNet écarté).
- **Plateforme** : prototype du dessin tactile en Capacitor **en tout premier jalon** ; bascule vers React Native/Expo si la fluidité est insuffisante.

## 16. Contrat des modules (implémentation)

Dossier web : `jardin/` (ES modules, sans build, sans dépendance runtime). Enveloppe Android : `jardin-android/` (`webDir: ../jardin`). Tests : `jardin/tests/unit/*.test.js` (Jest, node) et `*.dom.test.js` (jsdom) ; lancer `NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects jardin-node jardin-jsdom`. Tous les textes visibles sont en français.

### Conventions
- Unités : mètres. Repère du plan : x vers la droite, y vers le bas (écran). `northAngle` (degrés, sens horaire) = rotation du nord par rapport au haut du plan (0 = nord en haut). Azimut/cap : degrés depuis le nord, sens horaire.
- `Point = {x, y}`. `LatLon = {lat, lon}`. Identifiants : `newId()` (`model.js`).
- Mois : entiers 1–12. Températures en °C. Niveaux de soleil : `'full'` (≥ 6 h) | `'partial'` (3–6 h) | `'shade'` (< 3 h). Besoin en eau : `'low'|'medium'|'high'`.
- Forme d'une zone (`zone.shape`) : `{kind:'polygon', points:Point[]}` | `{kind:'circle', center:Point, radius:number}` | `{kind:'line', points:Point[], width:number}` (allée, haie).

### `model.js`
- `ZONE_TYPES` : tableau `{id, label, color, icon (emoji), layer:'ground'|'canopy', shapeKinds:string[], defaultWidth?:number, minSun?:'full'|'partial'|'shade'|null}` pour : `pond, pool, terrace, path, lawn, lowplants, midplants, tallplants, hedge, trees, vegetable, orchard, other`.
- `SUN_LEVELS`, `WATER_NEEDS`, `PLANT_CATEGORIES` (`tree, shrub, hedge, fruit, climber, perennial, groundcover, grass, bulb, aquatic, vegetable, lawn`), `SOILS` (`clay, limestone, sandy, loam, humus`), `ORIENTATIONS` (`N,NE,E,SE,S,SW,W,NW` avec azimut), `newId()`.
- `createGarden(name)` → `{id, name, createdAt, updatedAt, status:'draft', context:{location:null|{lat,lon,accuracy?}, commune:null|string, departement:null|string (code INSEE), region:null|string, altitude:null|number, orientation:null|number (azimut du fond du jardin), northAngle:0, soil:null, slope:null, wind:null, roofArea:null}, boundary:Point[], boundaryClosed:false, obstacles:Obstacle[], sun:{mode:'unknown'|'uniform'|'map', uniform:null|SunLevel, regions:[{id, level, points:Point[]}]}, wishedZoneTypes:string[], zones:Zone[], plan:{svg:null, validatedAt:null}, tasksDone:{}}`.
- `Obstacle = {id, kind:'house'|'wall'|'shed'|'tree'|'fence', points?:Point[], center?:Point, radius?:number, height:number}`.
- `Zone = {id, type, label, shape, plantings:[{plantId, count}], notes, ambiance:null|string}` ; `createZone(typeId, shape)`.
- `validateGarden(g)` → `{ok, errors:string[], warnings:string[]}` (contour simple et fermé, surface > 1 m², zones dans le contour, chevauchement de zones « ground », zones souhaitées sans forme).
- `getZoneType(id)`.

### `geometry.js` (pur)
`distance(a,b)`, `polygonArea(points)` (≥ 0), `signedArea`, `perimeter(points, closed=true)`, `centroid`, `bounds(points)` → `{minX,minY,maxX,maxY,width,height}`, `pointInPolygon(p, points)`, `segmentsIntersect`, `isSimplePolygon`, `shapePolygon(shape, segments=24)` → `Point[]` (cercle échantillonné, ligne épaissie), `shapeArea(shape)`, `shapeBounds(shape)`, `overlapArea(polyA, polyB)` (approx. par échantillonnage, résolution 0,05 m), `polygonInside(inner, outer)`, `snapPoint(p, {grid, points, tolerance, ortho:{from}})`, `pointFromLengthBearing(from, length, bearingDeg)` (bearing relatif au haut du plan, 0 = haut, horaire), `bearing(a,b)`, `closeGapReport(points)` (écart de fermeture + correction répartie), `translatePolygon`, `gpsToLocal(latlons, origin?)` → `{points:Point[], origin}` (plan tangent, x = est, y = −nord), `localToGps(point, origin)`, `haversine(a,b)`.

### `sun.js` (pur)
`sunPosition(lat, lon, date)` → `{azimuth, elevation}` (degrés), `sunHoursOnPoint(point, {lat, lon, northAngle, obstacles, date})`, `estimateSunMap(garden, {date})` → `[{level, points}]` (régions par grille 0,5 m), `levelFromHours(h)`, `zoneSunLevel(garden, zone)` → `{level|null, dominant, share:{full,partial,shade}}` selon `garden.sun`.

### `storage.js`
`createStorage(backend?)` avec backend IndexedDB (repli mémoire) ; API asynchrone : `listGardens()`, `getGarden(id)`, `saveGarden(g)` (met à jour `updatedAt`), `deleteGarden(id)`, `duplicateGarden(id)`, `exportGarden(g)` → string JSON `{format:'jardin-v1', garden}`, `importGarden(json)` (valide, nouvel id), `getSettings()`, `saveSettings(s)` avec `settings = {notifications:{enabled, hour:19, minute:0, frost:true, heat:true, monthlyTasks:true, vacationUntil:null}, units, apiCache}`. Export par défaut `storage` (instance partagée).

### Données `data/`
- `data/plants/woody.js` et `data/plants/herbaceous.js` exportent chacun `default` : tableau de `Plant`. `data/plants/index.js` : `plants` (concat), `plantsById`.
- `Plant = {id (slug), commonName, latinName, category, heightAdult, widthAdult (m), sun:SunLevel[], hardiness (°C mini supportée, négatif), water, soil:string[] (sols tolérés, [] = tous), foliage:'deciduous'|'evergreen'|'semi'|'none', bloom:number[], bloomColor?:string, harvest?:number[], zones:string[] (ids de ZONE_TYPES), invasive?:boolean, toxic?:boolean, melliferous?:boolean, edible?:boolean, maintenance:'low'|'medium'|'high', windTolerant?:boolean, kc:number (coefficient cultural 0.3–1.1), spacing:number (m, distance entre plants), care:{plantMonths:number[], pruneMonths:number[], fertMonths:number[], planting:string, pruning:string, fertilizer:string, watering:string, notes:string}}`.
- `data/climate.js` : table des 96 départements métropolitains `{code, name, region, tminC (minimum extrême moyen annuel de référence), rainMm (annuel), frostFreeFrom, frostFreeTo (mois), zoneUSDA}`.

### `climate.js` / `catalog.js` / `recommend.js` (purs)
- `climate.js` : `climateForDepartement(code)`, `regions()`, `adjustTminForAltitude(tminC, altitudeM)`, `hardinessZone(tminC)` (zone USDA), `departementFromCommuneCode(insee)`.
- `catalog.js` : `allPlants()`, `getPlant(id)`, `searchPlants(query)` (nom commun/latin, sans accents), `filterPlants(plants, filters)` (filtres du §7 : `foliage, bloomMonth, heightMax, melliferous, edible, lowMaintenance, lowWater, nonToxic, nonInvasive, category`).
- `recommend.js` : `scorePlant(plant, ctx)` avec `ctx = {tminC, zoneType, sunLevel|null, areaM2, minDimension, soil|null, windy:boolean|null}` → `{score:0-100, status:'ideal'|'possible'|'discouraged', reasons:[{ok:boolean|null, criterion, text}]}` ; `recommendForZone(garden, zone, {includeDiscouraged=false, filters})` → `[{plant, ...score}]` trié ; `suggestQuantity(plant, zone)` ; `checkCoherence(garden)` → `[{level:'warn'|'info', zoneId?, text}]` ; `suggestSelection(garden, zone, {seed, budget, max, plants, ambiance})` (« Surprends-moi »), `suggestForGarden` (voir §7, Ambiances).

### Services (`weather.js`, `geo.js`, `notify.js`, `watering.js`, `advice.js`)
- `weather.js` : `fetchForecast({lat, lon, days=7}, {fetchImpl=fetch, cache})` → `{fetchedAt, stale:boolean, daily:[{date:'YYYY-MM-DD', precipMm, et0Mm, tminC, tmaxC}]}` (Open-Meteo `forecast`, daily `precipitation_sum, et0_fao_evapotranspiration, temperature_2m_min, temperature_2m_max`, `timezone=auto`, + `past_days=3`) ; repli sur cache localStorage ; `parseOpenMeteo(json)` pur.
- `geo.js` : `getPosition({samples=5, timeoutMs})` (Capacitor Geolocation sinon `navigator.geolocation`, moyenne des échantillons → `{lat, lon, accuracy}`), `watchHeading(cb)` → `stop()` (cap magnétique corrigé), `reverseCommune(lat, lon, {fetchImpl})` → `{commune, departement, region, codeInsee}` (geo.api.gouv.fr), `searchAddress(q, {fetchImpl})` → `[{label, lat, lon}]` (Géoplateforme `data.geopf.fr/geocodage/search`), `fetchElevation(lat, lon, {fetchImpl})` → mètres (Géoplateforme altimétrie, repli Open-Meteo elevation), `magneticDeclination(lat, lon, date)` approximation.
- `watering.js` (pur) : `hydrozones(garden)` → `[{id, level:'low'|'medium'|'high', zoneIds, areaM2, avgKc}]`, `waterNeed(zone, garden, day)` (L/jour), `planWatering(garden, forecast, state, now, settings)` → `{notifications:[{id:number, at:ISO string, title, body, zoneIds}], summary:[{zoneId, litersPerWeek}], skipped:[{date, reason}]}` (bilan hydrique : ET₀ × kc × surface − pluie efficace, déclenchement quand déficit > seuil, jamais deux jours consécutifs sauf canicule, alerte gel si `tminC` ≤ 2 °C et plantes frileuses, repli calendaire sans météo), `monthlySchedule(garden)` (fréquence et litres par mois, par zone).
- `notify.js` : `ensurePermission()`, `scheduleAll(list)` (annule les notifications `jardin-*` obsolètes puis planifie ; Capacitor LocalNotifications, repli `Notification` web / no-op), `cancelAll()`, `refreshAndSchedule(garden, settings)` (météo → `planWatering` → `scheduleAll`).
- `advice.js` (pur) : `buildAdvice(garden)` → `{zones:[{zoneId, zoneLabel, plants:[{plant, count, planting, pruning, fertilizer, watering, notes}]}], plantingOrder:string[], general:{...}}` ; `calendar(garden)` → 12 mois `[{month, tasks:[{kind:'plant'|'prune'|'fertilize'|'water'|'harvest'|'protect', zoneId, plantId?, text}]}]` ; `tasksForMonth(garden, month)` ; `genericCare(category)` (conseils par catégorie quand la fiche d'essence est incomplète) ; `frostProtection(garden, tminC)`.

### UI (`ui/*.js`, `render.js`, `app.js`, `index.html`, `style.css`)
- `index.html` : page unique (liste des jardins + assistant + écrans conseils/réglages) avec routeur par hash (`#/`, `#/garden/:id/:step`, `#/garden/:id/advice`, `#/settings`). `app.js` pilote ; les étapes sont : `context`, `boundary`, `wished`, `sun`, `zones`, `plants`, `render`.
- `render.js` : `renderPlanSVG(garden, {view:'plan'|'illustrated', age:'adult'|'young', layers:{dims, legend, sun, names}, width, height})` → string SVG autonome.
- `ui/draw.js` : `mountContourEditor(el, {garden, onChange})` (tracé au doigt, saisie des longueurs, relevé GPS, obstacles) et `mountZoneEditor(el, {garden, onChange})` (formes polygone/cercle/ligne par type, déplacement, suppression) et `mountSunPainter(el, {garden, onChange})`. Ils modifient `garden` en place puis appellent `onChange(garden)`.
- `ui/plan-step.js` : `mountPlanStep(el, {garden, onValidate, onBack})` ; `ui/advice-screen.js` : `mountAdvice(el, {garden})` ; `ui/settings.js` : `mountSettings(el)`.
- Chaque module `ui/*.js` exporte une fonction `mountX(el, props)` qui retourne `unmount()`.

## 17. État de l'implémentation

**Fait** (810 tests unitaires Jest, 11 parcours Playwright dans `jardin/tests/e2e/`, projet `jardin` de `playwright.config.js` ; CI : job `test` et job `jardin-e2e` de `.github/workflows/ci.yml`) :
- Logique pure : géométrie et conversion GPS, modèle et validation, trajectoire du soleil et carte d'ensoleillement estimée, stockage IndexedDB avec export/import JSON, climat par département (96 + Corse), catalogue de 213 essences (111 ligneuses, 102 herbacées), score de compatibilité, quantités, cohérence, « Surprends-moi », météo Open-Meteo, géocodage, commune, altitude, bilan hydrique et planification des notifications, conseils et calendrier 12 mois.
- Interface : accueil (plusieurs jardins, vignettes, dupliquer, supprimer, import/export), assistant en 7 étapes, tracé du contour au doigt avec saisie des longueurs et relevé GPS, obstacles, zones (polygone, cercle, ligne), ensoleillement uniforme, peint ou estimé, choix des essences avec raisons, rendu SVG plan/illustré/jeunes plants, export SVG et PNG, validation, conseils par onglets, tâches du mois, réglages de notifications.
- Android : `jardin-android/` (Capacitor, API 33 minimum, notifications locales, géolocalisation) et workflow `.github/workflows/apk-jardin.yml`.

**Écarts avec les specs précédentes** :
- Export PDF et export JSON depuis l'écran du plan non faits (export JSON disponible depuis l'accueil).
- Conseils, hydrozones et planning d'arrosage faits ; matériel d'arrosage suggéré et volume de cuve non faits.
- Mode d'ensoleillement « mesuré » (capteur de lumière) non fait ; le mode « estimé » est enregistré comme `sun.mode = 'map'`.
- Les données du catalogue sont issues de connaissances horticoles générales, non vérifiées en ligne : à relire avant diffusion.

- Relevé GPS guidé (§4 bis) : tests Jest (`gps-survey`, `geo-watch`, `gps-survey-ui.dom`) et Playwright `gps.spec.js` avec géolocalisation simulée (rectangle 10 × 8 m, précision faible, refus, reprise). La précision réelle d'un récepteur, le comportement du verrouillage d'écran et du Wake Lock ne sont pas testables sans appareil.
- Indicateur du nord (§4 bis) : pastille sur les éditeurs, réglage « Orienter le plan » (boutons, angle, boussole), tests Jest et Playwright `nord.spec.js`.

**Non vérifié** : GPS, boussole, notifications et build de l'APK sur appareil réel ou en CI (le workflow n'a pas encore tourné) ; les points « à vérifier » du §11 (altimétrie IGN, API Géo) n'ont pas été testés contre les services réels.

## Vue 3D (PC et mobile)

Visualiseur 3D temps réel du jardin (PC, et mobile quand c'est viable) : GPU pour le rendu et les ombres, CPU multicœur pour la génération des instances.

**Détection** (`ui/view3d.js`) : `isView3DCapable()` (alias conservé : `isDesktop3DCapable`) = WebGL2 disponible ET pas de `prefers-reduced-data` ; sur mobile (`isMobileDevice()` : `pointer: coarse`, largeur < 900 px ou UA Android) en plus : pas de contexte logiciel pur (SwiftShader/llvmpipe…), `navigator.deviceMemory` ≥ 3 si connu, ≥ 2 cœurs. `?3d=1` ou `localStorage['jardin-force-3d']` (hors `0`/`false`) forcent (WebGL2 reste indispensable). Branchement : bouton « 🧊 Vue 3D » → `mountView3D(el, {garden, onClose})` (retourne `unmount()` ; `unmount.api` et `unmount.ready` servent au pilotage et aux tests).

**Profil mobile** : qualité auto Basse (Moyenne si GPU mobile costaud : Adreno 7xx, Mali-G7x+, Apple) ; ombres ≤ 2048 px, `pixelRatio` ≤ 2, densité de feuillage × 0,6, MSAA seulement si GPU costaud ; rendu à la demande (pas de boucle continue au repos) et arrêt quand l'onglet est caché ; si les FPS restent < 20 pendant 3 s en animation, la qualité baisse d'un niveau avec le message « Qualité réduite automatiquement » (remontable dans les réglages). Interface tactile : réglages en feuille repliable en bas (repliée par défaut), cibles ≥ 44 px, zones sûres `env(safe-area-inset-*)`, un doigt tourne / deux doigts pincent et déplacent (OrbitControls), « À hauteur d'yeux » avec joystick virtuel + regard au glissé (pas de clavier), Fermer toujours visible, Retour Android = fermer (un état d'historique est poussé à l'ouverture). Rendu photo mobile : ≤ 48 passes et ≤ 2048 px de large, annulable.

**Fichiers** : `vendor/three/` (three.js 0.170.0 MIT, `three.module.min.js`, `OrbitControls.js` réécrit sans import map, `LICENSE`), chargé UNIQUEMENT par `import()` dynamique à l'ouverture ; `render-gl.js` (`buildScene(THREE, garden, {month, age, plantsById, hour, date, quality})` → `{scene, bounds, update({month, age, hour, date}), dispose()}` et `buildSceneAsync` via le pool) ; `gl-worker-core.js` (logique pure : répartition, matrices d'instances, importable sans Worker) ; `gl-worker.js` (Worker module) ; `gl-pool.js` (pool de `min(cœurs − 1, 8)` workers, repli synchrone, `Float32Array` transférables) ; `gl-quality.js` ; `gl-textures.js` (canvas procéduraux : gazon, bois/dalles, gravier, terre, eau, toit, clôture, haie) ; `gl-structures.js` (maison à toit, abri, murs/clôtures/haies, portails, mobilier) ; `gl-photo.js` ; `ui/view3d.js` + `ui/view3d.css`.

**Rendu** : sol et zones texturés, mare/piscine (eau réfléchissante + berge), obstacles et `boundaryEdges`/`openings`/`items` (import défensif de `items.js`). Plantes en `InstancedMesh` par essence et par partie (tronc, houppier de blobs irréguliers, cône pour les conifères, branches, touffes, fleurs) ; hauteur = `heightAdult` × (0,35 → 1) selon l'âge ; caducs ligneux dépouillés (branches) de décembre à mars, teinte automnale en octobre-novembre ; herbacées caduques en repos l'hiver ; fleurs visibles seulement les mois de `bloom`. Soleil = `DirectionalLight` selon `sunPosition` (latitude du jardin, sinon 46,5 °N), date, heure solaire et `northAngle` ; ciel dégradé (shader) et brouillard ; l'élévation règle couleurs et intensités (nuit comprise).

**Qualité** : Basse / Moyenne / Haute / Ultra (shadow map 1024 → 8192 bornée par `maxTextureSize`, MSAA, pixelRatio, détail des houppiers, densité de fleurs/touffes) ; mode Auto selon le nom du GPU (SwiftShader/llvmpipe/Software → Basse). Le changement de qualité régénère la scène via les workers. Infos affichées : « Scène générée en N ms sur K cœurs », nom du GPU (`WEBGL_debug_renderer_info`), FPS, WebGL2.

**Saisons** (`gl-season.js`, pur) : une seule source de vérité, le jour de l'année (`S.doyF` dans la vue, `state.doy` dans la scène ; la date et le soleil en découlent ; décalage de 6 mois si latitude < 0). Panneau « Saisons » en tête : curseur continu janv. → déc. avec graduations des mois, libellé en direct (« Printemps · 15 avril »), puces Hiver/Printemps/Été/Automne (15 janv., 15 avr., 21 juin, 15 oct.) et « ▶ Année accélérée » (12 mois en ≈ 15 s, vitesse × 0,5 / 1 / 2). Sur mobile, le curseur est aussi dans un bandeau fin (≥ 44 px) toujours visible quand la feuille est repliée. `plantSeasonState(plant, doy)` → densité de feuillage, vert tendre au printemps, virage d'automne (jaune/orange/rouge stable par essence), repos des herbacées, fondu de floraison (seulement les mois de `bloom`) ; pelouse vive puis douce puis paille en été sec ; lumière et brouillard selon la saison ; feuilles qui tombent en particules (qualité Moyenne et plus, hors mobile). Le rendu photo utilise la saison choisie. **Pas de neige ni de givre** : la vue ne montre que feuillage, floraison, pelouse et lumière.

**Interface** : OrbitControls amortis ; vues Dessus, 4 coins, « À hauteur d'yeux » (ZQSD/WASD + souris), Survol automatique ; heure 6 h–21 h et date avec « journée accélérée », saisons, âge avec animation « Pousse », ombres, grille 1 m, légende des essences ; Échap (ou Retour) = fermer. **Rendu photo** : N passes (16 à 256 selon la qualité) avec micro-décalage de caméra et jitter du soleil, moyenne HDR demi-flottante sur le GPU, tone mapping ACES à l'affichage, barre de progression, annulation, export PNG jusqu'à 4096 px (`saveBlob`) avec filigrane nom du jardin + date.

**Limites** : pas de précache `sw.js` (`vendor/three` ≈ 0,7 Mo : vue 3D hors ligne seulement après une première ouverture en ligne mise en cache par le navigateur) ; absente de l'APK tant que l'étape « Copy web assets » de `apk-jardin.yml` supprime `vendor/three` (à retirer pour proposer la vue 3D dans l'APK) ; l'heure est solaire (pas d'heure légale) ; la répartition des plants est celle de `gl-worker-core.js` (sans import de `render-common.js` pour ne pas charger le catalogue dans les workers) : elle diffère légèrement du plan 2D (remplissage des haies en ligne et des couvre-sol), à unifier ; modèles stylisés (pas de textures photo) ; pas de collision en marche à hauteur d'yeux.

**Tests** : `tests/unit/render-gl.test.js`, `gl-season.test.js` (état saisonnier), `gl-worker.test.js` (dont profils de qualité), `view3d.dom.test.js` (détection PC/mobile) ; e2e `tests/e2e/vue3d.spec.js` (PC 1280×800 avec UA de bureau, saisons/année accélérée, et émulation Pixel 5 393×727 ; WebGL logiciel SwiftShader ; variable `PW_CHROMIUM_PATH` pour un Chromium local).

### Ajouts depuis la première version

- **Saisie en cm** par appui long / toucher une cote (contour), éditeur de zones refait (§4, §5 bis), étape « Aménagements » (mobilier, murs, clôtures, haies, portails, portes de garage).
- **Essences** : photos Wikipédia avec repli en couleurs, prix moyens indicatifs et budget en direct, « Surprends-moi » par zone et pour tout le jardin.
- **Plan final** : vraies couleurs de feuillage et de floraison selon la saison, vues dessus / 4 isométriques / 4 élévations, feuille « Toutes les vues ».
- **Transfert PC → téléphone** : lien, QR code, code à coller, fichier ; liens profonds Android (`jardin://import/…`).
- **Vue 3D PC** (WebGL2, three.js chargé à la demande, hors APK) : bouton « 🧊 Vue 3D (PC) » sur l'écran du plan, uniquement sur grand écran avec souris et WebGL2.
- **Piscine hors sol (3D temps réel)** : paroi en caisson (polygone) ou cylindrique (cercle échantillonné à 64 côtés) de 1,2 m avec épaisseur, texture ondulée, margelle, eau à 1,05 m (reflets d'environnement comme les autres plans d'eau) et échelle (`buildPoolLadder`, `gl-structures.js`). Tests : `render-pool.test.js`.
- **Limites connues** : prix, couleurs et titres Wikipédia du catalogue issus de connaissances générales, non vérifiés ; positions des plants de la vue 3D légèrement différentes du plan 2D ; rien n'a été essayé sur un téléphone réel ni dans le build d'APK en CI.
- **Enchaînement des zones** : la palette des types de zones reste toujours visible (compacte quand une zone est sélectionnée) pour pouvoir enchaîner plusieurs affectations ; à l'étape « Aménagements », les zones déjà dessinées sont affichées sous le mobilier (couleur du type et nom).
- **Fermer une forme** : dans tous les éditeurs de formes (contour, zones en forme libre, obstacles polygonaux, murs et clôtures libres, polygones d'ensoleillement), toucher le 1er point (≥ 3 points posés) ferme la forme ; le 1er point devient un rond vert plus grand pour l'indiquer.
- **Zone d'arbres et petits arbustes** : dans une zone de type « Arbres », les arbustes de 4 m ou moins sont aussi proposés (sous-étage), sans pénalité de type de zone et avec la raison « Petit arbuste : s'associe bien aux arbres ». Le « Surprends-moi » d'une zone d'arbres choisissant au moins 3 essences garde environ un tiers de petits arbustes (au moins un) et au moins un arbre (`isSmallShrub` dans `recommend.js`).


## Ports des plantes

Chaque essence (213, ligneuses + herbacées) a un **port** (silhouette), utilisé pour modéliser les plantes en 2D / isométrique / 3D au lieu du seul dessin par catégorie. Données et logique pures, sans lien avec le rendu.

- `habits.js` : `HABITS` (38 ports : `id`, `label`, `crown`, `ratio` hauteur/largeur typique, `trunk` none|short|tall|multi, `density` 0–1, `spread` 0–1, `stems?` {min,max}, `leaf` broad|needle|blade|frond|fine|palm|floating|none, `flowerStyle` canopy|spikes|scattered|umbels|none, `note`, `support?` pour les grimpantes, `sheath` pour le bambou), `getHabit(id)`, `habitOf(plant)` (champ `habit` de la plante, sinon tag de `data/plants/habits-tags.js`, sinon déduction par catégorie / taille / nom latin), `habitParams(plant, {age})` (âge 0–1 ou `'young'`/`'adult'` : hauteur × 0,35→1 et largeur × 0,3→1 ; renvoie hauteur, largeur, ratio effectif, hauteur de tronc et de couronne, nombre de tiges selon la largeur adulte, densité, étalement, support) et `describeHabit(plant)` (phrase française).
- `data/plants/habits-tags.js` : `{ [plantId]: { habit, stems?, support?, note? } }` pour les 213 ids (support `wall|trellis|pergola|tripod` pour grimpantes et légumes grimpants).
- Répartition : arbres (round 10, spreading 6, vase 6, conical 3, umbrella 3, weeping 1, columnar 1, fruit 9), arbustes (round 13, upright 13, mound 12, arching 7, conical 2, columnar 1), bamboo 1, hedge-clipped 7, climber 8, vine 6, herb-bush 5, vivaces (upright 13, clump 9, mound 6), couvre-sols (mat 7, creeping 7), graminées (arching 5, fine 2, upright 2), fern 1, rosette 3, bulbes (spike 5, clump 6), aquatiques (floating 3, reed 5, marginal 5), potager (row 14, climbing 3), lawn 3. `palm` est défini mais sans essence au catalogue.
- Tests : `tests/unit/habits.test.js`. Limites : `ratio` d'un port est typique, le ratio réel d'une essence vient de ses dimensions ; ports choisis de mémoire horticole, à affiner.

### Rendu des ports (2D, isométrique, 3D temps réel)

Les trois rendus dessinent chaque plante selon son port (`habitOf`) et non plus seulement sa catégorie. Table commune `FAMILY` (port → famille de dessin : round, fruit, spreading, column, cone, weeping, umbrella, vase, palm, dome, mound, upright, arching, bamboo, hedge, climber, clump, spikes, mat, creeping, fountain, blades, fine, fern, rosette, bulbspike, bulbclump, floating, reed, row, tipi, herb, lawn) et utilitaires de placement dans `gl-worker-core.js` (`familyOf`, `polyAxis`, `nearestWall`, `wallSegments`, `hedgeSeg`, `applyPortLayout`).

- **Placement** (`placePlants` 2D dans `render-common.js` et 3D dans `gl-worker-core.js`) : haies taillées en rang le long de la plus grande dimension de la zone (ou de la ligne), complétées pour couvrir la longueur, orientation `rot` et longueur de tronçon `seg`/`aux` ; bambous compressés en touffes serrées (`clump`) ; grimpantes collées au mur / clôture / maison le plus proche (≤ 3 m), orientées comme lui (`wall`, hauteur de la paroi) ; couvre-sols en nappes (rayon ×1,35). Chaque plant porte `habit` et `family`.
- **Plan 2D** (`render.js`, `portSymbol`) : couronne dentelée (feuillus ; parasol à nervures, pleureur à rayons retombants, vase à centre clair, fruitier à fruits rouges de juillet à octobre), étoile (conifère, colonne), palmes, tiges dressées / arquées, faisceau de 8 cercles + plumeaux (bambou), rang arrondi orienté (haie), tiges le long du mur ou grille (grimpante), rayons (graminées), frondes à pinnules, rosette de feuilles larges, tipi de légume. Attributs `data-habit`, `data-family`. Légende « Essences » : le port en petit sous le nom (`data-role="port"`).
- **Isométrique / élévations** (`render3d.js`) : colonne (capsule), cône à 4 étages sombres, pleureur (rideau jusqu'au sol), parasol (disques plats sur tronc tordu), vase (branches évasées), palmier, tiges arquées / dressées, bambou en faisceau de chaumes courbes à nœuds et plumeaux (couleur des chaumes selon l'espèce), haie en volume continu (aussi pour une haie existante le long de ses points), grimpante contre son support (treillis ou câbles, tuteur, tiges et feuilles), rosette, graminées dressées / fines. Couleurs `foliageColor` / `flowerColor`, branches nues l'hiver, fruits en saison.
- **Vue 3D temps réel** (`render-gl.js` + `gl-worker-core.js`) : un modèle procédural par port en `InstancedMesh`, graine = id du plant. Parties ajoutées : `culm` (chaume à nœuds, couleur noire / jaune / verte par `culmColor`), `plume`, `fountain` / `upright` / `fine` (lames), `frond`, `leaf` (rosette), `pad` (feuilles flottantes), `curtain` (rideau du pleureur), `hedgebox` (pavé à arêtes arrondies, hauteur régulière, tronçons recouvrants), `arc` (tige arquée), `stem`, `spike` (épi coloré `flowerColor`), `fruit`, `slat` (lattes de treillage / pergola) ; supports = poteaux (`trunk`), lattes, cannes. Saisons : épis et fleurs suivent `bloom`, fruits de juillet à octobre (`fruitAmount`, `gl-season.js`), caducs dépouillés (parties `branch` / `arc` visibles), chaumes et conifères persistants. Qualité : nombre de tiges ×(0,45 + 0,55 × `density`), géométries de chaumes et de haies simplifiées en détail 1, mêmes plafonds d'instances. Format des enregistrements de plants : 6 nombres (x, y, rot, graine, index d'essence, `aux` = longueur de tronçon de haie ou hauteur du mur d'appui, 0 = libre).
- **Existants** : `jobsForGarden(..., { existing })` ajoute une tâche `_existing` (taille actuelle, `fixed`, jamais d'âge) ; `keep === false` = matériaux transparents (opacité 0,38) et grisés, sans ombre portée ; mêmes silhouettes dans la vue isométrique (`data-existing`, `data-ghost`, opacité 0,42).
- **Clôtures et murs par matériau** (iso `render3d.js` et 3D `gl-structures.js` : `buildLinear(..., { material, ghost })`, `linearMaterial`) : clôture bois = planches + poteaux à chapeau (brun chaud) ; métal = barreaux fins instanciés et traverses anthracite, ajouré ; béton = panneaux pleins gris clair à joints ; grillage = maille fine sur poteaux ; mur pierre / béton / brique avec textures (`brickTexture`, `stoneWallTexture`) ; hauteur réelle ; matériau absent = bois (clôture) / béton (mur) ; clôture existante `keep:false` estompée. `data-material` dans le SVG, groupe `linear-<type>-<matériau>` dans la scène.
- **Tests** : `render-habits.test.js`, `render3d-habits.test.js`, `render-gl-habits.test.js` ; e2e `tests/e2e/ports.spec.js` (jardin fixture : bambous, cyprès, pleureur, haie, clématite sur mur, miscanthus, hosta ; captures si `SHOTS_DIR`).
- **Limites visuelles** : arbres en polygones à facettes (style stylisé, pas photoréaliste) ; chaumes de bambou droits par segments (coude) ; rideau du pleureur et haie un peu lisses ; grimpantes sans suivi fin du relief du mur ; plan 2D à petite échelle retombe sur un cercle simple (< 3,4 px) ; positions 3D légèrement différentes du plan 2D hors haies / bambous / grimpantes.

## Plantes existantes

Le plan peut déclarer ce qui est **déjà là** : onglet « 🌳 Existant » de l'étape Aménagements (4ᵉ onglet, après Mobilier / Murs & clôtures / Portes & accès).

**Données** : `garden.existing = [{id, kind: 'tree'|'shrub'|'hedge'|'climber'|'perennial'|'fence'|'other', plantId|null, label, x, y, points? (haie, clôture), height, width, keep, notes, material? (clôture : 'wood'|'metal'|'concrete')}]` ; absent = []. `existing.js` (pur) : `EXISTING_KINDS` (libellés, emoji, dimensions typiques : arbre 8 × 5 m, arbuste 1,5 × 1,5, haie 1,8 × 0,8, grimpante 2,5 × 1,5, vivace 0,7 × 1, clôture 1,2 m bois / 1,5 m métal / 1,8 m béton, épaisseur 5 / 3 / 15 cm), `createExisting`, `ensureExisting` (idempotent ; **migre** les obstacles `kind:'tree'` de l'éditeur de contour en gardant leurs ids ; appelé par `ensureAmenagements`), `existingFootprint(s)` (disque ou bande ; les éléments « à retirer » sont exclus sauf `includeRemoved`), `existingShadowObstacles`, `existingSummary` (« 3 existants : 2 arbres, 1 haie »), `existingForRender(garden)` → `[{id, kind, plant, x, y, points?, height, width, keep, habit, label, material?}]` pour les rendus iso/3D, `sizeForPlant(plant, 'young'|'adult'|'old')` (taille adulte du catalogue × 0,4 / 1 / 1,15).
**Ombre** : `shadowObstacles` (donc `estimateSunMap`) inclut les existants conservés ; `zoneSunLevel` retient le plus sombre du niveau déclaré et de l'ombre des existants (si localisation connue). Clôture bois/béton : opaque ; métal : ajouré, ignoré pour l'ombre. « À retirer ou remplacer » = plus d'ombre ni d'espace occupé (plan futur), mais toujours dessiné (pastille barrée, « (à retirer) »).
**UI** (`ui/existing-panel.js` + `draw-items.js`) : palette Arbre / Arbuste / Haie / Grimpante / Vivace-massif / Clôture (3 pastilles de matériau avec aperçu du motif) ; toucher un type puis le plan (grille) ; haie et clôture en points successifs + « Terminer » (clôture : toucher le 1er point ferme la boucle) ; glisser = déplacer ; bandeau : « Quelle plante ? » (recherche catalogue avec vignette de couleur et nom latin, « Je ne sais pas / autre » = nom libre), âge Jeune/Adulte/Vieux, hauteur et largeur en cm (champs ou appui long), À conserver / À retirer, notes, dupliquer, supprimer ; compteur dans l'info ; annuler/rétablir. L'éditeur de contour crée désormais une entrée `existing` de type arbre (plus un obstacle).
**Rendu** (`render-items.js`, donc plan final sans toucher `render.js`) : arbre = houppier de la couleur de l'essence + tronc, arbuste = masse arrondie, haie = bande, grimpante = trait le long du mur le plus proche avec feuilles, vivace = touffe ; clôture : bois = lattes, métal = barreaux fins + poteaux, béton = trait plein épais (`fenceMarkup`, aussi utilisé pour les murs et clôtures du contour) ; légende `itemsLegendEntries`.
**Matériaux** (`items.js` : `MATERIALS`, `EDGE_MATERIALS`, `materialOf`) : `boundaryEdges[i].material` et `obstacles[].material` (clôtures libres) — mur : pierre / béton / brique ; clôture : bois / métal / béton / grillage ; absent = défaut (pierre, bois).
**Ouvertures** : portails et portillons se posent aussi sur une clôture existante (`ref: {type:'existing', existingId, side}`).
**Conseils** : section « Vos plantes existantes » (onglet Entretien) : conseils du catalogue à la saison courante, génériques par type sinon ; liste « à retirer ». `validateGarden` : avertissement si un existant sort du terrain.
**Limites** : `render3d.js` et `render-gl.js` lisent `existingForRender` (import défensif ; option `existing` pour les tests) ; `render.js` (plan) laisse les existants à `render-items.js` ; `massifs.js` doit exclure `existingFootprints(garden)`.

## Massifs automatiques (moteur)

Mode « l'app calcule les massifs » : `garden.context.bedMode` = `'manual'` (défaut, absent = manual : je dessine mes massifs) ou `'auto'`. Les zones de type fleur (`FLOWER_ZONE_TYPES` = `lowplants`, `midplants`, `tallplants`, `isFlowerZone(zone)`) sont décorrélées des autres : le moteur ne les place que dans le **vide** et choisit les plantes. `createZone` ajoute `auto: false` ; une zone créée par le moteur porte `auto = true`, `label` « Massif n°1 » (ou « Massif bucolique n°1 »), `ambiance`, `plantings` et `autoInfo = {role, why, seed, summary}`. Module pur `massifs.js` (aucun DOM, déterministe avec la graine) ; l'UI est un autre chantier.

**API**
- `freeSpace(garden, {cell = 0.25, margin = 0.3, clearances, allowLawn = false, ignoreIds})` → grille d'occupation `{grid, nx, ny, cell, freeArea, isFree(x, y), components(), distanceMap()}`. Cellule libre = centre dans le contour et hors de : zones non-massif (piscine +1 m, mare +0,5 m, terrasse, allée, potager, haie, arbres/houppiers, pelouse sauf `allowLawn`), massifs déjà dessinés (manuels ou automatiques conservés), mobilier +`margin`, obstacles (maison, abri, murs, arbres + `margin`), plantes existantes (`existingFootprints`, +0,3 m ; import défensif, repli sur `garden.existing`), dégagement de 0,9 m devant chaque porte/ouverture. `isFree` est exact (analytique), la grille n'en est que l'échantillon.
- `proposeBeds(garden, opts)` → massifs `{id, role, shape:{kind:'polygon', points}, areaM2, widthM, sunLevel, score, why, plantings, summary, plantsWhy, alternatives, ambiance, seed}`. `opts` : `seed = 1`, `coverage = 0.5` (part du vide à remplir), `minArea = 2`, `maxArea = 20`, `maxBeds = 12`, `style` (`mixed` | `borders` | `islands`), `ambiance`, `maintenance` (`green` | `low` | `none`), `budget` (€ total, réparti au prorata des surfaces), `palette` (`auto` | `chaud` | `froid` | `pastel` | `blanc` | `vif`), `plants` (catalogue injecté), `allowLawn`, `design = true` (false : formes seules), `tminC`.
- `designBed(garden, bed, opts)` → `{plantings, summary:{bloomMonths, layers, palette, families, costEur, effort, species, melliferous, density}, why, alternatives:[2 × {label, palette, ambiance, plantings, summary, why}]}`.
- `bedsToZones(garden, beds, {ambiance, plants, startIndex})` → zones prêtes à insérer ; type selon la hauteur dominante (moyenne pondérée par l'emprise : ≥ 1,2 m `tallplants`, ≥ 0,45 m `midplants`, sinon `lowplants` ; `haie-fleurie` = `tallplants`) ; numérotation à la suite des massifs auto existants ; id `z_<id du massif>`.
- `regenerate(garden, {keepIds, ...opts})` → `{beds, zones (liste complète), added, kept, removed}` : retire les zones `auto` non gardées, garde les autres comme espace occupé, propose de nouveaux massifs (graine par défaut = dernière graine + 1). Les massifs manuels ne sont jamais touchés ; `garden` n'est pas modifié.

**Placement (`proposeBeds`)** : candidats analytiques convexes, validés par échantillonnage exact contre `freeSpace.isFree` (treillis de 0,3 m + bord décalé de 3 cm). (1) Bandes de 0,8 à 2 m (largeurs 0,8 / 1 / 1,2 / 1,5 / 1,8 / 2) le long des côtés du contour, des murs, clôtures, de la maison et de l'abri (rôle `pied-de-mur` pour mur/maison/abri, `bordure` ailleurs, `haie-fleurie` pour une bande de 1,2 à 1,8 m et ≥ 4 m de long sur une clôture ou une haie du contour), des terrasses, allées et pelouses : profil de profondeur libre le long du côté, puis fenêtres de longueurs variées (en butée aux extrémités des tronçons libres + une position tirée avec la graine), coins arrondis côté libre (10 points). (2) Massifs d'angle : secteur arrondi (rayon 1,8 à 3,6 m) à chaque sommet intérieur du contour d'angle 40–150°. (3) Îlots ovales ou rectangulaires à coins arrondis (16 / 16 points) centrés sur les maxima de la carte de distance (≥ 1,45 m des obstacles), avec **0,6 m de passage** autour (forme « garde » élargie) ; demi-largeur ≤ 1,5 m. Sélection gloutonne pondérée : score = 30 % rôle (pied de mur > haie fleurie > bordure > angle > îlot) + 22 % visibilité depuis terrasse / maison / portes + 18 % exposition (via le niveau de soleil du jardin : uniforme, carte peinte ou carte estimée ; ombre portée d'un grand arbre existant côté nord retirant un niveau) + 10 % compacité + 10 % largeur + 10 % taille, multiplié par un aléa ±20 % issu de la graine. À chaque tour : les bandes qui chevauchent un massif déjà posé sont **raccourcies** (bout à bout), puis la forme est revalidée et on rejette tout massif laissant un liseré libre de 0,1 à 0,5 m sur plus de 1,5 m. Arrêt à 92 % de `coverage × freeArea` (jamais au-delà de +25 %), ou plus aucun candidat. Largeur d'un massif = 2 × rayon inscrit approché (≥ 0,6 m toujours). Formes toujours en polygones (jamais de cercle).

**Plantes (`designBed`)** : réservoir = vivaces, graminées, bulbes, couvre-sols et arbustes bas (≤ 2,5 m ; ≤ 3,2 m en haie fleurie) des zones massif, hors invasives (et hors toxiques à moins de 3 m d'une terrasse ou piscine), `scorePlant` ≥ 50 avec le contexte local (rusticité `tminC` — option, sinon département + altitude —, soleil du massif, sol, vent, place), emprise ≤ 45 % de la surface, largeur adulte ≤ 1,25 × largeur du massif ; filtres « assouplissables » (jamais sous 8–15 essences) : soleil, ambiance (`plantAmbianceScore` ≥ 0,4 et non évitée), entretien (`fitsMaintenance`), palette, exclusion des essences déjà prises (alternatives). Recherche : glouton aléatoire puis améliorations locales (échange, ajout, retrait, double échange ; propositions ciblées sur les mois non couverts), 2 départs × ~110 itérations avec recuit léger, graine = graine × identifiant du massif. Objectif : adéquation individuelle, continuité de floraison de mars à octobre (couverture, ≥ 2 essences par saison, plus long tronçon), étagement (fond > 1,1 m, milieu ≤ 1,1, avant ≤ 0,6, bordure ≤ 0,3 ou couvre-sol ; ≥ 3 niveaux), harmonie des couleurs (teinte HSL de `flowerColor` → familles rose-rouge / jaune-orangé / vert / bleu-violet / blanc ; ≤ 3 familles ; monochrome > analogue > complémentaire > triade), feuillage persistant (≥ 2) et contraste de feuillage, ambiance, entretien, mellifères (poids doublé en ambiance « pollinisateurs »), hydrozone (écart d'arrosage 0 ou 1 ; faible + élevé écarté), densité (emprise adulte ≈ 100 % de la surface, ≤ 120 %), coût (budget : pénalité forte puis réparation par échange vers des essences moins chères), genre répété > 2, sous-bois (près d'un grand arbre existant : bonus aux essences d'ombre / mi-ombre ≤ 1,5 m, malus aux essences de plein soleil). **Quantités** : surface répartie fond 15 %, milieu 35 %, avant 30 %, bordure 10 %, bulbes 10 % (parts renormalisées sur les groupes présents), répartie à parts égales entre essences d'un groupe, `count = max(1, round(surface / espacement²))` (espacement ≥ 0,2 m, bulbes ≥ 0,12 m), puis réduit si l'emprise dépasse 115 % de la surface. **Alternatives** : variante 1 = autre palette (la moins chevauchante), variante 2 = autre palette + autre ambiance (romantique, bucolique, décoratif…), essences du choix principal évitées tant que le catalogue le permet. `why` : « 8 mois de floraison (mars à octobre), 4 hauteurs, palette bleu-violet et blanc, 8 essences mellifères ».

**Limites** : formes uniquement convexes (pas de massif en L ou en anneau) ; contours très tortueux = peu de bandes ; la couverture visée peut ne pas être atteinte si le vide est étroit (règle d'accès : bandes ≤ 2 m, îlots avec 0,6 m de passage) ; ombres des bâtiments estimées seulement si la localisation est connue, sinon niveau de soleil du jardin ; catalogue sans prix = 8 € par plant par défaut ; pas d'ordre de plantation ni de plan de plantation intra-massif (seulement quantités) ; la rotation des zones et l'édition manuelle d'un massif auto ne sont pas gérées ici (UI) ; durée ≈ 0,1–0,4 s pour 300 m².

## Massifs automatiques (interface)

Assistant à **9 étapes** : `context, boundary, wished, sun, items, zones, beds (🌸 Massifs), plants, render`. La barre d'étapes défile horizontalement (étape courante centrée, boutons 44 px).

- **Mode** (`ui/step-wished.js`) : deux grandes cartes « 🖌 Je dessine mes massifs moi-même » / « ✨ L'app calcule les massifs » (`context.bedMode`). En mode auto, la liste des zones souhaitées n'offre plus `FLOWER_ZONE_TYPES` (note explicative ; choix conservés sans perte, `validateGarden` n'avertit plus pour eux) et la palette de l'éditeur de zones (`draw-zones.js`) ne les propose plus (lien « Les massifs fleuris sont calculés à l'étape Massifs ») ; les massifs auto existants restent sélectionnables.
- **Étape Massifs** (`ui/step-beds.js`, `ui/beds-panel.js`, `ui/beds.css`) : mode manuel = carte « Vos massifs sont dessinés à la main » + passer en auto / étape suivante. Mode auto = plan SVG pan/zoom (contour, zones non-auto grisées, mobilier, existants, nord, vide en pointillés, massifs colorés numérotés), réglages (part du vide 10–100 % + puces Quelques massifs 25 / Équilibré 50 / Foisonnant 80, style, palette, ambiance globale, entretien du jardin, budget), « ✨ Calculer les massifs » (formes par `proposeBeds(design:false)` puis `designBed` massif par massif dans des `setTimeout`, progression affichée au-delà de 300 ms), « 🎲 Autre proposition » (graine + 1, massifs gardés conservés et comptés dans la couverture), cartes (nom, surface, rôle/ensoleillement, `why`, calendrier de floraison 12 mois, pastilles de couleurs, composition en vignettes avec photo Wikipédia, coût) avec 🔒 Garder, 🗑 Retirer, 🎲 Autre combinaison (les 2 `alternatives` puis nouvelle conception), 🎨 Ambiance (redessine ses plantes), ✏️ Modifier la forme (devient zone ordinaire `auto:false`, ouvre l'étape Zones). Aucun vide : « Pas de place libre : réduisez les zones ou le mobilier. ».
- **Validation** : « ✔ Valider ces massifs » remplace les zones `auto` par `bedsToZones` (zones manuelles inchangées), conserve nom et notes d'une zone déjà validée, puis ouvre Essences ; « ↩ Annuler la dernière validation » restaure les zones (mémoire de l'application seulement). Brouillon `context.bedDraft = {seed, settings:{coverage,style,palette,ambiance,budget}, locked:[ids], beds, applied:{idMassif:idZone}}` enregistré à chaque action ; à la réouverture les massifs validés suivent les modifications faites dans Zones (forme, essences, nom) et disparaissent s'ils ont été supprimés ; une zone `auto` sans brouillon est affichée comme massif validé.
- **Essences** : un massif auto porte le badge « ✨ auto », l'explication `autoInfo.why` et « 🎲 Recalculer ce massif » (nouvelle combinaison via `designBed`) ; « Surprends-moi » fonctionne dessus. Rendu : aucun changement (ce sont de vraies zones).
- **Tests** : `step-beds.dom.test.js`, `beds-panel.dom.test.js`, `beds-modes.dom.test.js`, e2e `massifs.spec.js`. **Limites** : annulation de validation perdue au rechargement ; pas de sélection automatique de la zone dans l'éditeur après « Modifier la forme » ; calcul > 300 m² fait de petites pauses par massif mais `proposeBeds` (formes) reste un bloc synchrone.

## Hauteurs réglables

La hauteur se règle à la main, en centimètres, pour tout élément qui a un volume. Modèle rétro-compatible : champ absent = valeur par défaut du catalogue ; saisir la valeur par défaut supprime le champ.

- **Module pur `heights.js`** : `DEFAULT_HEIGHTS`, `HEIGHT_LIMITS` (arbre 0,5–40 m, arbuste 0,1–8, vivace 0,05–3, piscine 0,5–2, terrasse 0–1,5, mur 0,3–6, clôture 0,3–3, pergola 1,8–4…), `clampHeight`, `checkHeight` (message « Hauteur plausible : 0,5 à 40 m ; valeur arrondie »), `heightOf`, `isDefaultHeight`, `applyHeight`, `formatHeight` (« 2,40 m »), `parseHeight` (cm ; « 4,5 m » accepté), `effectivePlant`, `zoneHeight`, `itemHeight`, `obstacleHeight`.
- **Modèle** : `planting.height` / `planting.width` (m, essence d'une zone ; remplace `heightAdult` / `widthAdult`, le facteur d'âge reste proportionnel) ; `zone.height` (piscine hors sol : paroi, défaut 1,2 m, 0,5–2 m ; terrasse : surélévation, défaut 0 = au sol, 0–1,5 m) ; `item.height` (mobilier et structures, défaut du catalogue) ; `boundaryEdges[i].height`, `obstacles[].height`, `existing[].height` (déjà présents, désormais bornés par `heights.js`).
- **UI** (`ui/height-field.js` : champ cm, − / + 10 cm, ↺ « Valeur par défaut », état « catalogue » / « personnalisée », cibles ≥ 44 px, `inputmode=numeric`, Entrée valide) : « Dans cette zone » (champ par essence, placeholder = hauteur du catalogue ; fiche d'essence « Hauteur : 4,50 m (personnalisée) ») ; bandeau de zone (paroi de piscine hors sol, surélévation de terrasse) ; fenêtre d'appui long et bandeau d'un aménagement ; côté de contour, mur/clôture libre, existants (bouton valeur par défaut) ; obstacles de l'éditeur de contour (cm, bornes, ↺).
- **Rendus** : `habitParams(plant, {age, height, width})` ; `placePlants` (2D/iso et 3D) et `jobsForGarden` utilisent la plante « effective » (houppier, tronc, ombre suivent) ; piscine hors sol et terrasse surélevée utilisent `zone.height` en iso et 3D (eau et margelle suivent) ; volumes d'aménagement étirés (iso : proportionnellement à la base) ; hauteurs par défaut des obstacles unifiées (maison 6 m, abri 2,5 m, mur 2 m, clôture 1,2 m, arbre 8 m).
- **Ombre** : `shadowObstacles(garden, {plantLookup})` ajoute les parois de piscine hors sol, terrasses surélevées et, si `plantLookup` est fourni, arbres isolés (un plant) et haies en ligne à leur hauteur réglée.
- **Cohérence** : `checkCoherence` tient compte des hauteurs réglées (arbre ≥ 4 m à moins de 3 m d'une terrasse/piscine) et signale une haie, clôture ou mur > 2 m au sud (± 60°, < 6 m) d'une zone plantée en plein soleil.
- **Limites** : l'ombre des massifs d'arbres multiples n'est pas modélisée dans `sun.js` ; `massifs.js` et `advice.js` inchangés (catalogue) ; pas d'ombre portée pour une plantation réglée si `plantLookup` n'est pas passé.
- **Tests** : `heights.test.js`, `height-override.test.js`, `height-ui.dom.test.js`, `render-height.test.js`, e2e `hauteurs.spec.js`.
