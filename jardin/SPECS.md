# Jardin — specs

Application **mobile Android uniquement** d'aménagement de jardin, **France uniquement** : l'utilisateur décrit son terrain (région, exposition, dimensions métrées), place des zones (mare, terrasse, massifs, arbres…), choisit des essences adaptées, obtient un plan vectoriel puis un guide de plantation, d'entretien et d'arrosage.

Statut : **specs initiales (aucun code)**. Dossier : `jardin/`.

## 1. Principes

- **Application mobile** : web (HTML/CSS/JS, comme les autres apps du dépôt) empaqueté en app native avec **Capacitor** (accès GPS, boussole, notifications locales, stockage). Voir §10. Le dessin se fait au doigt ; le métré reste lisible sur petit écran.
- **Pas de serveur à nous** : l'app appelle directement des API publiques gratuites et sans clé (§11), mises en cache. Aucun compte.
- Données utilisateur stockées localement ; export/import JSON pour sauvegarde et partage.
- **Hors ligne** : le jardin, le plan, le catalogue, les conseils et les notifications déjà planifiées fonctionnent sans réseau ; seules la météo et la recherche d'adresse en ont besoin.
- Interface en français, unités métriques (m, m², L), **France seule** (métropole ; DROM en jalon ultérieur car le climat et le catalogue diffèrent).
- Les recommandations sont **explicables** : chaque essence conseillée ou déconseillée affiche la raison (« tolère le gel jusqu'à −15 °C », « exige plein soleil »…).

## 2. Parcours utilisateur

1. **Accueil** : liste des jardins enregistrés (vignette vectorielle, nom, surface, région) + bouton « Nouveau jardin ». Plusieurs jardins possibles.
2. **Contexte** (assistant, étape 1) :
   - **Localisation** : par **GPS** (« Je suis dans mon jardin ») ou par recherche d'adresse/commune. On en déduit la commune, la région, l'altitude, puis la zone de rusticité, le climat (températures mini, pluviométrie) et le calendrier de plantation (§11). La position est corrigeable à la main sur une carte.
   - **Exposition** : par la **boussole du téléphone** (§4 bis), ou saisie manuelle (N, NE, E, SE, S, SO, O, NO) ou « je ne sais pas ». Le nord oriente aussi le plan.
   - Facultatif : type de sol (argileux, calcaire, sableux, limoneux, humifère, « je ne sais pas »), pente (nulle/légère/forte), vent dominant, exposition au vent.
3. **Tracé du terrain** (étape 2) : dessin du contour en mode **polyligne métrée** (§4).
4. **Zones souhaitées** (étape 3) : l'utilisateur coche/ajoute les types de zones qu'il veut (§5).
5. **Ensoleillement** (étape 4, facultatif) : renseigner l'ensoleillement de la surface (§6).
6. **Dessin des zones** (étape 5) : formes tracées sur le plan.
7. **Choix des essences** (étape 6) : pour chaque zone, sélection avec recommandations (§7).
8. **Rendu** (étape 7) : génération du plan vectoriel (§8) ; si l'utilisateur valide → sauvegarde et accès aux conseils (§9). S'il refuse, retour à l'étape de son choix sans perte.

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

## 4 bis. GPS et boussole

- **Relevé du contour au GPS** : l'utilisateur marche le long de sa limite et « pose un point » à chaque angle. Les coordonnées WGS84 sont converties en mètres dans le repère local (projection locale, Lambert-93 ou plan tangent). Chaque point peut être moyenné sur quelques secondes (précision affichée) ; au-delà de ~5 m de précision, l'app avertit que le GPS d'un téléphone est peu fiable sous couvert et propose de compléter au mètre à ruban (saisie des longueurs, §4). Les côtés relevés restent éditables.
- **Orientation par boussole** : « Placez-vous dos à la maison / face au jardin et pointez le téléphone ». L'azimut (capteur magnétique, corrigé de la déclinaison locale) donne l'orientation du fond du jardin et le nord du plan. Avertissement si le capteur est mal calibré (geste en 8 proposé).
- **Position de l'utilisateur sur le plan** : point GPS en direct sur le plan pour vérifier le tracé ou repérer où planter. Mode « sur le terrain » avec fond de carte satellite optionnel (§11) pour caler le plan.
- **Permissions** : localisation « pendant l'utilisation » uniquement ; refus géré (saisie manuelle toujours possible).
- Le GPS ne sert qu'à localiser le jardin, il n'est jamais envoyé à un serveur autre que les API publiques du §11 (coordonnées arrondies à ~100 m dans les requêtes météo quand c'est suffisant).

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

## 8. Rendu vectoriel

- Génération d'un **plan SVG** : contour coté, zones colorées avec motifs, essences représentées par des symboles (cercle d'emprise adulte + pictogramme par catégorie), obstacles, nord, échelle, légende, cartouche (nom du jardin, surface, région, date).
- Deux vues : « Plan » (technique, cotes) et « Illustré » (couleurs plus riches, ombres portées simples). Option : afficher l'emprise à 1 an / à maturité (curseur d'âge).
- Zoom/pan, bascule des calques (cotes, légende, ensoleillement, noms des essences).
- Actions : **Valider** (statut `validated`, enregistrement du SVG et de la date, déverrouille les conseils), **Modifier** (retour aux étapes), **Exporter** (SVG, PNG, PDF à l'échelle imprimable A4/A3, JSON).
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
| **Photos de plantes** | Wikimedia Commons / Wikipédia (API libre, licences à respecter et à créditer) | Chargées à la demande, mises en cache |
| **Données de culture** (soleil, arrosage, rusticité) | **Aucune API gratuite fiable adaptée au jardinage français** identifiée | Voir ci-dessous |

### Le catalogue de plantes : décision

Les API de plantes grand public (Perenual, Trefle, etc.) sont soit limitées en gratuit, soit non vérifiées, soit sans données pertinentes pour la France (rusticité en zones USDA, essences américaines) ; les limites exactes du plan gratuit de Perenual n'ont pas pu être confirmées. Elles ne conviennent pas comme dépendance d'une app dont le cœur est la recommandation. **Décision : un catalogue embarqué, rédigé et vérifié par nous (`data/plants.json`, ~150 essences courantes en France pour le MVP), servi hors ligne**, dont les noms sont validés par TAXREF/GBIF et les illustrations obtenues via Wikimedia. On pourra l'enrichir à la marge (descriptions, photos) par API, jamais pour les critères qui pilotent les filtres (rusticité, ensoleillement, besoin en eau). La rusticité est exprimée en température minimale (°C), convertible en zone USDA.

### Données climatiques par zone

La zone de rusticité et la pluviométrie de référence ne viennent pas d'une API en direct : table embarquée par département/altitude (températures minimales de référence), complétée par le climat réel de la position via Open-Meteo.

## 12. Hors périmètre v1

Côtés courbes et relief 3D, estimation d'ombre précise heure par heure, reconnaissance de plantes par photo, import de plan cadastral, synchronisation multi-appareils, partage en ligne, achat de plantes, **notifications push distantes**, DROM, autres pays.

## 13. Jalons

1. **MVP** : localisation GPS, contexte (région, exposition à la boussole), contour métré et relevé GPS, zones, ensoleillement rapide, catalogue embarqué (~150 essences), recommandation filtrée, rendu SVG, validation, conseils généraux, arrosage avec **notifications locales** alimentées par Open-Meteo, stockage local, app Android via Capacitor (APK/AAB).
2. Export PDF/PNG, ensoleillement cartographié, calendrier consolidé, tâches du mois.
3. Ensoleillement estimé (PVGIS + soleil local), mode « Surprends-moi », association de plantes, évolution à maturité, DROM.

## 14. Risques

- **Open-Meteo : usage non commercial seulement** ; publier l'app sur les stores avec monétisation imposerait un abonnement ou un changement de source.
- **Tâches de fond Android** non garanties (Doze, économie de batterie, constructeurs agressifs) : d'où la planification à l'avance de plusieurs jours et le repli calendaire. Les notifications exactes demandent la permission « alarmes et rappels » (Android 12+) et la permission de notification (Android 13+), à demander au moment de l'activation ; guider l'utilisateur vers les réglages si la batterie bloque l'app.
- **Précision du GPS et de la boussole** d'un téléphone (plusieurs mètres, interférences magnétiques) : toujours afficher la précision et permettre la correction manuelle.
- **Dépendance à des API publiques** qui évoluent (cf. arrêt de l'API Adresse, suspension de SoilGrids) : isoler chaque source derrière un module et prévoir des replis.
- **Effort éditorial** du catalogue (150 essences fiables) : c'est le vrai coût du projet.
- **Webview vs natif** pour le dessin tactile fluide : à prototyper avant de s'engager.

## 15. Questions ouvertes

- Publication prévue sur les stores (conditions d'usage d'Open-Meteo) ou usage personnel/non commercial ?
- Version Android minimale à supporter (proposition : Android 8 / API 26) ?
- Précision attendue du métré (cm) et besoin d'import d'un plan existant ?
- Faut-il un mode « jardin existant » (plantes déjà en place) en plus de la création ?
- Prototype du dessin tactile en Capacitor avant de figer la plateforme ?
