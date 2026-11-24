# Jardin — specs

Application web d'aménagement de jardin : l'utilisateur décrit son terrain (région, exposition, dimensions métrées), place des zones (mare, terrasse, massifs, arbres…), choisit des essences adaptées, obtient un plan vectoriel puis un guide de plantation, d'entretien et d'arrosage.

Statut : **specs initiales (aucun code)**. Dossier : `jardin/`.

## 1. Principes

- 100 % côté client (HTML/CSS/JS sans serveur, comme les autres apps du dépôt), installable en PWA, utilisable hors ligne.
- Données stockées localement (IndexedDB) ; export/import JSON pour sauvegarde et partage. Aucun compte.
- Interface en français, unités métriques (m, m², L).
- Mobile d'abord (dessin au doigt) mais utilisable à la souris ; le métré reste lisible sur petit écran.
- Les recommandations sont **explicables** : chaque essence conseillée ou déconseillée affiche la raison (« tolère le gel jusqu'à −15 °C », « exige plein soleil »…).

## 2. Parcours utilisateur

1. **Accueil** : liste des jardins enregistrés (vignette vectorielle, nom, surface, région) + bouton « Nouveau jardin ». Plusieurs jardins possibles.
2. **Contexte** (assistant, étape 1) :
   - Région (France : 13 régions métropolitaines + DROM ; extensible à d'autres pays) → détermine la zone de rusticité, la pluviométrie et la température minimale moyennes, le calendrier de plantation.
   - Exposition du jardin : orientation de la façade principale / du fond du jardin (N, NE, E, SE, S, SO, O, NO) ou « je ne sais pas ». Boussole manipulable, qui oriente aussi le plan (flèche du nord).
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

- Canvas/SVG avec grille et échelle affichée, zoom/déplacement (molette, pincement).
- **Saisie par segments** : l'utilisateur pose un premier point, puis pour chaque côté il peut soit cliquer/toucher, soit **taper la longueur** (en m, au cm près) et l'angle ou la direction ; le côté s'ajoute à la bonne longueur. Un panneau liste tous les côtés (éditables après coup).
- Aimantation : angles droits (90°), alignement horizontal/vertical, points existants, grille (0,1 / 0,5 / 1 m).
- Fermeture du contour : bouton « Fermer » ou clic sur le premier point ; fermeture assistée si l'écart de métré est faible (proposition de correction répartie).
- Cotes affichées sur chaque côté ; surface et périmètre calculés en direct (formule du lacet).
- Annuler/rétablir, déplacer un sommet, insérer/supprimer un sommet, côtés courbes hors périmètre v1.
- Validation : polygone simple (pas d'auto-intersection), surface > 1 m².
- Obstacles ponctuels/polygonaux à placer (maison, mur, abri, arbre existant avec hauteur) : servent à l'ombre et à interdire des zones.
- Plusieurs jardins : chaque jardin a son propre repère ; duplication d'un jardin possible (« variante »).

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
- **Mode estimé** (v2) : calcul automatique à partir de l'orientation, de la latitude (région) et des obstacles saisis (hauteur de la maison, murs, arbres) → carte d'ensoleillement approximative, modifiable à la main. Affichée comme estimation, jamais comme vérité.
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
- Planning : fréquence et moment de la journée, par mois ; recommandation de paillage et de récupération d'eau de pluie (volume de cuve suggéré à partir de la surface de toit renseignée, si disponible).
- Matériel suggéré par zone : goutte-à-goutte, tuyau poreux, arrosage au pied, aspersion pour la pelouse ; longueurs et nombre de points d'arrosage estimés depuis le plan.
- Les chiffres sont des **ordres de grandeur** ; le texte le rappelle et invite à adapter au terrain.

Les conseils proviennent du catalogue (`care` par essence) et de règles génériques par catégorie (arbre, arbuste, vivace, couvre-sol, aquatique, pelouse, potager) ; le contenu est rédigé à la main, sans appel à un service externe.

## 10. Architecture technique (proposition)

- `jardin/index.html` (liste des jardins) + `jardin/editor.html` (assistant) — JS en modules ES, sans framework imposé, SVG pour le plan.
- Modules : `geometry.js` (aire, périmètre, intersection, point-dans-polygone, lacet — pur et testé), `model.js` (types, validation), `storage.js` (IndexedDB, export/import), `catalog.js` + `data/plants.json`, `recommend.js` (filtres, score — pur et testé), `sun.js` (cartographie et estimation), `render.js` (SVG), `advice.js` (conseils, calendrier, arrosage), `ui/*` (étapes).
- Tests Jest (comme le reste du dépôt) sur `geometry`, `recommend`, `advice`, `storage` (mock) ; test Playwright du parcours complet (créer un jardin, tracer, zoner, choisir, valider).
- Accessibilité : alternatives clavier au dessin (saisie numérique des côtés), contrastes, textes alternatifs du plan (liste des zones et essences).

## 11. Hors périmètre v1

Côtés courbes et relief 3D, estimation d'ombre précise heure par heure, reconnaissance de plantes par photo, import de plan cadastral/satellite, synchronisation multi-appareils, partage en ligne, achat de plantes, météo en temps réel.

## 12. Jalons

1. **MVP** : contexte, contour métré, zones, ensoleillement rapide, catalogue (~100 essences France), recommandation filtrée, rendu SVG, validation, conseils généraux + arrosage de base, stockage local.
2. Export PDF/PNG, ensoleillement cartographié, calendrier consolidé, tâches du mois.
3. Ensoleillement estimé, mode « Surprends-moi », association de plantes, évolution à maturité, autres pays.

## 13. Questions ouvertes

- Périmètre géographique initial : France seule, ou Belgique/Suisse/Québec dès le MVP ?
- Taille et source du catalogue de plantes (rédaction manuelle vs jeu de données ouvert à fiabiliser).
- Précision attendue du métré (cm) et besoin d'import d'un plan existant.
- Faut-il un mode « jardin existant » (plantes déjà en place) en plus de la création ?
