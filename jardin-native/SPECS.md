# Jardin natif (Kotlin / Jetpack Compose)

Réécriture complète de l'app web `jardin/` en application Android native. L'app web (`jardin/`, `jardin-android/`) reste la référence fonctionnelle et reste livrée tant que le natif n'a pas la parité ; ses `SPECS.md` décrivent le comportement attendu.

## Architecture

- `core/` — **noyau métier en Kotlin pur (JVM)**, sans dépendance Android : modèle, géométrie, soleil, espacement, recommandations, massifs, prix, listes de courses, entretien, ambiances, conseils, arrosage, catalogue de plantes, transfert/QR. Testé en local avec `gradle :core:test` (JUnit via `kotlin.test`). Package `fr.jardin.core`.
- `app/` — application Android (Compose, Material 3, minSdk 33), incluse seulement si un SDK Android est présent (CI, poste de dev). Dépend de `core`.
- `golden/` + `tools/` — **parité avec le JS** : des scripts Node (`tools/golden-<module>.mjs`) exécutent l'implémentation JS de référence sur des entrées fixes et écrivent le résultat dans `golden/<module>.json` ; les tests Kotlin relisent ces fichiers et vérifient que le portage donne les mêmes sorties (tolérance 1e-6 sur les flottants).
- Données : le catalogue de plantes est exporté du JS vers `core/src/main/resources/plants.json` (`tools/export-catalog.mjs`) ; jardins sauvegardés en JSON (kotlinx.serialization) dans le stockage interne de l'app, format compatible avec l'export du web (`jardin/transfer.js`) pour pouvoir importer un jardin créé sur PC.
- Stack : Kotlin 2.0, Compose Material 3, kotlinx.serialization, coroutines ; rendu 2D par `Canvas` Compose ; rendu 3D par OpenGL ES (ou Filament) ; PDF par `android.graphics.pdf.PdfDocument` ; notifications natives (WorkManager + NotificationCompat) ; génération PDF par **service de premier plan** (fonctionne app fermée) ; GPS/boussole par `FusedLocation`/capteurs natifs ; partage par `FileProvider` + `Intent.ACTION_SEND`.

## Plan par vagues

1. **Fondations du noyau** : modèle, géométrie, soleil, objets/aménagements, existant, hauteurs, ports de plantes, espacement, mares ; catalogue (export JSON), climat, ambiances, entretien. *(en cours)*
2. **Logique avancée** : recommandations (budget, entretien, ambiance, mare), massifs automatiques, prix, listes de courses, conseils, arrosage, transfert/QR.
3. **Application** : navigation, accueil, assistant 9 étapes, tracé du contour (métré, appui long, GPS), zones, aménagements, plantes (photos), plan 2D, stockage.
4. **Rendu** : plan 2D vectoriel, vues isométriques, 3D temps réel avec saisons, noms de plantes (regroupement, occultation), fiche détail avec photo.
5. **Sorties et natif** : PDF à calques via service de premier plan + notification « le PDF est prêt », notifications d'arrosage, GPS/boussole, partage, liens profonds.
6. **Parité et bascule** : checklist fonctionnelle contre `jardin/SPECS.md`, tests instrumentés, publication.

## Contraintes

- Aucune logique métier dans `app/` : tout ce qui se teste sans Android va dans `core/`.
- Chaque module Kotlin porte les tests JS correspondants (portés) + au moins un test « golden ».
- Français partout dans l'interface ; textes identiques à ceux du web pour la parité.

## Parité (suivi)

| Module web | Noyau Kotlin | État |
|---|---|---|
| model, geometry, sun, items, existing, heights, habits, spacing, ponds | `fr.jardin.core` | en cours |
| catalog + data/plants, climate, ambiances, maintenance | `fr.jardin.core` | en cours |
| pricing, shopping, advice, watering, transfer, weather (parties pures), geo (parties pures) | `Pricing.kt`, `Shopping.kt`, `Advice.kt`, `Watering.kt`, `Transfer.kt`, `Weather.kt`, `Geo.kt` | porté, golden + tests JS portés |
| qr | `Transfer.QR_MAX_BYTES` (2000) ; générateur QR = ZXing côté `app/` | constante seule |
| recommend, massifs | — | à faire |
| UI (assistant, dessin, rendus, 3D, PDF, notifications) | `app/` | à faire |

## Notes de portage — prix, courses, conseils, arrosage, transfert, météo, géo

