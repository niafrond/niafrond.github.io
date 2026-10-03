# Mix Blind Test — Spécifications (SDD)

Spécifications de `mix-blind-test/`, extraites de l'ancien §17 de `dj-mix/SPECS.md`.

## 1. Cache serveur (StemClient)

### 1.1 Cache localStorage des pistes serveur

- **SPEC-1.1.1** `fetchServerCacheTracks()` vérifie d'abord le cache localStorage (clé `mix-blind-test:server-tracks-cache`) avant d'effectuer une requête réseau. Le TTL est de `5 minutes` (`300 000 ms`).
- **SPEC-1.1.2** GIVEN un cache dont `fetchedAt` est inférieur au TTL — WHEN `fetchServerCacheTracks()` est appelé sans option `forceRefresh` — THEN les pistes sont retournées depuis le cache sans requête HTTP.
- **SPEC-1.1.3** GIVEN un cache absent ou dont `fetchedAt` dépasse le TTL — WHEN `fetchServerCacheTracks()` est appelé — THEN une requête vers `/api/cache/files` est effectuée, le résultat est persisté en localStorage avec `fetchedAt = Date.now()`, et les pistes normalisées sont retournées.
- **SPEC-1.1.4** GIVEN l'option `forceRefresh: true` — WHEN `fetchServerCacheTracks({ forceRefresh: true })` est appelé — THEN le cache localStorage est ignoré et une requête serveur est systématiquement effectuée.
- **SPEC-1.1.5** GIVEN un objet cache dont le champ `tracks` est absent ou non-tableau — WHEN `isServerTracksCacheFresh` est évalué — THEN la valeur `false` est retournée (cache invalide).

### 1.2 Stockage local des stems sous forme de blob (IndexedDB)

- **SPEC-1.2.1** `saveStemBlob(track, variant, blob)` persiste le blob audio dans IndexedDB (base `mix-blind-test-stems`, store `stems`, clé = `stemKey`) en tant que stockage primaire, puis en Cache API si disponible.
- **SPEC-1.2.2** `getCachedStemObjectUrl(track, variant)` recherche le blob dans l'ordre suivant : (1) object URLs en mémoire, (2) IndexedDB, (3) Cache API. Retourne une `blob:` URL ou `''` si absent.
- **SPEC-1.2.3** `pruneCache()` supprime les entrées évincées à la fois d'IndexedDB et du Cache API avant de mettre à jour les méta en localStorage.
- **SPEC-1.2.4** `writeBlobToIdb` et `readBlobFromIdb` et `deleteBlobFromIdb` sont des méthodes atomiques sur le store IndexedDB ; toute erreur est silencieuse (retour `null` ou no-op).
- **SPEC-1.2.5** Les vérifications de disponibilité du Cache API utilisent `'caches' in globalThis` (compatible browser et Node) au lieu de `'caches' in window`.
```
