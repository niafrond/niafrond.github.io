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
| recommend, massifs, pricing, shopping, advice, watering, transfer, qr | — | à faire |
| UI (assistant, dessin, rendus, 3D, PDF, notifications) | `app/` | à faire |