- Golden : `tools/golden-{pricing,shopping,advice,watering,weather,geo,transfer}.mjs` (jardins de test déterministes dans `tools/fixtures-jardins.mjs`, essences synthétiques en plus du catalogue). Le golden d'arrosage fixe le fuseau Europe/Paris (les tests Kotlin passent le même `ZoneId`).
- Transfert : format binaire identique au web (`v2.<longueur base 36>.<base64url(deflate-raw(JSON))>`, `v2u.` non compressé, `v1` lisible) ; `tools/verify-transfer-kotlin.mjs` relit côté JS les codes produits par Kotlin (écrits par `TransferTest` dans `core/build/`). À l'encodage, Kotlin omet les `null` du JSON (le web les tolère).
- Tri « fr » des courses : `Shopping.fr` reproduit `localeCompare('fr')` (ICU) ; `java.text.Collator` ignore la ponctuation et donne un autre ordre.
- Écarts assumés : fiche `care` entièrement vide = fiche absente (repli générique) ; `Plant.hardiness`/`kc` valent 0 quand absents (le JS distingue `undefined`) — sans effet sur le catalogue réel ; `describeGarden` compte les obstacles dans `items` (comme le web) ; les couches réseau/capteurs de `weather.js` / `geo.js` (fetch, cache localStorage, watchFix, wake lock) restent à l'application (le noyau fournit URL, analyse des réponses, moyenne GPS, déclinaison, lissage de boussole).

## Fondations de l'application (vague 3, premier lot)

- `core/.../app/` (testé par `AppFoundationTest`) : `GardenRepository` / `FileGardenRepository` (un `<id>.json` par jardin, JSON identique au web, écriture atomique, tri par `updatedAt` décroissant, `duplicate` = variante brouillon), `GardenExchange` (export/import `jardin-v1`, import de lien/code via `Transfer`, messages d'erreur du web), `SettingsStore` (`Settings` = `defaultSettings()` du web : notifications 19:00, gel/chaleur/tâches mensuelles, unités, cache API), `WizardSteps` (9 étapes, libellés et icônes du web), `WizardGuards` (navigation libre comme le web ; remarques non bloquantes ; seule la validation finale exige `validateGarden().ok`), `WizardState` (état immuable de l'assistant), `ContextForm` (étape Contexte : région/département, exposition, rusticité), `HomeModel` (textes de l'accueil).
- `app/` : thème Material 3 vert (couleurs de `jardin/style.css`, clair/sombre), navigation `home` → `garden/{id}`, accueil (liste, créer, dupliquer, supprimer avec confirmation, importer par lien/code/JSON collé), assistant (barre segmentée cliquable, sélecteur d'étape, Précédent/Suivant fixes en bas, autosauvegarde 400 ms), étape Contexte fonctionnelle ; les 8 autres étapes affichent « Cette étape n’est pas encore disponible ».
- `core` compile en bytecode Java 17 (cohérent avec `:app`).
- Non vérifié localement : toute la compilation de `:app` (pas de SDK Android) — à valider par la CI.

## Plan 2D et étape « Terrain » (vague 3/4, lot plan)

- **Noyau** (`core/.../plan/`, testé par `PlanTest`) : `PlanView` (transformation monde en m <-> écran en px, glissé, zoom autour d'un point, cadrage avec bandes recouvertes), `PlanHit` (toucher d'un sommet, d'un côté, du milieu d'un côté), `LengthInput` (`parseLength` « 350 » = 3,50 m, « 3,5 » / « 3,5 m » / « 350 cm », formats français `frLen` / `frArea`), `ContourEdit` + `ContourState` + `History` (ajout / déplacement / insertion / suppression de sommets, fermeture avec proposition de répartir l'écart, longueur d'un côté, rectangle L×l, côté suivant par longueur + direction, aimantation sommets / équerre / angle droit / grille, messages du web), `NorthIndicator` (libellés du nord par pas de 45°, `orientation = (360 − angle) % 360`).
- **App** (`app/.../plan/`, `app/.../ui/BoundaryStep.kt`) : `PlanCanvas` (Canvas Compose réutilisable : grille adaptative, zones aux couleurs de `ZONE_TYPES`, aménagements, obstacles, existant, contour avec cotes en m, murs / clôtures / haies des côtés, poignées « + », sommets numérotés, 1er sommet agrandi pour fermer ; gestes : glisser = déplacer, pincer = zoom, toucher, appui long ≈ 0,5 s avec vibration, glissé de sommet prioritaire) ; `NorthBadge` (rose de 52 dp, aiguille rouge/grise animée par le plus court chemin, pointillés + « ? » si orientation inconnue, touchée = « Orienter le plan ») ; `BoundaryController` (gestes, historique 100 niveaux, sauvegarde automatique à chaque modification via `WizardViewModel.update`).
- **Étape Terrain** : toucher = poser un sommet, toucher le sommet 1 (≥ 3 points) = fermer ; glisser un sommet = le déplacer ; glisser le « + » d'un côté = insérer un sommet ; toucher une cote / le « + » ou appui long sur un côté = saisie de la longueur en cm ; appui long sur un sommet = fenêtre du sommet (supprimer) ; appui long sur le plan vide = rectangle, sinon « côté suivant » ; « Je connais les dimensions » (rectangle) ; annuler / rétablir ; effacer (avec confirmation) ; surface, périmètre, sommets, avertissements.
- **Atelier plein écran** (« ⤢ Plan en plein écran », bouton Retour du système pour sortir) : plan sur tout l'espace, outils en rangée défilante au-dessus, **barre du bas fixe hors du plan** (Annuler, Rétablir, Fermer la forme / Rouvrir, OK). Dans la page de l'assistant, le plan a une hauteur bornée (380 dp) et la barre Précédent/Suivant reste fixe : le plan ne peut jamais empêcher d'atteindre les boutons.
- **Non fait / non vérifié** : relevé GPS, boussole du téléphone dans « Orienter le plan », obstacles du contour, ouvertures sur le plan, motifs des zones ; aucun test de gestes sur appareil (pas d'émulateur) : seuls le noyau (JUnit) et la compilation `:app:assembleDebug` sont vérifiés.

## Recommandations et massifs (noyau)

- `Recommend.kt` (`object Recommend`) : `scorePlant`, `contextForZone`, `recommendForZone`, `suggestQuantity`, `checkCoherence`, `suggestSelection`, `suggestForGarden`. Argument JS « absent » vs `null` explicite : `Maybe<T>` (`null` = absent, `Maybe(null)` = null explicite). Graine : nombre ou chaîne (hash FNV-1a + mulberry32 identiques au JS). Tri par nom : `frCompare` reproduit `localeCompare('fr')` d'ICU (espaces avant les lettres, accents puis casse en départage).
- `Massifs.kt` (`object Massifs`) : `freeSpace`, `proposeBeds`, `designBed`, `bedsToZones`, `regenerate`, `colorFamily`. Options : `BedOptions`, `DesignOptions`. Le tri des cellules d'îlots a un comparateur à effets de bord (tirage dans le comparateur) : `V8Sort.kt` reproduit le TimSort de V8 appel pour appel. `jsHypot` reproduit `Math.hypot` de V8 ; sin/cos/exp/log/acos/atan2 passent par `StrictMath` (fdlibm, comme V8).
- Parité : `tools/golden-recommend.mjs`, `tools/golden-massifs.mjs` (jardins : `tools/fixtures-reco.mjs`) → `golden/recommend.json`, `golden/massifs.json` ; tests `RecommendGoldenTest`, `MassifsGoldenTest` (+ tests JS portés : `RecommendTest.kt`, `MassifsTest.kt`).
- Non porté ici : `placePlants` (rendu, `render-common.js`).

## Étapes Zones souhaitées, Soleil, Massifs, Essences + photos (vague 3, lot « essences »)

- **Noyau** (`core/.../app/`, testé par `StepsLotTest`) : `WishedStep` (cases à cocher dans l'ordre de `ZONE_TYPES`, mode massifs manuel/auto, types « massif » masqués en auto sans perte), `SunStep` (inconnu / un niveau / carte / estimation par `estimateSunMap`, correction d'un secteur, surfaces par niveau), `BedsStep` (brouillon `BedsDraft`, calcul `proposeBeds` + `designBed` avec verrouillage, graine, budget, « autre combinaison », ambiance par massif, validation `bedsToZones` annulable, « modifier la forme », suivi des zones auto), `PlantsStep` (liste `recommendForZone` + filtres/recherche/plafond d'entretien/règles de mare, ajout/quantité/retrait, hauteur modifiable, espacements `checkSpacing`/`fitQuantities`, budget, mare, « Surprends-moi » + annulation, recalcul d'un massif auto, noms de couleurs, floraison, prix).
- **Photos** (`core/.../photos/PlantPhotos.kt`, testé par `PlantPhotosTest`) : titres Wikipédia (wiki, nom latin 2 mots, nom commun), URL `rest_v1/page/summary`, analyse JSON (homonymie ignorée, vignette -> 640 px), TTL 30 j (succès) / 1 j (échec), crédit « Photo : Wikipédia ». `PhotoFetcher` et `PhotoCache` sont fournis par l'app.
- **App** : `app/photos/PhotoRepo.kt` (HttpURLConnection, 3 requêtes en parallèle au plus, cache disque des entrées et des images dans `cacheDir/photos`), `ui/StepWidgets.kt` (vignette avec repli pastille de couleur + emoji, fiche détail avec photo et crédit cliquable, pastilles d'ambiance et d'entretien, fenêtre « Surprends-moi »), `WishedStepScreen`, `SunStepScreen`, `BedsStepScreen`, `PlantsStepScreen`.
- **Écarts** : brouillon des massifs gardé en mémoire (les zones auto validées sont reconstruites au rechargement) ; pas de pinceau libre sur la carte du soleil (secteurs de l'estimation corrigés au toucher) ni relevé GPS/boussole ; pas de masque de vide pointillé ni de défilement vers la carte au toucher d'un massif ; barre de budget affichée en haut de l'étape (pas fixée en bas) ; aucun test sur appareil.
