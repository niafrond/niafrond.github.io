# DJ-Mix — Spécifications (SDD)

Ce document liste les comportements attendus de l'application, organisés par domaine fonctionnel.
Chaque spec est formulée de manière testable (GIVEN / WHEN / THEN).
Les valeurs entre `backticks` sont les constantes ou bornes exactes du code.

---

## 1. Lecture audio (Player)

### 1.1 Double platine

- **SPEC-1.1.1** L'application dispose de deux platines (Deck A, Deck B), chacune étant un `HTMLAudioElement`.
- **SPEC-1.1.2** Une seule platine est active à un instant donné (propriété `#active` = `'A'` ou `'B'`).
- **SPEC-1.1.3** GIVEN une platine active avec un morceau en cours — WHEN un crossfade se termine — THEN `#active` bascule vers l'autre platine.
- **SPEC-1.1.4** GIVEN un crossfade qui se termine — WHEN la platine entrante est en pause — THEN la lecture est relancée automatiquement (`play()`).
- **SPEC-1.1.5** GIVEN aucune platine active — WHEN un morceau est chargé via `play(source)` — THEN il démarre sur la platine A par défaut.
- **SPEC-1.1.6** GIVEN un crossfade en cours — WHEN le système doit déterminer quelle platine est sortante — THEN la platine dont le volume est le plus élevé est choisie comme sortante (`volB >= volA ? 'B' : 'A'`).
- **SPEC-1.1.7** La platine inactive prépare le morceau suivant (prefetch via `ensureLocalSource`).
- **SPEC-1.1.8** GIVEN une lecture active — WHEN la lecture démarre (`statechange` paused=false) — THEN une vérification toutes les 10 s est lancée pour s'assurer que la platine inactive a bien une piste préchargée (`deckDisplayItems[inactiveDeck] != null`).
- **SPEC-1.1.9** GIVEN la vérification périodique active — WHEN une piste est détectée sur la platine inactive — THEN la vérification est arrêtée.
- **SPEC-1.1.10** GIVEN la vérification périodique active — WHEN la platine active change (ex. fin de crossfade) — THEN la vérification est relancée depuis zéro avec la nouvelle platine inactive.
- **SPEC-1.1.11** GIVEN la vérification périodique active — WHEN la lecture s'arrête (`statechange` paused=true) — THEN la vérification est annulée.
- **SPEC-1.1.12** GIVEN la vérification périodique — WHEN le même morceau (`id` identique) est détecté sur les deux platines — THEN `deckDisplayItems[inactiveDeck]` est réinitialisé à `null` (guard anti-doublon).
- **SPEC-1.1.13** GIVEN la platine active en cours de lecture (`src` défini, non en pause) — WHEN `playOnDeck` est appelé sur cette platine avec `paused: true` (préchargement) — THEN le chargement est refusé sans toucher à l'audio (log `deck.load.rejected.activePlaying`). Un préchargement ne doit jamais mettre en pause la musique en cours.
- **SPEC-1.1.14** GIVEN une source déjà chargée sur une platine (`#deckSourceMeta[otherDeck].url`) — WHEN `playOnDeck` est appelé sur l'autre platine avec `paused: true` et la même URL — THEN le chargement est refusé (log `deck.load.rejected.duplicateSource`). Le même titre ne doit jamais être chargé sur les deux platines.
- **SPEC-1.1.15** GIVEN un crossfade demandé vers une platine qui est (devenue) la platine active en cours de lecture — WHEN `crossfadeToDeck(targetDeck, …)` s'exécute — THEN la cible est redirigée vers la platine réellement inactive (log `crossfade.retargeted.activeDeck`). Côté `main.js`, `startPlaybackForIndex` re-résout la platine inactive après `ensureLocalSource` et re-cible (`setDeckItem`) si la cible initiale est devenue active pendant la préparation asynchrone.
- **SPEC-1.1.16** GIVEN un préchargement asynchrone du morceau suivant sur la platine inactive (`ensureLocalSource` → `playOnDeck` paused) — WHEN, au moment où la source est prête, la platine visée n'est plus inactive, OU l'item n'est plus assigné à cette platine, OU l'item est devenu le morceau courant — THEN le `playOnDeck` est abandonné (préchargement obsolète, log `stale … preload aborted`). S'applique aux 3 sites : préchargement post-crossfade, ghost fil rouge, remplacement de ghost dans `addToQueue` (main.js et lib/queueManager.js).

### 1.2 Crossfade

- **SPEC-1.2.1** La durée du crossfade est réglable entre `1` et `30` secondes (clamp via `Math.max(1, Math.min(30, value))`). Défaut : `6` secondes.
- **SPEC-1.2.2** GIVEN un morceau en lecture — WHEN le temps restant (`duration - currentTime`) atteint `crossfadeDurationMs` — THEN le crossfade démarre automatiquement. Le plancher interne est `250 ms`.
- **SPEC-1.2.3** GIVEN un crossfade en cours — WHEN le progrès `t` avance de `0` à `1` — THEN le volume de la platine sortante décroît et celui de la platine entrante croît selon la courbe définie par le mode de transition actif.
- **SPEC-1.2.4** GIVEN un DJ Plan avec `crossfadeDurationSec > 0` — WHEN le crossfade est déclenché pour cette transition — THEN la durée du DJ Plan remplace temporairement la durée globale.

### 1.3 Modes de transition (25 modes)

#### 1.3.1 Catalogue

| # | Clé | Coût RAM (Mo) | Overlap | Courbe sortante | Courbe entrante |
|---|-----|---------------|---------|-----------------|-----------------|
| 1 | `auto` | 0 | 0 | — | — |
| 2 | `crossfade_linear` | 18 | 1.0 | `start × (1−t)` | `start + (1−start) × t` |
| 3 | `crossfade_logarithmic` | 20 | 1.02 | `start × cos(π/2 × t)` | `start + (1−start) × sin(π/2 × t)` |
| 4 | `fade_in_out` | 24 | 1.05 | `start × (1−t)^1.4` | `start + (1−start) × t^0.7` |
| 5 | `cut_transition` | 6 | 0.12 | Coupe sèche | Entrée immédiate |
| 6 | `filter_sweep_low_high` | 96 | 1.2 | `start × (1−√t)` + playback rate 0.86→1 | Hybride √t + linéaire, rate 1.08→0.9 |
| 7 | `eq_transition_simple` | 44 | 1.08 | `start × (1 − 0.82×t)` | `start + (1−start) × t^1.2` |
| 8 | `echo_out_light` | 128 | 1.35 | `max(0.06, start × (1−t))` (plancher 6%) | `start + (1−start) × t^1.05` |
| 9 | `reverb_short_simple` | 172 | 1.55 | Soft jusqu'à 80%, puis linéaire | `t^1.3` |
| 10 | `short_loop` | 108 | 1.22 | Linéaire | Modulé : `× (0.85 + 0.15×|sin(6πt)|)` |
| 11 | `brake_tape_stop_simple` | 58 | 1.12 | `start × (1−t^1.6)` | `start + (1−start) × t^1.1` |
| 12 | `short_reverse` | 122 | 1.24 | `start × (1−t) × (1 − 0.18×sin(7πt))` | Linéaire |
| 13 | `sidechain_basic` | 52 | 1.1 | Linéaire | Pump : `× (1 − 0.25×max(0,sin(8πt)))` |
| 14 | `volume_ducking` | 40 | 1.06 | Duck à 40% du progrès | Linéaire |
| 15 | `gain_automation` | 34 | 1.0 | `start × (1 − t^1.8)` | `start + … × t^1.45` |
| 16 | `filter_automation` | 104 | 1.25 | Cosine sweep `0.5 − 0.5×cos(πt)` | Miroir |
| 17 | `crossfade_lowpass` | 140 | 1.18 | Log (cos) + filtre low-pass sortant | Log (sin) |
| 18 | `crossfade_highpass_in` | 118 | 1.12 | Linéaire | Linéaire + filtre high-pass entrant |
| 19 | `filter_dual_sweep` | 178 | 1.35 | Cosine sweep + low-pass sortant | Miroir + high-pass entrant |
| 20 | `echo_lowpass` | 216 | 1.45 | `max(0.08, start × (1−t))` (plancher 8%) + echo + LP | `start + … × t^1.08` |
| 21 | `bass_swap` | 175 | 1.30 | `start × cos(π/2 × t^0.85)` | `start + … × t^0.85` |
| 22 | `kick_swap` | 145 | 1.25 | S-curve cosine | Entrée retardée à 30% : `(t−0.3)/0.7` |
| 23 | `beat_repeat` | 112 | 1.20 | Plein jusqu'à 65%, puis phase out | Minimal (5%) jusqu'à 65%, puis entrée dure |
| 24 | `backspin` | 85 | 0.95 | Décélération rapide jusqu'à 35%, puis 0 | Entrée dès 20% (avant l'arrêt complet) : `((t−0.2)/0.5)^0.7` |
| 25 | `echo_freeze` | 195 | 1.48 | Plancher 12% gelé jusqu'à 65%, puis fade | Entrée retardée à 45% : `(t−0.45)^0.8` |

#### 1.3.2 Coût RAM

- **SPEC-1.3.2.1** Le coût RAM est calculé par : `extraMb + overlapMb × overlapFactor`, avec `overlapMb = (44100 × 2 × 4 × crossfadeDurationMs/1000) / (1024×1024)` ≈ 1.69 Mo/s.

#### 1.3.3 Sélection automatique (`auto`)

- **SPEC-1.3.3.1** GIVEN le mode `auto` — WHEN un crossfade est déclenché — THEN le système sélectionne aléatoirement un mode parmi tous les modes autorisés (hors `auto`), en déprioritisant les modes récemment utilisés pour maximiser la variété.
- **SPEC-1.3.3.2** Contraintes prioritaires (évaluées avant le tirage aléatoire) :
  1. Morceau suivant < 95s → `cut_transition`
  2. Temps restant < 3.5s → `[echo_out_light, cut_transition, fade_in_out]`
  3. Sinon → tirage aléatoire parmi tous les modes autorisés (sauf `auto` et `reverb_short_simple`, désactivé — cf. SPEC-1.3.7)
- **SPEC-1.3.3.3** GIVEN la liste de candidats — WHEN le mode est sélectionné — THEN un tirage pondéré est effectué : les modes récemment utilisés (cooldown = `ceil(eligible.length / 2)`, buffer de 16 derniers) reçoivent un poids réduit (0.15 pour les 1–2 derniers, 0.5 pour les 3–4, 0.8 pour les plus anciens).

#### 1.3.4 Filtre RAM

- **SPEC-1.3.4.1** GIVEN un device mobile — WHEN le filtre RAM est activé — THEN seuls les modes dont le coût ≤ budget RAM sont proposés. Budget = `max(64, totalRamMb × 0.12)`.
- **SPEC-1.3.4.2** `auto` et `cut_transition` sont toujours autorisés (fallbacks garantis).
- **SPEC-1.3.4.3** Estimation de la RAM totale : `navigator.deviceMemory × 1024` si disponible, sinon ≤2 cores → 1536 Mo, ≤4 → 2048, ≤6 → 3072, sinon 4096.
- **SPEC-1.3.4.4** Le filtre RAM ne s'active que sur mobile OU si `ramTotalMbOverride > 0` (bornes : `512`–`32768`).

#### 1.3.5 Beat repeat synchronisé (FX live pendant la transition)

- **SPEC-1.3.5.1** GIVEN le mode `beat_repeat` est sélectionné (auto ou manuel) — WHEN la transition démarre (event `transitionmode`) — THEN `triggerBeatRepeatTransitionFx` est appelé : un loop roll est déclenché immédiatement sur la platine sortante ET sur la platine entrante avec un délai de `350 ms` (pour laisser la piste entrante démarrer sa lecture).
- **SPEC-1.3.5.2** La fenêtre de boucle (`windowMs`) est calculée à partir du BPM de la piste entrante : `windowMs = round(30 000 / BPM)` (1/8 de note). Plage : `60`–`500 ms`. BPM par défaut si inconnu : `120`.
- **SPEC-1.3.5.3** L'intervalle de ré-ancrage (`tickMs`) est identique à `windowMs` pour créer une boucle exacte sur la division rythmique.
- **SPEC-1.3.5.4** La durée du loop roll est `crossfadeDurationMs × 0.65` pour la platine sortante, et `(crossfadeDurationMs × 0.65) − 350 ms` pour la platine entrante (délai initial déduit).
- **SPEC-1.3.5.5** Les deux platines utilisent le BPM de la piste entrante pour maintenir la cohérence rythmique perçue pendant la transition.

#### 1.3.6 Continuité audio (pas de silence)

- **SPEC-1.3.6.1** GIVEN un mode de transition autre que `cut_transition` (coupure instantanée intentionnelle) — WHEN le crossfade progresse — THEN la somme des volumes `from + to` ne doit jamais rester sous `0.05` pendant plus de `100 ms`.
- **SPEC-1.3.6.2** GIVEN le mode `fade_in_out` — WHEN le crossfade progresse — THEN le volume entrant (`to`) commence sa montée dès `t=0` (courbe `t^0.7`, pas de palier plat initial).
- **SPEC-1.3.6.3** GIVEN le mode `backspin` — WHEN le crossfade progresse — THEN le volume entrant (`to`) commence sa montée dès `t=0.2`, avant l'arrêt complet du deck sortant à `t=0.35`, évitant tout palier de silence total.
- **SPEC-1.3.6.4** GIVEN le mode `brake_tape_stop_simple` — WHEN le crossfade progresse — THEN le playback rate des deux platines suit le comportement générique (retour lissé vers `1`, `+= (1 − rate) × 0.18` par tick) — ce mode n'applique plus de décélération dédiée du playback rate.

#### 1.3.7 Mode `reverb_short_simple` désactivé

- **SPEC-1.3.7.1** Le mode `reverb_short_simple` produisait un son jugé insupportable (queue de réverb simulée via l'effet distortion) et est désactivé : il reste implémenté dans le catalogue (RAM, courbes, `switch`) mais n'est plus jamais choisi.
- **SPEC-1.3.7.2** GIVEN le mode `auto` — WHEN un mode est tiré au sort — THEN `reverb_short_simple` est exclu du pool (`#chooseAutoTransitionMode`), même s'il figure dans `allowedTransitionModes`.
- **SPEC-1.3.7.3** GIVEN le sélecteur manuel "Mode AutoMix" — THEN l'option `reverb_short_simple` n'est plus proposée dans le `<select>`.
- **SPEC-1.3.7.4** `reverb_short_simple` est retiré de `allowedTransitionModes` côté `main.js` (`DISABLED_TRANSITION_MODES`), donc même une valeur persistée (ancien réglage) retombe sur `auto` via `getSafeAllowedTransitionMode` / `#resolveAllowedTransitionMode`.

### 1.4 Contrôle du playback

- **SPEC-1.4.1** Play / Pause sont disponibles via l'UI et via Media Session API (`navigator.mediaSession.setActionHandler`).
- **SPEC-1.4.2** GIVEN un morceau avec `startPositionMs` défini — WHEN la lecture démarre — THEN le player attend 1 seconde après le chargement puis seek à `Math.min(durationMs, startPositionMs)`.
- **SPEC-1.4.3** Le playback rate est ajustable. Transition lissée sur `180 ms` via `requestAnimationFrame` avec easing quadratique. Plage safe : `0.5`–`2.0`.
- **SPEC-1.4.4** `syncDecksToActive()` aligne le rate de la platine inactive sur celui de la platine active en `220 ms`.
- **SPEC-1.4.5** GIVEN un DJ Plan avec `recommendedBpm` — WHEN le crossfade démarre — THEN le playback rate de la platine entrante est calculé via `computeDjBpmRate()`.

### 1.5 Détection d'intro vide (Empty Intro Skip)

- **SPEC-1.5.0.1** GIVEN un morceau avec mixData — WHEN aucune zone de type `breakdownZones`, `dropZones`, `peakZones` ou `avoidTransitionZones` ne commence avant `15` secondes — THEN le début du morceau est considéré comme une intro vide.
- **SPEC-1.5.0.2** GIVEN une intro vide détectée — WHEN un offset de départ est calculé — THEN l'offset recommandé est la `startSec` de la première zone (parmi breakdown, drop, peak, avoidTransition), triée chronologiquement.
- **SPEC-1.5.0.3** L'offset calculé par la détection d'intro vide participe au `Math.max` général de `resolveMixDataStartOffsetMs` — il ne peut qu'augmenter l'offset, jamais le diminuer.
- **SPEC-1.5.0.4** GIVEN le morceau a une durée connue — WHEN l'offset calculé dépasse `durationSec − 30` — THEN l'offset est ignoré (sécurité : ne pas sauter la quasi-totalité du morceau).

### 1.6 Limitation de durée (trackMaxDuration)


#### 1.6.1 Configuration

- **SPEC-1.6.1.1** Deux modes de limitation : `sec` (secondes fixes) et `pct` (pourcentage hors intro/outro).
- **SPEC-1.6.1.2** Mode `sec` : valeur bornée `0`–`600` secondes. Défaut : `0` (désactivé).
- **SPEC-1.6.1.3** Mode `pct` : valeur bornée `5`–`95` %. Défaut : `50` %.
- **SPEC-1.6.1.4** Un toggle `trackMaxDurationEnabled` active/désactive la limitation indépendamment de la valeur.

#### 1.6.2 Calcul en mode pourcentage

- **SPEC-1.6.2.1** GIVEN un morceau avec mixData — WHEN le mode `pct` est actif — THEN la durée effective est calculée :
  ```
  introEndSec = mixData.probableSongStartSec || 0
  outroStartSec = min(...mixData.outroZones.map(z => z.startSec)) || durationSec
  effectiveDuration = max(0, outroStartSec − introEndSec)
  résultat = introEndSec + effectiveDuration × pct / 100
  ```
- **SPEC-1.6.2.2** GIVEN un morceau sans mixData — WHEN le mode `pct` est actif — THEN `introEndSec = 0` et `outroStartSec = durationSec` (100% de la durée est « effective »).

#### 1.6.3 Déclenchement du crossfade

- **SPEC-1.6.3.1** GIVEN la limitation activée et `trackMaxDurationAppliedSec > 0` — WHEN la position de lecture atteint `trackMaxDurationAppliedSec × 1000 + autoDjStartOffsetMs` — THEN le crossfade est déclenché immédiatement via `autoMixBtn.click()`, indépendamment de l'état Auto DJ.
- **SPEC-1.6.3.2** Le déclenchement ne se produit qu'une seule fois par morceau (guard `maxDurMarkerTriggeredForTrack`).
- **SPEC-1.6.3.3** GIVEN l'Auto DJ activé avec mixData — WHEN la durée max est définie — THEN `findBestTransitionZone` utilise `maxDurationSec` comme `targetSec` pour trouver une zone de transition proche du point de coupure.
- **SPEC-1.6.3.4** GIVEN le trigger calculé par zone dépasse `maxDurationMs` — THEN il est cappé à `maxDurationMs`, puis `advancePastMaxDurationBlock` vérifie que le point ne tombe pas dans une zone stricte (drop, haute énergie, neverMiss). Si c'est le cas, le trigger avance à `zoneEndSec + 500 ms`, cappé à `trackDurationMs − 10 s`.

#### 1.6.4 Marqueur visuel

- **SPEC-1.6.4.1** Le marqueur vert (snappé sur zone) est positionné à `(markerMs / durationMs) × 100 %`.
- **SPEC-1.6.4.2** GIVEN la valeur utilisateur et la valeur snappée diffèrent de plus de `0.2 %` — THEN un marqueur translucide secondaire (raw) est affiché.
- **SPEC-1.6.4.3** Quand la limitation change, `recalculateAutomixTimingIfNeeded` est appelé pour resynchroniser le timing Auto DJ.

---

## 2. File d'attente (Queue)

### 2.1 Gestion CRUD

- **SPEC-2.1.1** GIVEN un morceau valide — WHEN `addToQueue(item)` est appelé — THEN le morceau est ajouté en fin de queue avec ses métadonnées extraites (BPM, genre, stems, artwork).
- **SPEC-2.1.2** GIVEN le morceau en cours de lecture — WHEN `removeFromQueue(index)` est appelé sur ce morceau — THEN la suppression est bloquée.
- **SPEC-2.1.3** GIVEN un morceau retiré — WHEN il est supprimé — THEN `releaseLocalBlob()` est appelé pour libérer sa mémoire, et `deckBCueIndex` est ajusté si nécessaire.
- **SPEC-2.1.4** Le réordonnancement se fait par drag-and-drop via `reorderQueue(fromIndex, toIndex, insertAfter)`. Le `deckBCueIndex` est mis à jour si l'item déplacé affecte l'item cué.
- **SPEC-2.1.5** La queue est persistée dans `localStorage` sous la clé `dj-mix:queue`, au format allégé `{ index, items: [{id, queueSource, autoDjReferenceTrackId, autoDjStartOffsetMs}] }` — les métadonnées du morceau (nom, artiste, bpm, artwork, etc.) sont résolues via le trackStore partagé (cf. §2.6), pas dupliquées ici.

### 2.2 Dédoublonnage

- **SPEC-2.2.1** GIVEN un item à ajouter — WHEN un item existant dans la queue a le même `id` OU le même couple `(name, artist)` — THEN l'ajout est bloqué et un toast "Déjà dans la file" est affiché (error=true).
- **SPEC-2.2.2** GIVEN un doublon détecté avec `playNow=true` — THEN au lieu d'ajouter, la lecture saute directement à l'item existant dans la queue.

### 2.3 Modes de lecture

- **SPEC-2.3.1** GIVEN le mode Loop activé et la lecture atteint le dernier morceau — WHEN le morceau suivant est demandé — THEN l'index revient à `0` (wrap via modulo : `((i % len) + len) % len`).
- **SPEC-2.3.2** GIVEN le mode Shuffle activé — WHEN le morceau suivant est demandé — THEN un index aléatoire est choisi (`Math.random()`). Jusqu'à `20` tentatives sont effectuées pour éviter de choisir le même index. Après 20 échecs, retourne `-1` (fin de queue).
- **SPEC-2.3.3** GIVEN Shuffle ET Loop activés — THEN Shuffle prend la priorité : un index aléatoire est choisi, le mode Loop est ignoré.
- **SPEC-2.3.4** GIVEN `wrap=false` passé explicitement — THEN le flag Loop est ignoré même s'il est activé.
- **SPEC-2.3.5** Les modes Loop et Shuffle sont persistés dans `localStorage` (clés `dj-mix:queue:loop`, `dj-mix:queue:shuffle`).

### 2.4 Prefetch

- **SPEC-2.4.1** GIVEN un morceau en lecture — WHEN la lecture démarre — THEN `prefetchNext(index)` est planifié en idle (`scheduleIdle`).
- **SPEC-2.4.2** GIVEN l'item suivant a déjà un `localBlobUrl` — THEN le prefetch est ignoré.
- **SPEC-2.4.3** GIVEN le mode low-memory actif — THEN `trimRetainedAudioSources()` est appelé avant le prefetch.
- **SPEC-2.4.4** GIVEN l'item a été retiré de la queue entre la planification et l'exécution — THEN le prefetch est annulé.

### 2.5 Affichage de la liste (buildQueueHTML)

- **SPEC-2.5.1** Chaque item affiche 2 boutons `queue-cue` (platine 1 / platine 2, `data-deck="A"`/`"B"`) permettant de cuer le morceau sur une platine donnée (cf. handler `.queue-cue` dans `main.js`). Le bouton de la platine sur laquelle l'item cué est actif reçoit la classe `is-selected`.
- **SPEC-2.5.2** GIVEN un item déjà chargé sur une platine (`deckDisplayItems`) — THEN le bouton `queue-cue` correspondant reçoit la classe `is-loaded-deck`, est `disabled`, et porte le titre `Déjà chargée sur platine 1` (ou `2`).
- **SPEC-2.5.3** GIVEN un item chargé sur une seule platine — THEN un badge `queue-deck-badge` affiche `platine 1` ou `platine 2`. GIVEN le même item chargé sur les deux platines — THEN le badge affiche `DJ 1+2`.
- **SPEC-2.5.4** Les chips BPM/genre (`queue-chip`) ne sont affichées que si `djMode === 'dance'` ; masquées en mode `music`.
- **SPEC-2.5.5** Chaque item affiche un bouton `.queue-refresh-mix-btn` (« Actualiser mix data ») — WHEN cliqué — THEN `_refreshQueueMixData(item, btn)` (`main.js`) appelle `autoModeManager.refreshMixData(item.name, item.artist)`, qui invalide le cache mémoire (`MIX_DATA_CACHE`) ET l'entrée `localStorage` (`invalidateStoredTrackMeta`) avant de redéléguer à `fetchMixData` pour forcer un appel réseau frais à `GET {apiUrl}/mix`. Le bouton reçoit la classe `is-checking` (spinner) pendant l'appel. GIVEN une réponse avec des données de mix — THEN un toast `Mix data actualisées : <nom>` est affiché ; GIVEN `null` (404, échec réseau, ou API indisponible) — THEN un toast d'erreur `Aucune donnée de mix disponible` (ou `Erreur réseau` en cas d'exception) est affiché. Ce bouton remplace l'ancien bouton « Contrôle empreinte » (cf. §18, supprimé).

### 2.6 Stockage partagé des morceaux (trackStore)

- **SPEC-2.6.1** GIVEN un morceau ajouté à la Queue OU au Fil Rouge — WHEN il est résolu via `trackStore.getOrCreate(track)` (`lib/trackStore.js`) — THEN une instance JS canonique unique est créée (ou réutilisée si un morceau de même `id` — résolu via `getTrackCacheKey`, cf. `lib/audioSourceManager.js` — existe déjà), partagée par toute liste qui référence ce morceau. Un morceau peut légitimement être présent à la fois dans la Queue et le Fil Rouge : dans ce cas, les deux listes référencent le MÊME objet, pas deux copies indépendantes.
- **SPEC-2.6.2** GIVEN un morceau déjà connu du trackStore — WHEN `getOrCreate` est appelé avec des champs supplémentaires — THEN ces champs sont fusionnés dans l'enregistrement existant ; un champ entrant vide/nul/zéro ne remplace jamais un champ déjà renseigné (ex. un `artUrl` déjà résolu n'est pas écrasé par un ajout ultérieur sans artwork).
- **SPEC-2.6.3** GIVEN un champ de morceau (bpm, genre, artUrl, stems, cachePath, djTrackId, djHasAnalysis, djTransition, djIsIconic, etc.) — WHEN il est modifié via `trackStore.patch(id, fields)` (utilisé par `metaFetchService`, la récupération d'artwork, `filRougeManager.patchPlaylistItem`) — THEN la mutation est visible immédiatement depuis la Queue ET le Fil Rouge si le morceau est présent dans les deux, sans appel de synchronisation manuel entre les deux listes.
- **SPEC-2.6.4** Champs persistés (liste blanche) : `id, uri, name, artist, artUrl, duration, bpm, genre, loudnessDb, audioFeatures, cachePath, ratingKey, persistedSourceUrl, stemsStatus, stems, danceability, year, djTrackId, djHasAnalysis, djTransition, djIsIconic`. Persisté sous la clé `dj-mix:tracks`, sauvegarde debounced à `400 ms`.
- **SPEC-2.6.5** Champs runtime, jamais persistés, réinitialisés à la restauration : `sourceState, sourceError, sourceMeta, localBlobUrl, localStemUrls, lastTouchedAt`. Un `getOrCreate` sur un enregistrement déjà existant NE réinitialise PAS ces champs, pour ne pas jeter un cache déjà préchargé (ex. morceau du Fil Rouge préchargé en ghost sur la platine inactive, puis effectivement ajouté à la Queue).
- **SPEC-2.6.6** Champs "locaux à la liste" gérés par la Queue elle-même, absents du trackStore : `queueSource`, `autoDjReferenceTrackId`, `autoDjStartOffsetMs`.
- **SPEC-2.6.7** GIVEN un enregistrement persisté `dj-mix:queue`/`dj-mix:fil-rouge` au format antérieur (contenant les métadonnées complètes au lieu d'une simple référence `id`) — WHEN il est restauré après mise à jour de l'application — THEN ses champs sont capturés dans le trackStore via `getOrCreate` plutôt que perdus ; la restauration tolère indifféremment l'ancien format riche et le nouveau format allégé.
- **SPEC-2.6.8** GIVEN un morceau n'est plus référencé par aucune liste (Queue, playlist Fil Rouge, priorityQueue Fil Rouge) — WHEN un balayage périodique (`trackStore.pruneUnreferenced`, toutes les `10 min` après un premier passage au démarrage) s'exécute — THEN son enregistrement est retiré du trackStore, pour éviter une croissance illimitée de `dj-mix:tracks`.

---

## 3. Fil Rouge

### 3.1 Playlist de fond

- **SPEC-3.1.1** Le Fil Rouge est une playlist séparée, persistée dans `localStorage` sous la clé `dj-mix:fil-rouge`, au format allégé `{ playlist: [ids...], priorityQueue: [ids...], currentIndex, shuffleEnabled, loopEnabled }` — les métadonnées de chaque morceau sont résolues via le trackStore partagé avec la Queue (cf. §2.6).
- **SPEC-3.1.2** Structure persistée : `{ playlist, priorityQueue, currentIndex, shuffleEnabled, loopEnabled }`, `playlist`/`priorityQueue` étant des tableaux d'`id` (pas d'objets morceau complets).
- **SPEC-3.1.3** La sauvegarde est debounced à `400 ms` via `scheduleSave()`.
- **SPEC-3.1.4** GIVEN la queue est vide — WHEN le morceau en cours se termine — THEN le Fil Rouge fournit le prochain morceau. `filRougeManager.isActive()` retourne `true` si `playlist.length > 0`.
- **SPEC-3.1.5** Les items en `priorityQueue` sont joués avant ceux de la playlist principale.
- **SPEC-3.1.6** GIVEN `djPlanManager` marque un morceau comme iconique (`djIsIconic`) via `patchPlaylistItem` — THEN ce champ est persisté (bug historique corrigé : il était absent de la liste blanche de sérialisation du Fil Rouge avant l'introduction du trackStore partagé, et donc silencieusement perdu à chaque sauvegarde/rechargement).

### 3.2 Gestion

- **SPEC-3.2.1** Shuffle et Loop du Fil Rouge sont des flags indépendants de ceux de la queue.
- **SPEC-3.2.2** GIVEN Shuffle FR activé — WHEN le morceau suivant est demandé — THEN un index aléatoire est choisi (pas de protection anti-répétition, contrairement à la queue).
- **SPEC-3.2.3** GIVEN Shuffle FR désactivé et Loop FR activé — THEN la playlist avance séquentiellement avec retour à l'index 0 en fin de liste.
- **SPEC-3.2.4** GIVEN Shuffle FR et Loop FR désactivés — THEN la lecture s'arrête en fin de playlist.
- **SPEC-3.2.5** `peekNextTrack()` retourne le prochain morceau sans avancer `currentIndex`. GIVEN Loop FR désactivé ET `currentIndex` est le dernier de la playlist — THEN `peekNextTrack()` retourne `null` (pas de wrap). GIVEN Loop FR activé — THEN retour à l'index 0.

### 3.3 Import

#### 3.3.1 Import TXT

- **SPEC-3.3.1.1** Format ligne : `"Artiste — Titre"` ou `"Artiste - Titre"` (regex : `/^(.+?)\s+(?:-|–|—)\s+(.+)$/u`).
- **SPEC-3.3.1.2** GIVEN une ligne sans séparateur — THEN toute la ligne devient le titre, artiste = `"Artiste inconnu"`.
- **SPEC-3.3.1.3** Les lignes vides et les commentaires sont ignorés.
- **SPEC-3.3.1.4** ID généré : `txt-${index}-${encodeURIComponent(artist)}-${encodeURIComponent(name)}`.
- **SPEC-3.3.1.5** GIVEN une ligne commence par un numéro de ligne (ex. `"1. "`, `"1- "`, `"1) "`, `"3 "`) — THEN le préfixe numérique est supprimé avant le parsing artiste/titre (regex : `/^\d+(?:[.\-)]\s*|\s+)/`).

#### 3.3.2 Import Spotify

- **SPEC-3.3.2.1** Flow : parse playlist ID → fetch snapshot (name, snapshot_id) → fetch tracks (pagination `limit=100`) → replace Fil Rouge → store source metadata → start sync loop.
- **SPEC-3.3.2.2** Sync : poll toutes les `120 000 ms` (`SPOTIFY_FIL_ROUGE_POLL_MS`), compare `snapshot_id`. Backoff max : `× 32`.
- **SPEC-3.3.2.3** GIVEN le snapshot_id a changé — THEN merge des nouveaux morceaux en préservant les suppressions locales.
- **SPEC-3.3.2.4** `normalizeSpotifyPlaylistTracks()` filtre les pistes locales et les non-tracks.
- **SPEC-3.3.2.5** `computePlaylistFingerprint()` crée un hash depuis `id:name:artist:duration`.

#### 3.3.3 Import serveur

- **SPEC-3.3.3.1** Endpoint : `GET /api/cache/files?limit=${pageSize}&offset=${offset}`.

### 3.4 Téléchargement en arrière-plan

- **SPEC-3.4.1** Téléchargement par pool de téléchargements à fenêtre glissante (sliding window), de concurrence initiale `6` morceaux en parallèle (concurrence ensuite ajustée dynamiquement, voir SPEC-3.4.9). Un nouveau téléchargement démarre dès qu'un slot se libère, éliminant les temps morts entre les anciennes tranches fixes.
- **SPEC-3.4.2** Chaque morceau passe par les états : `idle` → `downloading` → `done` | `error`.
- **SPEC-3.4.3** L'artwork est récupéré après le téléchargement audio si disponible.
- **SPEC-3.4.4** Pendant les téléchargements, seuls les badges de statut du morceau concerné sont mis à jour dans le DOM (`renderFilRougeTrackStatus`). Le rebuild complet de la liste (`renderFilRouge`) n'est déclenché que pour les changements structurels (ajout/suppression de morceaux, fin de la phase de vérification du cache).
- **SPEC-3.4.5** Le téléchargement ne bloque pas la lecture en cours.
- **SPEC-3.4.6** GIVEN un morceau déjà présent dans le Cache Storage local (vérifié via `isTrackInLocalCache`) — WHEN un téléchargement de masse est lancé (Tout télécharger, import TXT, import Spotify) — THEN le morceau est marqué `done` directement sans re-téléchargement. Le compteur de progrès ne compte que les morceaux réellement à télécharger.
- **SPEC-3.4.7** Les callbacks asynchrones d'arrière-plan (récupération d'artwork, métadonnées BPM/genre, planification DJ Plan incrémentale) appellent `renderFilRougeDebounced` (300 ms) et non `renderFilRouge` directement, pour éviter les rafales de rebuild DOM qui provoquent un clignotement de la liste et rendent les boutons incliquables.
- **SPEC-3.4.8** `fetchMissingMeta(item)` ne déclenche un re-render (`renderQueueDebounced`/`renderFilRougeDebounced`) que si le BPM ou le genre de l'item a réellement changé. Si la résolution via le cache `localStorage` ne complète pas entièrement les métadonnées manquantes, l'item est marqué comme « tenté » (`metaFetchAttempted`) avant l'appel API, pour empêcher les re-renders en boucle infinie à chaque cycle de `renderFilRouge` pour les morceaux dont les métadonnées resteront durablement incomplètes.
- **SPEC-3.4.9** La concurrence du pool est recalculée (`computeNextBatchSize`) toutes les N complétions à partir du temps moyen observé par morceau : si ce temps dépasse `4000 ms`, la concurrence est réduite de `2` (plancher `2`) ; si elle est inférieure à `1000 ms` (le quart de la cible), elle est augmentée de `4` ; si elle est inférieure à `2000 ms` (la moitié de la cible), elle est augmentée de `2` (plafond `20`). Entre ces seuils, la concurrence reste inchangée. Objectif : atteindre le débit max très rapidement tout en se retirant vite si la bande passante sature.
- **SPEC-3.4.9.1** La récupération des mix infos (`fetchMixData`) après chaque téléchargement réussi est non-bloquante (fire-and-forget) : elle ne retarde pas le lancement du téléchargement suivant dans le pool. `hasMixInfo` est initialisé à `false` dès le succès du download, puis mis à jour de manière asynchrone quand la réponse de `fetchMixData` arrive.
- **SPEC-3.4.10** GIVEN plusieurs déclencheurs de téléchargement de masse (synchronisation au chargement de la page `startFilRougeStartupCacheSync`, "Tout télécharger" `filRougeDownloader.downloadAll`, boucle de sync Spotify, import TXT) appellent `prefetchTrackToLocalCache` pour le **même morceau** (même `cacheKey`) de façon concurrente — THEN un seul téléchargement réseau est effectué : l'appel concurrent rejoint la promesse déjà en cours au lieu d'en déclencher une nouvelle. Ceci évite les téléchargements en double et les statuts (`downloadState`) incohérents (ex. `done` écrasé par `error` ou inversement selon l'ordre d'arrivée) qui se produisaient notamment juste après un rechargement de page (pendant que la synchronisation de démarrage tourne encore) ou lorsqu'un morceau met du temps à se télécharger (élargissant la fenêtre de recouvrement avec un autre déclencheur). Une fois l'appel en cours résolu (succès ou échec), un appel ultérieur relance un vrai téléchargement.
- **SPEC-3.4.11** GIVEN le Fil Rouge contient au moins un morceau dont `downloadState` n'est ni `done` ni `downloading` (titre manquant) — WHEN un nouveau titre démarre effectivement sur une platine (fin réussie de `startPlaybackForIndex`, à chaque changement de titre lecture) — THEN `filRougeDownloader.downloadAll()` est déclenché automatiquement, comme un clic sur "Tout télécharger" (`maybeAutoDownloadMissingFilRouge`, exposé via `filRougeDownloader.hasMissingDownloads()`). Ce déclenchement est ignoré si un lot de téléchargement est déjà en cours (`isInternalQueueRunning()`) ou si le bouton mix info est désactivé (récupération de mix info déjà en cours), pour éviter les déclenchements concurrents.

### 3.5 Indicateurs de statut par morceau

- **SPEC-3.5.1** Chaque morceau du Fil Rouge affiche un badge « Mix info » indiquant si les données d'analyse de mix (mixData) sont disponibles pour ce morceau. Badge `is-done` si `hasMixInfo=true`, badge `is-idle` sinon.
- **SPEC-3.5.2** La présence de mix info est déterminée par : (a) le flag `hasMixInfo` dans le statut local, ou (b) la présence de `mixData` dans le `trackMetaStorage` (localStorage).
- **SPEC-3.5.3** GIVEN un morceau téléchargé avec succès via `downloadAll` (bouton "Tout télécharger") — WHEN `fetchMixData` retourne des données — THEN `hasMixInfo` est mis à `true` dans le statut du morceau. Ceci s'applique aussi aux morceaux déjà en cache détectés lors du même `downloadAll`.
- **SPEC-3.5.4** Le Fil Rouge n'affiche PAS de badge indiquant la présence des stems. Seuls le statut de téléchargement et le statut mix info sont affichés.
- **SPEC-3.5.5** GIVEN un morceau du Fil Rouge est ajouté à la file d'attente (`addToQueue`) — WHEN `preloadMixDataForDeckItem` se termine avec succès — THEN le badge « Mix info » du morceau dans le Fil Rouge est immédiatement mis à jour via `renderFilRougeTrackStatus`, reflétant la présence des mix data désormais disponibles en localStorage.
- **SPEC-3.5.6** GIVEN un morceau du Fil Rouge a `downloadState: 'done'` mais `hasMixInfo: false` (mix data absentes) — WHEN l'utilisateur clique sur « Tout télécharger » (`downloadAll`) — THEN `fetchMixData` est appelé pour ce morceau via une tâche séquentielle parallèle à la tâche de téléchargement audio (`_runMixInfoTask`), et `hasMixInfo` est mis à jour en conséquence, sans re-télécharger l'audio. Un toast « Mix info mis à jour (N morceau(x)) » est affiché si aucun téléchargement audio n'était nécessaire.
- **SPEC-3.5.7** Bouton dédié « Mix suggestions manquantes » (`#filrouge-mixinfo-btn`, `filRougeDownloader.downloadMissingMixInfo`) : force un nouvel appel à `fetchMixData` (endpoint `/mix` — mix suggestions) pour tous les morceaux `downloadState: 'done'` avec `hasMixInfo: false`, sans télécharger d'audio. Permet de rattraper les mix suggestions manquées par SPEC-3.5.6 (échec API ponctuel, suggestions pas encore calculées côté serveur au moment du premier essai, etc.) sans relancer un « Tout télécharger » complet.
  - GIVEN aucun morceau `done` sans mix info — THEN toast « Aucune mix info manquante », aucun appel API.
  - GIVEN N morceaux traités — THEN toast « Mix info mis à jour (N morceau(x)) », ou « Mix info mis à jour (D/N), F échec(s) » si `F` échecs.
  - Pendant l'exécution, le bouton affiche `Mix info : done / total` et est désactivé.
  - Le bouton « Mix suggestions manquantes » peut être déclenché à tout moment, y compris pendant qu'un « Tout télécharger » est en cours : `downloadMissingMixInfo` ne touche que les morceaux `downloadState: 'done'` (jamais ceux en cours de téléchargement), et `prefetchTrackToLocalCache` déduplique déjà les téléchargements audio par clé de cache — les deux tâches peuvent donc tourner en parallèle sans conflit.
  - À l'inverse, cliquer sur « Tout télécharger » pendant qu'une récupération manuelle de mix suggestions est en cours affiche un toast d'avertissement et n'a aucun effet.

### 3.6 Tri de la playlist

- **SPEC-3.6.1** 6 modes de tri disponibles : `original` (ordre d'insertion, défaut), `bpm` (BPM décroissant), `danceability` (dançabilité décroissante), `year` (année décroissante), `best` (score composite décroissant), `pattern` (enchaînement musical calculé par l'API).
- **SPEC-3.6.2** Le mode de tri actif est persisté dans `localStorage` sous la clé `dj-mix:fil-rouge:sort`.
- **SPEC-3.6.3** GIVEN mode ≠ `original` — WHEN l'utilisateur sélectionne un tri — THEN `POST /api/fil-rouge/sort` est appelé avec `{ tracks: FilRougeItem[], mode: string }` ; l'ordre retourné par l'API est utilisé pour réordonner les items locaux (par `id`), et `filRougeManager.setPlaylist()` est appelé avec ces items locaux réordonnés. Les données locales de chaque item (`cachePath`, `persistedSourceUrl`, stems, etc.) sont préservées intégralement.
- **SPEC-3.6.4** Le `currentIndex` est préservé après le tri : `setPlaylist()` recherche l'`id` du morceau en cours dans le nouvel ordre.
- **SPEC-3.6.5** GIVEN l'API répond en erreur — THEN un toast `"Tri indisponible (API)"` est affiché et la playlist reste inchangée.
- **SPEC-3.6.6** Mode `original` — WHEN sélectionné — THEN aucun appel API n'est effectué et `renderFilRouge()` est appelé directement.
- **SPEC-3.6.7** Mode `best` côté API : score décroissant = `danceability × 0.5 + bpm_normalisé × 0.3 + year_normalisé × 0.2`. BPM et année normalisés sur [0,1] par rapport au min/max de la playlist. Les pistes sans données reçoivent un score partiel de 0 pour les champs manquants.
- **SPEC-3.6.8** ~~L'API enrichit les champs `danceability` et `year` manquants dans sa réponse.~~ (Supprimé : le reorder préserve les données locales ; les champs API ne sont pas fusionnés pour éviter d'écraser les données locales — cf. SPEC-3.6.12.)
- **SPEC-3.6.9** Mode `pattern` — WHEN sélectionné — THEN `POST /api/fil-rouge/sort` est appelé avec `mode: "pattern"` ; l'algorithme de tri est entièrement délégué à l'API (enchaînement musical, logique serveur).
- **SPEC-3.6.10** La réponse de l'API contient un champ `transitions[]` (longueur = `tracks.length - 1`). Pour chaque entrée non-`null` à l'index `i`, les données de transition sont stockées sur `tracks[i]` via `filRougeManager.patchPlaylistItem(id, { djTransition })` avec les champs `toItemId`, `automixMode`, `mixOutSec`, `mixInSec`, `mixInSecDefined`, `crossfadeDurationSec`, `compatibilityScore`. Les entrées `null` sont ignorées.
- **SPEC-3.6.11** Si `getTrackMaxDurationAppliedSec()` retourne une valeur > 0, le champ `maxDuration: { value: number, unit: "s" }` est inclus dans le corps de la requête. Absent sinon.
- **SPEC-3.6.12** Le reorder via l'API préserve intégralement les données locales : les items retournés par l'API sont mappés par `id` vers les items locaux ; seul l'ordre est repris depuis l'API. Les items locaux non présents dans la réponse API sont ajoutés en fin de liste (filet de sécurité). Les champs locaux (`cachePath`, `persistedSourceUrl`, `localStemUrls`, `stems`, etc.) ne sont jamais écrasés.

---

## 4. Recherche

### 4.1 Recherche textuelle

- **SPEC-4.1.1** La recherche est déclenchée avec un debounce de `600 ms` (`SEARCH_DEBOUNCE_MS`) après la dernière frappe.
- **SPEC-4.1.2** Endpoint : `GET /api/search?term=${term}&artist=${artist}&limit=${limit}&nocache=${skipCache}`. Limite par défaut : `25`.
- **SPEC-4.1.3** Le texte est nettoyé via `cleanItunesSearchText()` (suppression feats, métadonnées) et séparé artiste/titre via `splitItunesSearchQuery()`.

### 4.2 Recherche synchrone

- **SPEC-4.2.1** `GET /api/search` répond de façon synchrone et complète (fusion iTunes+Deezer côté serveur) : il n'existe plus de mécanisme de polling (`/api/search/poll` et le champ `pollToken` ont été retirés de l'API). `searchTracksRaw()` retourne directement `{ tracks }`.
- **SPEC-4.2.2** L'API expose un paramètre `stream` (booléen, `text/event-stream`) pour recevoir des snapshots progressifs, mais il n'est pas consommé par le client actuellement — la recherche reste une requête `fetch()` classique bloquante.

### 4.3 Résultats

- **SPEC-4.3.1** Les résultats sont normalisés via `mapApiTrackToSearchItem()` : id, name, artist, duration, artUrl.
- **SPEC-4.3.2** Dédoublonnage par `id` ou clé `${name}|${artist}`.
- **SPEC-4.3.3** Tri par popularité via `sortSearchResultsByPopularity()`.
- **SPEC-4.3.4** Séparés en sections "Musiques" et "Artistes" dans l'UI.
- **SPEC-4.3.5** Badges affichés : `📁` (local), `🧩` (stems disponibles).
- **SPEC-4.3.6** Actions : "Fade" (play now avec crossfade), "+" (ajouter à la queue), `🗑` (supprimer local).
- **SPEC-4.3.7** GIVEN le bouton "+" cliqué sur un résultat de recherche — THEN `addToQueue(track, { asNext: true })` est appelé : la piste est insérée à `currentIndex + 1` (ou `0` si aucune piste ne joue), ce qui **concatène** — l'ancienne piste "suivante" est décalée d'un rang, pas remplacée (mêmes règles que SPEC-9.3.5). Le bouton "Fade" reste inchangé : il lance la lecture immédiate (`triggerSearchFade` → `addToQueue(track, { playNow: true })` si rien ne joue, sinon précharge la platine inactive et déclenche l'AutoMix).

### 4.4 Overlay de recherche

- **SPEC-4.4.1** `openSearch()` affiche l'overlay et le bouton fermer (`searchOverlay.hidden = false`, `searchClose.hidden = false`).
- **SPEC-4.4.2** `closeSearch()` masque l'overlay et le bouton fermer (`searchOverlay.hidden = true`, `searchClose.hidden = true`).
- **SPEC-4.4.3** `openSearch` et `closeSearch` sont définies dans `main.js` à partir des éléments DOM `searchOverlay` et `searchClose`.

---

## 5. Auto DJ (AutoMode)

### 5.1 Suggestions automatiques

- **SPEC-5.1.1** Endpoint principal : `GET /mix?track=${trackName}&artist=${artistName}`.
- **SPEC-5.1.2** GIVEN `data.status === 'already_pending'` — THEN retry jusqu'à `5` fois avec backoff exponentiel.
- **SPEC-5.1.3** La réponse `data.mix` est mise en cache en mémoire (max `40` entrées) et dans `localStorage` (`trackMetaStorage`).
- **SPEC-5.1.4** GIVEN une réponse 404 — THEN le cache pour ce morceau est invalidé.

### 5.2 Exclusion de morceaux

- **SPEC-5.2.1** Les morceaux déjà joués sont exclus via `playHistory` (Set persisté dans `localStorage`).
- **SPEC-5.2.2** Les morceaux dans la queue courante sont exclus par `queueIds` (Set de tous les IDs).
- **SPEC-5.2.3** Le morceau actuellement sur la platine active est exclu par fingerprint multi-champ : `id`, `ratingKey`, `uri`, ET `name+artist` normalisés (lowercase, trim). Ceci empêche les boucles infinies entre deux platines.
- **SPEC-5.2.4** GIVEN un morceau fini sur deck A et un morceau en cours sur deck B — WHEN l'Auto DJ cherche le prochain morceau — THEN le morceau de deck B ne peut pas être re-queueé (même si son ID est dans un format différent, le match par name+artist le bloque).
- **SPEC-5.2.5** `reset()` efface `currentlyPlayingTrack` pour éviter les fuites entre sessions.

### 5.3 Chaîne de recherche de morceaux

- **SPEC-5.3.1** Ordre de priorité :
  1. API `/api/suggestions` — résultats triés par `similarityScore`
  2. Fallback : `/suggestions`
  3. Fallback : recherche plain-text `searchTracksViaApi(query)` avec `query = artist + " " + name`
  4. Fil Rouge : `filRougeManager.getNextTrack()` si actif
  5. Aucun résultat : la lecture s'arrête après le morceau en cours
- **SPEC-5.3.2** GIVEN l'API est offline (`apiHealthMonitor.isOffline()`) — THEN les étapes 1–3 sont sautées, passage direct au Fil Rouge.
- **SPEC-5.3.3** GIVEN le Fil Rouge est actif — WHEN `searchAndAddNextTrack()` détermine quel morceau ajouter — THEN `peekNextTrackFromAny()` est appelé en premier pour vérifier si le prochain morceau est déjà dans la queue, AVANT d'appeler `getNextTrack()` (qui avance l'index). Si le morceau est déjà dans la queue, `getNextTrack()` n'est PAS appelé afin d'éviter de sauter un morceau.
- **SPEC-5.3.4** Paramètres envoyés à `/api/suggestions` : `track`, `artist`, `limit=25`, `allowSameArtist=false`, et `sameGenreOnly=true` UNIQUEMENT en mode `dance` (l'API ne supporte pas de filtres `minBpm`/`preferGenre`/`preferArtist`/`maxBpmJump`/`tracks`). Le tri par BPM (mode `dance`) et le boost genre/artiste (mode `music`) sont appliqués côté client sur les résultats retournés.
- **SPEC-5.3.5** GIVEN le mode `dance` et un BPM courant connu — THEN les résultats sont triés par `audioFeatures.bpm` décroissant (fallback `result.bpm` pour compatibilité). Les résultats sans BPM sont classés en dernier.

### 5.4 Analyse de forme d'onde (MixData)

- **SPEC-5.4.1** Structure MixData :
  ```
  {
    durationSec, probableSongStartSec,
    peakZones: [{ startSec, endSec, score, intensity }],
    safeTransitionZones: [{ startSec, endSec, score, reason }],
    avoidTransitionZones: [{ startSec, endSec, score, reason }],
    dropZones: [{ startSec, endSec, score }],
    breakdownZones: [{ startSec, endSec, score, reason }],
    neverMissZones: [{ startSec, endSec, neverMissScore, label, reason, source }],
    outroZones: [{ startSec, endSec }],
    confidence: { transitions: 0–1 },
    vocalPresenceProfile: [{ timeSec, value }],
    phraseGrid: [timeSec, ...]
  }
  ```
- **SPEC-5.4.2** Les zones sont utilisées comme suit :
  | Zone | Rôle | Blocage strict |
  |------|------|---------------|
  | `safeTransitionZones` | Points d'atterrissage optimaux pour transition | Non |
  | `breakdownZones` | Zones de basse énergie, bonnes pour sampling/scratching | Non (safe landing) |
  | `peakZones` (intensity "high") | Moments haute énergie | Oui |
  | `dropZones` | Kicks / impacts | Oui (toujours) |
  | `avoidTransitionZones` (reason high_tension/intro) | Moments problématiques | Oui |
  | `neverMissZones` | Chorus/hook/climax — ne jamais couper | Oui (toujours) |

### 5.5 findBestTransitionZone

- **SPEC-5.5.1** GIVEN un `targetSec` (ou `durationSec − 8` par défaut) — THEN :
  1. Agréger les zones bloquantes : `avoidTransitionZones` + `dropZones` + `neverMissZones` + `peakZones` (si intensity contient "high")
  2. Snapper sur `outroZones` si une zone est dans ±30s du target
  3. Boucle (max `20` itérations) : si `candidateSec` est dans une zone bloquante, avancer à `zoneEnd + 0.5s` ; sinon, vérifier si dans une safe/outro/breakdown zone
  4. Retourner `{ zone, type: 'safe'|'clear', triggerSec }` ou null si aucune zone trouvée

### 5.6 Timing du crossfade Auto DJ (scheduleAutomixTiming)

- **SPEC-5.6.1** GIVEN auto mode activé et un morceau en cours — WHEN `scheduleAutomixTiming(currentTrack)` est appelé — THEN :
  1. `currentlyPlayingTrack` est stocké synchroniquement (exclusion immédiate)
  2. Timer précédent annulé, mixData réinitialisé
  3. Fetch de `fetchMixData(name, artist)`
  4. `maxDurationSec` ajusté par `autoDjStartOffsetMs` : `rawMaxDurationSec + startOffsetMs/1000`
- **SPEC-5.6.2** GIVEN pas de mixData — THEN fallback : `triggerMs = max(durationMs − 20000, durationMs × 0.75)`. Si maxDuration défini : `triggerMs = min(maxDurationMs, triggerMs)`.
- **SPEC-5.6.3** GIVEN mixData avec confidence < `0.5` — THEN buffer de sécurité : `confidenceBufferMs = (1 − confidence) × 8000` (jusqu'à 8s d'avance pour confidence=0). Le trigger est avancé de ce buffer.
- **SPEC-5.6.4** GIVEN un trigger zone trouvée mais dépassant maxDurationMs — THEN le trigger est cappé puis `advancePastMaxDurationBlock()` le déplace hors des zones strictes (`zoneEnd + 500 ms`, cappé à `trackDurationMs − 10 s`).
- **SPEC-5.6.5** GIVEN aucune zone de transition trouvée et des zones problématiques existent — THEN fallback sur le gap avant la première zone problématique : `(firstZone.startSec − 2) × 1000`.

### 5.7 Déclenchement effectif

- **SPEC-5.7.1** GIVEN `automixTimeline.nextTriggerMs > 0` et la position atteint ce seuil — THEN `addPendingTrackToQueue()` est appelé, puis `autoMixBtn.click()`.
- **SPEC-5.7.2** GIVEN le track pending n'est pas disponible mais le Fil Rouge est actif — THEN `autoMixBtn.click()` est appelé quand même (le fallback Fil Rouge s'active).
- **SPEC-5.7.3** Le déclenchement est marqué une seule fois par morceau via `markAutomixTriggered(automixTimeline)`.

---

## 6. Auto FX (DJ FX automatiques)

### 6.0 Activation globale

- **SPEC-6.0.1** Le toggle global `enabled` de l'Auto DJ FX ("Robot FX") est **OFF par défaut** (`normalizeAutoDjFxSettings` sans `enabled` fourni). Les FX auto déclenchées pendant le mix (filter, echo, brake, backspin, etc.) rendaient le son insupportable en combinaison avec la transition reverb ; désactivées par défaut. L'utilisateur peut les réactiver via le bouton "AutoFX: OFF/ON".

### 6.1 Effets disponibles (16 types)

| # | Clé | Catégorie | Défaut |
|---|-----|-----------|--------|
| 1 | `filter` | filter | ON |
| 2 | `lowPass` | filter | ON |
| 3 | `highPass` | filter | ON |
| 4 | `echoDelay` | modulation | ON |
| 5 | `reverb` | modulation | **OFF** |
| 6 | `roll` | beat | ON |
| 7 | `loop` | beat | ON |
| 8 | `beatRepeat` | beat | ON |
| 9 | `brake` | transport | ON |
| 10 | `backspin` | transport | ON |
| 11 | `noise` | textural | ON |
| 12 | `eq` | filter | ON |
| 13 | `keyShift` | pitch | ON |
| 14 | `scratching` | scratch | ON |
| 15 | `hotCues` | cue | **OFF** |
| 16 | `sampling` | sample | ON |

### 6.2 Déclenchement (canTriggerAutoDjFx)

- **SPEC-6.2.1** Conditions vérifiées dans l'ordre :
  1. FX globalement activé → sinon `reason: 'disabled'`
  2. Type valide → sinon `reason: 'missing-type'`
  3. Type dans la allowlist utilisateur → sinon `reason: 'not-allowed'`
  4. Cooldown min-interval respecté (`elapsedMs ≥ minGapMs`) → sinon `reason: 'min-interval'`
- **SPEC-6.2.2** Bornes d'intervalle :
  - `minIntervalSec` : `1`–`180` s (défaut `14` s)
  - `maxIntervalSec` : `3`–`300` s (défaut `45` s)
  - Invariant : `minIntervalSec ≤ maxIntervalSec`

### 6.3 Intervalles par mode DJ

- **SPEC-6.3.1** Mode Dance : min `8` s, max `20` s.
- **SPEC-6.3.2** Mode Music, BPM < `90` : min `40` s, max `120` s.
- **SPEC-6.3.3** Mode Music, BPM ≥ `90` : min `20` s, max `60` s.

### 6.4 Planification (buildAutoFxPlan)

- **SPEC-6.4.1** Résolution de durée (cascade) : `currentTrack.duration` → `mixData.durationSec × 1000` → `maxDurationSec × 1000` → `triggerMs + 20000` → `45000`.
- **SPEC-6.4.2** Timeline effective : `effectiveEndMs = min(durationMs, maxDurationMs)`. Timeline max : `max(12000, effectiveEndMs − 5000)`.
- **SPEC-6.4.3** Ancrage de la transition : `triggerMs` snappé sur la grille de phrases la plus proche (fenêtre ±3.5s).
- **SPEC-6.4.4** Événements core ancrés sur les zones :
  - `keyShift` → safeTransitionZones, ou 45s avant transition
  - `sampling` → breakdownZones, ou 55s avant transition
  - `hotCues` → peakZones, ou 30s avant transition
  - `scratching` → post-breakdown (+7s), ou 12s avant transition
- **SPEC-6.4.5** Événements soft (ajoutés si `minGapMs ≤ 10s`) :
  - `echoDelay` → 2×minGapMs avant transition
  - `filter` → 1×minGapMs avant transition
  - `reverb` → 0.6×minGapMs avant transition

### 6.5 Gating NMZ et vocal

- **SPEC-6.5.1** GIVEN un événement FX tombe dans une neverMissZone — WHEN le type est `scratching`, `hotCues`, ou `sampling` (types "harsh") — THEN l'événement est annulé.
- **SPEC-6.5.2** GIVEN un événement de type vocal-sensible (`scratching`, `echoDelay`) tombe dans un moment haute-voix (`vocalPresenceProfile > 0.6`) — THEN l'événement est décalé vers un moment basse-voix dans une fenêtre de ±8s (seuil `0.45`).

### 6.6 Densité (enforceAutoFxDensity)

- **SPEC-6.6.1** Min-interval spacing : si deux événements sont espacés de moins de `minGapMs`, le moins prioritaire est supprimé (`AUTO_FX_PRIORITY`).
- **SPEC-6.6.2** Max-gap cadence fill : les gaps > `maxGapMs` sont comblés par des événements de cadence cycliques (`echoDelay → filter → reverb → repeat`).
- **SPEC-6.6.3** Tail window pruning : dans les 2 dernières minutes, max `2` événements conservés (les plus prioritaires).

### 6.7 Rendu sonore — `sampling` (triggerSamplingFx)

- **SPEC-6.7.1** L'effet `sampling` charge et joue un vrai enregistrement audio (MP3) depuis `resources/`, au lieu d'une synthèse WebAudio.
- **SPEC-6.7.2** Fichiers disponibles : `sample_airhorn.mp3`, `sample_stab.mp3`, `sample_laser.mp3`, `sample_siren.mp3` (vrais sons échantillonnés, cf. `resources/CREDITS.md` pour les sources et licences).
- **SPEC-6.7.3** À chaque déclenchement, un sample est choisi aléatoirement parmi les buffers chargés.
- **SPEC-6.7.4** Les buffers sont chargés en lazy-load via `loadSamplerSoundBuffers(ctx)` et mis en cache dans `runtime.samplerSoundBuffers`.
- **SPEC-6.7.5** Le playback rate est randomisé dans `[0.9, 1.1]` pour la variété.
- **SPEC-6.7.6** Fallback : si aucun sample n'est disponible (erreur réseau, format non supporté), un toast d'erreur est affiché.
- **SPEC-6.7.7** Chaque sample (`airhorn`, `stab`, `laser`, `siren`) peut être activé/désactivé individuellement dans la config (`resources/CREDITS.md` liste les sons ; `lib/samplerSoundsManager.js` gère les settings, persistés sous la clé `dj-mix:sampling:sounds:settings`). Tous activés par défaut.
- **SPEC-6.7.8** `triggerSamplingFx` ne pioche que parmi les samples chargés ET autorisés. Si tous les samples autorisés sont désactivés, un toast d'erreur "aucun sample autorise" est affiché sans jouer de son.
- **SPEC-6.7.9** Dans le menu "FX DJ (raccourcis)", le sampling manuel n'est plus un bouton unique tirant un son au hasard : un bouton dédié est affiché par sample (`samplingAirhorn`, `samplingStab`, `samplingLaser`, `samplingSiren`), chacun jouant systématiquement le sample correspondant via `triggerSamplingFx(soundId)`. Si le sample demandé n'est pas autorisé (cf. SPEC-6.7.7), un toast d'erreur dédié est affiché sans jouer de son.
- **SPEC-6.7.10** Le déclenchement automatique par l'AutoDJ (type `sampling`, cf. 6.1/6.4) conserve le tirage aléatoire parmi les samples autorisés (`triggerSamplingFx()` sans argument) ; seuls les boutons manuels du menu FX DJ sont désormais nommés par sample.

---

## 7. Effets DJ manuels (MixFeatures)

### 7.1 Stems (séparation mid-side)

- **SPEC-7.1.1** Encodage : `L = (L+R) × 0.5` (mid), `R = (L−R) × 0.5` (side).
- **SPEC-7.1.2** Gains adaptatifs calculés via `computeAdaptiveMidSideGains()` : plage `[0.1, 1]` par gain.
- **SPEC-7.1.3** Suppression vocale : réduit `midGain` (voix centrées). Suppression instrumentale : réduit `sideGain`.
- **SPEC-7.1.4** Lissage via `setTargetAtTime(target, now, SMOOTH_TAU=0.08)`. Intervalle de sync : `2500 ms` (`STEM_SYNC_INTERVAL_MS`).

### 7.2 Echo

- **SPEC-7.2.1** Delay : `0.22 s` (`ECHO_DELAY_S`). Feedback : `0.28` (`ECHO_FEEDBACK`).
- **SPEC-7.2.2** Mix wet : `0.28` (`ECHO_WET_MIX`). Mix dry : `0.9` (`ECHO_DRY_MIX`).
- **SPEC-7.2.3** Source optionnelle : stems vocaux via `providedStems.vocalsUrl`.
- **SPEC-7.2.4** Playback rate et currentTime synchronisés avec l'audio principal.

### 7.3 Distortion

- **SPEC-7.3.1** WaveShaper avec lookup table de `44100` samples. Paramètre K : `140` (`DISTORTION_K`).
- **SPEC-7.3.2** Oversample : `4x`. Mix wet : `0.36`, dry : `0.84`.

### 7.4 Filter automation

- **SPEC-7.4.1** Low-pass : fréquence `1400 Hz`, Q `0.85`.
- **SPEC-7.4.2** High-pass : fréquence `280 Hz`, Q `0.8`.
- **SPEC-7.4.3** Défaut : AllPass (no-op). Lissage via `setParamSmooth()`.

### 7.5 Analyse audio

- **SPEC-7.5.1** FFT taille `1024` (`FFT_SIZE`).
- **SPEC-7.5.2** Énergie : RMS = `sqrt(sum(sample²) / length)`. Epsilon : `1e-4` (`ENERGY_EPSILON`).
- **SPEC-7.5.3** Lissage JS-side : lerp α = `0.34` (`SMOOTH_JS`).

---

## 8. DJ Plan

### 8.1 Endpoints API

| Endpoint | Méthode | Rôle |
|----------|---------|------|
| `/api/dj/tracks/scan` | POST → poll | Récupérer les résumés de morceaux |
| `/api/dj/tracks/detail` | GET | Analyse détaillée d'un morceau |
| `/api/dj/transition` | POST | Calculer la transition A→B |
| `/api/dj/batch` | POST → poll | Plan complet (tous les morceaux + score du set) |
| `/api/dj/feedback` | POST | Soumettre un feedback de transition |
| `/api/dj/iconic` | POST | Marquer un morceau comme iconique |
| `/api/dj/set-profiles` | GET | Lister les profils de set disponibles |
| `/api/dj/retrain` | POST | Relancer l'entraînement du moteur |
| `/api/dj/weights` | GET | Récupérer les poids du moteur |

### 8.2 Profils de set

- **SPEC-8.2.1** Stocké dans `localStorage` sous la clé `dj-mix:dj-api:set-profile`. Défaut : `'club_peak'`.

### 8.3 Résolution de morceaux

- **SPEC-8.3.1** Ordre de matching : cachePath exact → cachePath basename → ratingKey → nom+artiste normalisés (insensible accents/casse).
- **SPEC-8.3.2** Retourne `{ trackId, hasFullAnalysis }` ou `null`.
- **SPEC-8.3.3** Les analyses sont cachées dans `localStorage` sous clé `dj-mix:track-meta:${artist}::${track}` (normalisé lowercase).

### 8.4 Indicateurs visuels

- **SPEC-8.4.1** GIVEN un DJ Plan avec `crossfadeDurationSec > 0` — THEN un marqueur `.dj-plan-marker` est affiché sur la timeline.
- **SPEC-8.4.2** Titre du marqueur : `"DJ Plan: crossfade ${seconds}s${transitionLabel} · score ${scorePct}%${nextName}"`.
- **SPEC-8.4.3** L'encart DJ Plan (`#dj-plan-section`) est affiché dans l'onglet mix/file d'attente (`#tab-mix`), sous les decks, juste avant la file d'attente.
- **SPEC-8.4.4** `#dj-plan-section` contient : l'indicateur `#dj-plan-indicator` (état de la transition courante) et le bouton `#dj-recalculate-btn` (Recalculer). Le tout est masqué (`hidden`) quand le DJ Plan est désactivé.

### 8.5 Recalcul de transition (bouton Recalculer)

- **SPEC-8.5.1** `planCurrentToNextTransition(item, {force})` retourne `{ok: boolean, reason?: string}` indiquant si la transition a été calculée.
- **SPEC-8.5.2** Raisons d'échec possibles : `'no-context'`, `'not-in-playlist'`, `'last-track'`, `'unresolved-tracks'`, `'missing-analysis'`, `'api-error'`.
- **SPEC-8.5.3** GIVEN `force=true` — WHEN `djHasAnalysis` est `false` pour un ou les deux morceaux — THEN la contrainte `djHasAnalysis` est ignorée et l'appel API `/api/dj/transition` est tenté quand même.
- **SPEC-8.5.4** GIVEN `force=true` ET `djTrackId` est `null` après résolution — THEN un re-scan des track summaries est forcé (`ensureTrackSummaries({force:true})`) avant un second essai de résolution.
- **SPEC-8.5.5** GIVEN le bouton Recalculer cliqué — WHEN le calcul échoue — THEN un toast d'erreur spécifique à la raison est affiché (et non un toast de succès trompeur).
- **SPEC-8.5.6** Le morceau de référence pour le calcul (bouton Recalculer et passe initiale `runDjPlanFullPass`) est déterminé en priorité par `uiState.currentTrackId` (chanson en cours de lecture), avec repli sur `filRougeManager.getCurrentIndex()` si aucun morceau n'est en cours. Cela garantit que la transition calculée est toujours celle du morceau joué vers le suivant, même si l'index fil rouge a déjà avancé lors du préchargement.
- **SPEC-8.5.7** Les champs `trackA` et `trackB` envoyés dans le body du POST `/api/dj/transition` sont les filenames complets incluant l'extension `.mp3` (ex : `"Outkast - Hey Ya!.mp3"`), conformément au swagger backend. `djApiClient.fetchTransition` les transmet tels quels sans modification.

### 8.6 Calcul des transitions à la volée (une par une, 10 en avance)

- **SPEC-8.6.1** GIVEN au moins un morceau du fil rouge est à l'état `downloading` (téléchargement de masse en cours : démarrage, import Spotify/TXT, "Tout télécharger") — THEN `computeSetQuality()` retourne `null` immédiatement sans appeler `/api/dj/tracks` ni `/api/dj/transition`, pour éviter de calculer des transitions sur un fil rouge dont les fichiers ne sont pas encore tous en cache.
- **SPEC-8.6.2** GIVEN un téléchargement de masse vient de se terminer (succès ou échec) — THEN `scheduleDjSetQualityRefresh()` est appelé pour redéclencher le calcul des transitions différé par SPEC-8.6.1.
- **SPEC-8.6.3** `computeSetQuality()` planifie les transitions des paires consécutives du fil rouge via `/api/dj/transition` (une requête par paire), en commençant à l'index courant (`filRougeManager.getCurrentIndex()`). L'endpoint `/api/dj/batch` n'est plus utilisé pour les transitions.
- **SPEC-8.6.4** `computeSetQuality()` et `planAllEdges()` ne planifient au maximum que `MAX_LOOKAHEAD_TRANSITIONS` (10) transitions en avance depuis l'index courant. Les paires au-delà de ce seuil sont ignorées jusqu'au prochain appel.
- **SPEC-8.6.5** Quand `currentIndex` est `-1` (lecture non démarrée), le calcul commence à l'index `0`.
- **SPEC-8.6.6** `computeSetQuality()` retourne toujours `null` (plus de `globalSetScore` issu du batch).
- **SPEC-8.6.7** GIVEN un morceau commence à jouer (`startPlaybackForIndex` s'est exécuté avec succès) — THEN le callback `onTrackStarted` est déclenché, ce qui appelle `scheduleDjSetQualityRefresh()` et garantit que les transitions des au moins `MIN_UPCOMING_TRANSITIONS_GUARANTEE` = 3 prochains morceaux du fil rouge sont calculées et persistées. `computeSetQuality()` calculant jusqu'à `MAX_LOOKAHEAD_TRANSITIONS` (10) transitions depuis l'index courant avec mémoïsation, cette garantie est toujours satisfaite si les morceaux sont résolus et analysés côté serveur.

### 8.7 Déclenchement automix sur `mixOutSec`

- **SPEC-8.7.1** GIVEN `djExternalPlanEnabled` est `true` ET le morceau en cours (`queue[uiState.currentIndex]`) correspond à un item du fil rouge dont `djTransition.mixOutSec > 0` — WHEN la position de lecture (`currentTime`) atteint `mixOutSec` — THEN l'automix est déclenché immédiatement (`autoMixBtn.click()`), **indépendamment de l'état du mode AutoDJ** (ON ou OFF).
- **SPEC-8.7.2** Ce déclenchement est protégé par un flag par-morceau (`djPlanMixOutTriggeredForTrack`) réinitialisé à chaque nouvelle lecture, pour éviter un double déclenchement.
- **SPEC-8.7.3** GIVEN le mode AutoDJ est activé — WHEN le seuil `mixOutSec` est atteint — THEN `markAutomixTriggered(automixTimeline)` est aussi appelé pour empêcher que la vérification AutoDJ standard (`shouldTriggerAutomix`) ne déclenche un second automix sur le même tick.
- **SPEC-8.7.4** Ce mécanisme est indépendant de la contrainte de durée max (`trackMaxDurationEnabled`), qui reste vérifiée séparément ; le premier seuil atteint chronologiquement déclenche l'automix.
- **SPEC-8.7.5** GIVEN `djExternalPlanEnabled` est `true` ET le prochain item du fil rouge n'a pas (encore) de suggestion API (`getDjTransitionPlan` retourne `null` — suggestion non reçue ou calcul en cours) ET `trackMaxDurationAppliedSec > 0` — THEN : (a) lors du calcul du timing automix (`onAutomixTimingCalculated`), `finalTriggerMs` est remplacé par `trackMaxDurationAppliedSec × 1000` ; (b) en cours de lecture, si la position atteint `trackMaxDurationAppliedSec × 1000 + autoDjStartOffsetMs` et que le marqueur durée max (`maxDurMarkerTriggeredForTrack`) n'a pas encore tiré, l'automix est déclenché via le bloc DJ Plan (avec `markAutomixTriggered`).

---

## 9. Mode Relais (Master / Relay)

### 9.1 Session

- **SPEC-9.1.1** Création : `POST /api/relay/session` (body JSON vide) → retourne `{ sessionId }`.
- **SPEC-9.1.2** Persisté dans `localStorage` sous `dj-mix:relay:session-id`.
- **SPEC-9.1.3** Partage par QR code (librairie qrcodejs, 200×200, correction M) ou URL.
- **SPEC-9.1.4** Format URL : `${origin}${dir}relay?relay-session=${sessionId}&relay-api=${apiUrl}&relay-token=${apiToken}`.

### 9.2 Mode Maître

- **SPEC-9.2.1** État diffusé :
  ```
  {
    sessionId, pushedAt,
    currentTrackId, currentIndex, isPlaying, activeDeck,
    deckA: { trackId, positionMs, volume },
    deckB: { trackId, positionMs, volume },
    queue: [{ id, name, artist, artUrl, duration, persistedSourceUrl, bpm, genre }],
    filRouge: [{ id, name, artist, artUrl, duration, persistedSourceUrl }],
    transitionMode, crossfadeMs, djMode
  }
  ```
- **SPEC-9.2.2** Endpoint : `PUT /api/relay/state/:id`.
- **SPEC-9.2.3** Debounce : `1000 ms` (`PUSH_DEBOUNCE_MS`).
- **SPEC-9.2.4** Déduplication par hash : `_hashState()` exclut `positionMs` pour éviter le spam. Inclut : currentTrackId, currentIndex, isPlaying, activeDeck, transitionMode, crossfadeMs, djMode, queue IDs, FX echo/distortion.

### 9.3 Mode Relais

- **SPEC-9.3.1** Polling : `GET /api/relay/state/:id` toutes les `1500 ms` (`POLL_MS`). Premier poll immédiat.
- **SPEC-9.3.2** GIVEN un nouvel état reçu — THEN `onApplyRelayState(state)` est appelé pour synchroniser morceau, position, paramètres.
- **SPEC-9.3.3** GIVEN de nouveaux items dans queue/filRouge — THEN `onRelayQueueItemsAvailable(items)` déclenche le pré-téléchargement.
- **SPEC-9.3.3.1** GIVEN un morceau présent à la fois dans `queue` et `filRouge` de l'état relais reçu (trackStore partagé côté maître, cf. SPEC-2.6.1) — WHEN les items sont transmis à `onRelayQueueItemsAvailable` — THEN il n'est signalé qu'une seule fois (déduplication par `id`), évitant un double pré-téléchargement côté relais.
- **SPEC-9.3.4** Polling de commandes : toutes les `2500 ms`, âge max `60 000 ms`.
- **SPEC-9.3.5** GIVEN une commande `addToQueue` reçue du relais (boutons « Lire maintenant » / « Ajouter en suivant ») — THEN elle est déléguée à la file "incoming" (`relayIncomingQueue`, cf. §9.4) plutôt que traitée immédiatement : la piste n'est insérée dans la file d'attente qu'une fois téléchargée.
- **SPEC-9.3.6** GIVEN la page relais est chargée et que l'utilisateur a appuyé pour initialiser l'AudioContext — THEN : (a) le polling de métadonnées démarre immédiatement (titre en cours, pré-téléchargements) ; (b) le flux **audio** n'est PAS démarré ; (c) le bouton `▶ Lancer le flux` est affiché (`isActive() === false`).
- **SPEC-9.3.7** GIVEN le bouton `▶ Lancer le flux` est cliqué — WHEN `isActive()` est `false` — THEN `_lastHash` est réinitialisé pour forcer la ré-application de l'état, la boucle de dérive est lancée, l'audio suit l'état maître dès le prochain tick de polling, et le bouton passe à `⏹ Arrêter le flux`.
- **SPEC-9.3.8** GIVEN le bouton `⏹ Arrêter le flux` est cliqué — WHEN `isActive()` est `true` — THEN l'audio est mis en pause (`_pauseAll`), le suivi de position s'arrête, la boucle de dérive s'arrête ; le polling continue (le titre reste à jour) et le bouton repasse à `▶ Lancer le flux`.

### 9.4 File "incoming" (Lire maintenant / Ajouter en suivant)

Une commande `addToQueue` reçue du relais léger ne doit pas apparaître dans la file d'attente
avant d'avoir été téléchargée. `lib/relayIncomingQueue.js` (`createRelayIncomingQueue`) gère ce
staging côté maître, câblé dans `main.js` en lieu et place de l'ancien traitement synchrone
(`onRelayCommand`).

- **SPEC-9.4.1** « Lire maintenant » (`cmd.playNow === true`) dispose d'un slot unique. GIVEN le
  slot déjà occupé — WHEN une nouvelle commande « Lire maintenant » arrive — THEN elle est
  ignorée (log uniquement, aucune commande envoyée en retour au relais).
- **SPEC-9.4.2** « Ajouter en suivant » dispose de `10` slots (`RELAY_INCOMING_NEXT_MAX_SLOTS`).
  GIVEN les `10` slots déjà occupés — WHEN une 11e commande arrive — THEN elle est ignorée (log
  uniquement).
- **SPEC-9.4.3** GIVEN une commande acceptée (slot libre) — THEN `prefetchTrackToLocalCache(cmd.track)`
  est lancé en arrière-plan ; la piste n'est ajoutée à la file d'attente (`addToQueue`) qu'une
  fois ce téléchargement résolu avec succès. Un échec (`onError` ou résultat `false`) libère le
  slot silencieusement — la piste n'apparaît jamais dans la file, aucun toast d'erreur.
- **SPEC-9.4.4** GIVEN plusieurs slots « Ajouter en suivant » soumis dans un ordre donné — WHEN
  leurs téléchargements se terminent dans un ordre différent — THEN l'insertion dans la file
  respecte strictement l'ordre de soumission (FIFO) : le 1er slot soumis atterrit juste après la
  piste en cours, le 2e juste après lui, etc. Un slot prêt mais pas encore en tête de la file
  interne reste en attente (non committé) jusqu'à ce que tous les slots précédents aient été
  committés ou aient échoué.
- **SPEC-9.4.5** Implémentation du FIFO : `addToQueue()` accepte un paramètre optionnel
  `insertOffset` (défaut `0`, aucun changement pour les autres appelants) utilisé uniquement
  dans la branche `asNext` : insertion à `currentIndex + 1 + insertOffset` au lieu de
  `currentIndex + 1`. `relayIncomingQueue` maintient un compteur incrémenté à chaque commit,
  remis à `0` dès que `currentIndex` change depuis le dernier commit.
- **SPEC-9.4.6** GIVEN un slot « Lire maintenant » téléchargé avec succès — THEN le slot est
  libéré puis `triggerSearchFade(cmd.track)` est appelé (insertion + cue sur la platine inactive
  + déclenchement automix immédiat, comportement identique à SPEC-4.3.7). « Lire maintenant »
  est toujours prioritaire : il s'insère devant les morceaux « Ajouter en suivant » déjà commités.
- **SPEC-9.4.7** L'état diffusé par `buildRelayStateSnapshot()` inclut `relayIncoming: { nowPending, nextCount, nextMax }`.
  Ces 3 champs doivent être inclus dans les 3 hash de dédoublonnage existants (`_hashState()` dans
  `lib/relayModeManager.js`, utilisé par le maître ET le relais applicatif complet, ET `_stateHash()`
  local à `relay.js`) — sinon un changement de ces seuls champs ne se propage pas (piège déjà
  rencontré, cf. mémoire de session).
- **SPEC-9.4.8** GIVEN le relais léger (`relay.js`) — WHEN une piste est sélectionnée (action
  sheet) — THEN tant qu'aucune réponse fiable du maître n'a été reçue (`_relayIncomingKnown === false`),
  les boutons « Lire maintenant » et « Ajouter en suivant » restent masqués et un message
  « En attente du maître… » (`#relay-action-waiting`) est affiché à la place.
- **SPEC-9.4.9** GIVEN une info fiable reçue — THEN « Lire maintenant » est masqué si
  `relayIncoming.nowPending === true` ; « Ajouter en suivant » est désactivé (libellé « File
  pleine (N/10) ») si `relayIncoming.nextCount >= relayIncoming.nextMax`.
- **SPEC-9.4.10** GIVEN une info déjà connue (`_relayIncomingKnown === true`) — WHEN le maître
  devient injoignable — THEN l'affichage précédent est conservé (pas de flicker) jusqu'à
  `3` échecs de poll consécutifs (`RELAY_MASTER_STALE_AFTER`, ~4.5 s à 1500 ms/poll) ; au-delà,
  retour à l'affichage « En attente du maître… ».

---

## 10. Intégration Spotify

### 10.1 Authentification

- **SPEC-10.1.1** OAuth 2.0 Authorization Code Flow avec PKCE.
- **SPEC-10.1.2** Verifier : `64` bytes aléatoires encodés en base64url (`86` chars).
- **SPEC-10.1.3** Code challenge : SHA-256 via `crypto.subtle.digest('SHA-256')` (fallback JS custom). Méthode : `S256`.
- **SPEC-10.1.4** State : `16` bytes aléatoires en base64url (`22` chars). Vérifié au retour.
- **SPEC-10.1.5** Verifier et state stockés dans `sessionStorage` (pas localStorage).

### 10.2 Token

- **SPEC-10.2.1** Stocké dans `localStorage` sous `dj-mix:spotify:auth` : `{ accessToken, refreshToken, expiresAt, tokenType, scope, state }`.
- **SPEC-10.2.2** Refresh déclenché si `(expiresAt − 60000) ≤ Date.now()` (skew de 1 minute).
- **SPEC-10.2.3** Endpoint refresh : `POST /oauth/token` avec `grant_type='refresh_token'`.
- **SPEC-10.2.4** `clearAuth()` supprime l'auth ET la source Fil Rouge.

### 10.3 Fonctionnalités

- **SPEC-10.3.1** Playlists : `GET /me/playlists?fields=items(id,name),next&limit=50` avec pagination.
- **SPEC-10.3.2** Tracks playlist : `GET /playlists/{id}/items?fields=...&limit=100` avec pagination.
- **SPEC-10.3.3** Retry : max `2` retries (`SPOTIFY_FETCH_MAX_RETRIES`). Backoff exponentiel (base `1000 ms`, cap `30 000 ms`, jitter). Status retry : `429`, `502`, `503`, `504`. Header `Retry-After` respecté.
- **SPEC-10.3.4** Historique de playlists : max `20` entrées (`playlistHistoryMax`).

---

## 11. Gestion des sources audio

### 11.1 Résolution d'URL

- **SPEC-11.1.1** Cascade de candidats (premier valide gagne) :
  1. `persistedSourceUrl`
  2. `localBlobUrl`
  3. `downloadUrl`
  4. `streamUrl`
  5. `fileUrl`
  6. `audioUrl`
  7. `url`
  8. `uri`
- **SPEC-11.1.2** Un candidat est valide si : URL `blob:` OU URL HTTP(S) de confiance.
- **SPEC-11.1.3** Validation de confiance (`isTrustedLocalAudioUrl`) : même origine que l'app OU origine de l'API downloader avec path `/api/cache/`.

### 11.2 Téléchargement

- **SPEC-11.2.0** GIVEN `item.cachePath` déjà connu (piste déjà téléchargée dans une session précédente, ou listée depuis l'index de cache local) — THEN `POST /api/download` (étape 1, API principale) n'est **jamais appelé** : le téléchargement va directement à l'étape 2 (streaming CDN via `cachePath`). Seule une piste dont le `cachePath` est encore inconnu déclenche l'orchestration sur l'API principale.
- **SPEC-11.2.1** Étape 1 (orchestration, uniquement si `cachePath` inconnu) : `POST /api/download` avec body `{ trackName, artistName, searchQuery, popularity }`, sur l'API principale (`getDownloaderApiUrl`). Ne renvoie jamais d'octets audio — toujours du JSON contenant `cachePath` (+ métadonnées de la piste).
- **SPEC-11.2.2** GIVEN la réponse JSON de l'étape 1 sans champ `cachePath` — THEN une erreur est levée (`Réponse API sans cachePath`), sans tenter d'étape 2.
- **SPEC-11.2.3** Étape 2 (octets) : `GET /api/stream?cachePath=<cachePath>` sur le serveur CDN audio indépendant (`getDownloaderCdnUrl`, process séparé `audioCdnServer.js`, port par défaut `3002`), qui reste joignable même si l'API principale est occupée par une tâche longue. Le blob résultant est converti en `blob:` URL via `URL.createObjectURL(blob)`.
- **SPEC-11.2.4** `getDownloaderCdnUrl` : si l'utilisateur a configuré une URL CDN explicite (`localStorage`, clé `dj-mix:downloader:cdn:url`), elle est utilisée telle quelle ; sinon elle est dérivée automatiquement de l'URL de l'API en remplaçant le port par `3002` (même host).
- **SPEC-11.2.5** Le téléchargement d'un stem (`GET /api/stems/download?stem=...`) cible le CDN quand `item.cachePath` est connu (le CDN ne supporte pas la résolution par nom) ; sinon il retombe sur l'API principale, qui supporte encore la résolution par `trackName`/`artistName`.
- **SPEC-11.2.6** GIVEN un téléchargement résolu via l'étape 1 (orchestration) — WHEN la réponse contient un `cachePath` — THEN `item.cachePath` est mis à jour sur l'item (queue ou prefetch) avant de poursuivre, afin qu'un futur appel pour le même item bénéficie du raccourci SPEC-11.2.0 sans repasser par l'API principale.
- **SPEC-11.2.7** GIVEN `item.cachePath` inconnu — THEN avant l'étape 1 (orchestration), l'item est recherché dans la DB locale de paths (`trackPathDb`, cf. §11.5) via sa cache key (`id`, sinon `artist::name`, avec repli identique à SPEC-11.1.x) — si une correspondance existe, l'étape 1 est court-circuitée exactement comme SPEC-11.2.0 (streaming CDN direct), sans aucun appel réseau vers l'API principale.
- **SPEC-11.2.8** GIVEN l'étape 1 (orchestration) résout un `cachePath` — THEN, en plus de la mise à jour de l'item (SPEC-11.2.6), la DB locale de paths est mise à jour (`trackPathDb.set(cacheKey, cachePath)`), pour que le raccourci SPEC-11.2.7 s'applique dès le prochain morceau partageant la même clé — y compris après un rechargement de page ou dans une autre session du navigateur.

### 11.3 Cache

- **SPEC-11.3.1** Cache persistant : clé `https://dj-mix.local/cache-audio/${encodeURIComponent(cacheKey)}` dans `caches.open(audioCacheName)`.
- **SPEC-11.3.2** Cache session (in-memory Map) : max `12` entrées (`MAX_SESSION_BLOB_CACHE_ENTRIES`). Éviction FIFO.
- **SPEC-11.3.3** `releaseLocalBlob()` appelle `URL.revokeObjectURL()` sur les blob URLs (y compris stems).
- **SPEC-11.3.4** Clé de cache unifiée : `addToQueue` utilise `getTrackCacheKey(track)` comme `id` de l'item queue, garantissant la même clé que le fil rouge pour le cache persistant et session. Résolution : `track.id` → sinon `artist::name` (lowercased). En défense supplémentaire, `ensureLocalSource` et `isTrackInLocalCache` tentent aussi la clé `artist::name` en fallback si la clé primaire ne matche pas.

### 11.4 Garbage collector mémoire

- **SPEC-11.4.1** Activé uniquement en mode low-memory : mobile ET RAM ≤ `3072` Mo (`LOW_MEMORY_PLAYBACK_MAX_RAM_MB`).
- **SPEC-11.4.2** `trimRetainedAudioSources()` conserve uniquement : item deck A, item deck B, item preview. Tous les autres items de la queue sont évictés.
- **SPEC-11.4.3** Déclenché : après chaque lancement de morceau, après chaque crossfade, lors d'un changement de config RAM.

### 11.5 DB locale de paths (trackPathDb)

- **SPEC-11.5.1** `lib/trackPathDb.js` expose une map clé → `cachePath` minimaliste (aucune autre métadonnée : pas d'artwork, `audioFeatures`, `mixSuggestions`, etc.), persistée dans `localStorage` sous la clé `dj-mix:track-paths` (`STORAGE_KEYS.trackPaths`), avec écriture debounced à `400 ms`.
- **SPEC-11.5.2** Clé = `id` du morceau serveur si présent, sinon `artistName::trackName` normalisé (minuscule, trim) — même convention que `getTrackCacheKey` (SPEC-11.3.4).
- **SPEC-11.5.3** ~~Au démarrage de l'application, `audioSourceManager.syncTrackPathDbFromCacheIndex()` paginait `GET /api/cache/files` pour pré-remplir la DB locale avec l'intégralité des titres et chemins connus du serveur.~~ (Supprimé : fonctionnalité de synchro en masse retirée — la DB locale de paths ne se remplit plus qu'au fil de l'eau, morceau par morceau, via SPEC-11.2.8.)
- **SPEC-11.5.4** GIVEN un morceau absent à la fois de `item.cachePath` et de la DB locale de paths — THEN la résolution retombe sur l'étape 1 d'orchestration (`POST /api/download`, SPEC-11.2.1), qui interroge le serveur (cache index, dossier local, ou téléchargement YouTube) ; le `cachePath` résolu met à jour la DB locale au passage (SPEC-11.2.8) pour les résolutions futures, y compris pour d'autres morceaux partageant la même clé.

---

## 12. Paramètres (Settings)

### 12.1 Persistance

- **SPEC-12.1.1** Tous les paramètres sont stockés dans `localStorage`. Les clés sont centralisées dans `STORAGE_KEYS` (objet gelé, `Object.freeze`).

### 12.2 Clés de stockage

| Clé | Valeur localStorage |
|-----|---------------------|
| queue | `dj-mix:queue` |
| filRouge | `dj-mix:fil-rouge` |
| tracks | `dj-mix:tracks` |
| crossfadeSeconds | `dj-mix:crossfade-seconds` |
| mixTransitionMode | `dj-mix:transition:mode` |
| trackMaxDuration | `dj-mix:track:max-duration` |
| trackMaxDurationEnabled | `dj-mix:track:max-duration:enabled` |
| trackMaxDurationMode | `dj-mix:track:max-duration:mode` |
| trackMaxDurationPct | `dj-mix:track:max-duration:pct` |
| ramFilterEnabled | `dj-mix:ram-filter:enabled` |
| ramTotalMbOverride | `dj-mix:ram-filter:total-mb-override` |
| autoDjFxSettings | `dj-mix:auto-dj:fx:settings` |
| samplerSoundsSettings | `dj-mix:sampling:sounds:settings` |
| autoSuggestionQueueSearchEnabled | `dj-mix:auto-dj:suggestion-queue-search:enabled` |
| queueLoop | `dj-mix:queue:loop` |
| queueShuffle | `dj-mix:queue:shuffle` |
| djMode | `dj-mix:dj-mode` |
| djModeGenrePrefs | `dj-mix:dj-mode:genre-prefs` |
| spotifyClientId | `dj-mix:spotify:client-id` |
| spotifyAuth | `dj-mix:spotify:auth` |
| spotifyFilRougeSource | `dj-mix:spotify:fil-rouge-source` |
| spotifyPlaylistHistory | `dj-mix:spotify:playlist-history` |
| djSetProfile | `dj-mix:dj-api:set-profile` |
| djExternalPlanEnabled | `dj-mix:dj-plan:external-enabled` |
| djBatchPlan | `dj-mix:dj-api:batch-plan` |
| artworkUrls | `dj-mix:artwork-urls` |
| relayMode | `dj-mix:relay:mode` |
| relaySessionId | `dj-mix:relay:session-id` |
| downloaderApiUrl | `dj-mix:downloader:api:url` |
| downloaderApiToken | `dj-mix:downloader:api:token` |
| fxVisibility | `dj-mix:fx:hidden` |
| debugLogs | `dj-mix:logs:debug` |
| globalVolume | `dj-mix:global-volume` |

### 12.3 Paramètres avec bornes et défauts

| Paramètre | Défaut | Min | Max |
|-----------|--------|-----|-----|
| Crossfade (s) | 6 | 1 | 30 |
| Track Max Duration (s) | 0 | 0 | 600 |
| Track Max Duration (%) | 50 | 5 | 95 |
| RAM Override (Mo) | 0 | 512 | 32 768 |
| Auto FX min interval (s) | 14 | 1 | 180 |
| Auto FX max interval (s) | 45 | 3 | 300 |
| Transition mode | `auto` | — | — |
| DJ Mode | `music` | — | — |
| DJ Set Profile | `club_peak` | — | — |
| Downloader API URL | `http://192.168.8.149:3000` | — | — |
| Volume global | 1.0 | 0.0 | 1.0 |

### 12.4 Vider le cache local

- **SPEC-12.4.1** `clearLocalCache()` (`lib/settingsController.js`) est appelée par le bouton `#clear-cache-btn`. GIVEN la Cache Storage API disponible (`'caches' in window`) — THEN le cache `AUDIO_CACHE_NAME` est supprimé via `caches.delete()`, le cache mémoire (`sessionBlobCache`) est vidé, et le toast `Cache local vidé` est affiché.
- **SPEC-12.4.2** GIVEN la Cache Storage API absente de `window` (contexte non sécurisé : accès à l'app via IP LAN — `192.168.x.x`/`10.x.x.x` — en HTTP plutôt que via `localhost`/`127.0.0.1`/HTTPS) — THEN `clearLocalCache()` ne bloque pas sur une erreur : le cache mémoire est vidé quand même, et un toast informatif `Cache mémoire vidé — Cache API indisponible (connexion non sécurisée : utilisez localhost ou HTTPS)` est affiché (sans style d'erreur).
- **SPEC-12.4.3** GIVEN la Cache Storage API absente alors que le contexte est déjà sécurisé (`isSecureContext === true`, navigateur/plateforme sans support) — THEN le toast n'inclut pas la précision « connexion non sécurisée ».
- **SPEC-12.4.4** GIVEN une erreur levée pendant `caches.delete()` — THEN un toast d'erreur `Erreur suppression cache: <message>` est affiché.

---

## 13. PWA et intégration mobile

### 13.1 Service Worker

- **SPEC-13.1.1** Cache nommé `djmix-v{version}`. 56+ fichiers cachés (main.js, style.css, tous les lib/*.js).
- **SPEC-13.1.2** Exclusions : requêtes cross-origin, requêtes `/api/`, requêtes Spotify/CDN.
- **SPEC-13.1.3** Navigation : les query params sont strippés pour permettre les paramètres relay.
- **SPEC-13.1.4** Cache audio séparé : `dj-mix:audio-cache:v1`. Clé : `https://dj-mix.local/cache-audio/${safeKey}`.
- **SPEC-13.1.5** Notifications : notification du nombre de succès/échecs en fin de téléchargement.

### 13.2 Installation

- **SPEC-13.2.1** Installable via prompt Chrome/Edge (manifest PWA).
- **SPEC-13.2.2** Packaging APK via Capacitor.

### 13.3 Media Session API

- **SPEC-13.3.1** Métadonnées exposées : `title`, `artist`, `album` (défaut "DJ Mix"), `artwork` (tableau `[{ src, sizes, type }]`).
- **SPEC-13.3.2** GIVEN une artwork avec n'importe quelle URL (`blob:`, `https://` CDN ou serveur API local) — THEN elle est téléchargée dans le renderer et convertie en data URI via `_fetchArtworkDataUri` avant d'être assignée à `navigator.mediaSession.metadata.artwork`, pour garantir que la notification système peut toujours afficher la jaquette quel que soit le contexte réseau ou le type d'URL.
- **SPEC-13.3.3** Actions enregistrées :
  - `play` → resume deck ou lancement si pas de source
  - `pause` → pause deck
  - `seekto` → `player.seekTo(seekTime × 1000)`
  - `nexttrack` → `autoMixBtn.click()`
- **SPEC-13.3.4** Position mise à jour : à chaque événement progress (~300ms) + toutes les `30 s` via keepalive timer.
- **SPEC-13.3.5** GIVEN un préchargement d'artwork sur le deck inactif (morceau suivant, ghost fil rouge, launch preview) — THEN `fetchAndStoreArtworkForItem` est appelé avec `{ skipNotification: true }` de sorte que `navigator.mediaSession.metadata` n'est pas modifié ; la notification système conserve les métadonnées de la piste réellement audible. Note : `updateNowPlaying` lui-même ne filtre pas sur le deck car lors d'un crossfade le deck entrant est encore inactif au moment où la notification est mise à jour.
- **SPEC-13.3.6** GIVEN `navigator.mediaDevices` disponible — WHEN un événement `devicechange` est émis — THEN le nombre de sorties audio (`kind === 'audiooutput'`, via `enumerateDevices()`) est recompté et comparé au compte précédent : si ET SEULEMENT SI ce compte a diminué (perte réelle d'une sortie, ex. déconnexion casque Bluetooth) ET que le deck focus est en lecture (`deckState.playing === true`), `player.pauseDeck(focusDeck)` est appelé. Un `devicechange` qui n'enlève aucune sortie (ajout d'un périphérique, bruit d'énumération côté OS/Android Auto) est ignoré sans action.
- **SPEC-13.3.7** GIVEN une artwork dont l'URL provient du CDN Apple (`mzstatic.com`) — WHEN `getMediaSessionArtwork` construit le tableau artwork — THEN l'URL est modifiée pour remplacer toute résolution `NxNbb.jpg` par `512x512bb.jpg`, afin d'obtenir une jaquette haute résolution dans la notification système.
- **SPEC-13.3.8** GIVEN `_fetchArtworkDataUri` télécharge une URL — WHEN la réponse HTTP n'est pas OK (`!response.ok`), OU le blob a une taille < 64 octets, OU le Content-Type n'est pas `image/*` (ex. page d'erreur HTML depuis un CDN expiré) — THEN la fonction retourne `''` sans appeler FileReader, et le handler async de `updateNowPlaying` n'écrase PAS le metadata existant avec un data URI non-image.

### 13.4 Wake Lock

- **SPEC-13.4.1** GIVEN un morceau en lecture — THEN `navigator.wakeLock.request('screen')` est appelé.
- **SPEC-13.4.2** Un audio silencieux en boucle (WAV 1s, volume `0.001`) maintient la session active pendant les pauses.
- **SPEC-13.4.3** Le wake lock est libéré sur pause (sauf keepalive actif).
- **SPEC-13.4.4** GIVEN `visibilitychange → visible` ET lecture en cours — THEN `wakeLock.request('screen')` est rappelé (le navigateur libère automatiquement le lock lors du passage en arrière-plan).

### 13.5 Android Auto

- **SPEC-13.5.1** Shortcuts : `?automix=1` (Mix Auto), `?tab=playlists` (Playlists), `?tab=queue` (Queue).
- **SPEC-13.5.2** Metadata push : `pushNowPlaying({ id, title, artist, album, artworkUrl, durationMs })`.
- **SPEC-13.5.3** Playback state : `pushPlaybackState({ playing, positionMs, speed })`.
- **SPEC-13.5.4** Queue push debounced `500 ms`.
- **SPEC-13.5.5** Commandes média : `onMediaCommand(handler)` pour play/pause/next/seek. `getPendingMediaCommand()` pour cold-start.
- **SPEC-13.5.6** Artwork blob → base64 data URI pour Android.
- **SPEC-13.5.7** Côté natif (`dj-mix-android/`), le plugin Capacitor `MediaSession` implémente `updateMetadata`/`updatePlaybackState`/`updateQueue`/`getPendingCommand` et émet l'événement `mediaCommand` — ces noms et la forme des payloads (mêmes clés que 13.5.2-13.5.6 : `id`, `title`, `artist`, `album`, `artworkUrl`, `durationMs`, `playing`, `positionMs`, `speed`, `items[]`, `action`, `mediaId`) sont le contrat strict entre `lib/androidAutoBridge.js` et `MediaSessionPlugin.java` ; toute évolution de l'un doit être répercutée sur l'autre dans le même changement.
- **SPEC-13.5.8** `MediaPlaybackService` (`MediaBrowserServiceCompat` + `MediaSessionCompat`) expose la file à Android Auto et relaie les commandes de transport (boutons casque/Bluetooth/voiture, notification) vers `applyMediaCommand()` (`main.js`) avec les actions `play`/`pause`/`next`/`seekTo`/`playFromMediaId`.
- **SPEC-13.5.9** Déclarations manifest requises pour qu'Android Auto détecte l'app : meta-data `com.google.android.gms.car.application` → `res/xml/automotive_app_desc.xml` (`<uses name="media"/>`), service `MediaPlaybackService` avec intent-filter `android.media.browse.MediaBrowserService` (`exported`, `foregroundServiceType="mediaPlayback"`), receiver `androidx.media.session.MediaButtonReceiver`. Patchées automatiquement par `.github/workflows/apk-djmix.yml` sur le manifest généré par `cap add android`.
- **SPEC-13.5.10** Piège opérationnel : un APK construit par la CI est signé en sideload (hors Play Store). Android Auto n'affiche les apps média sideloadées que si "Sources inconnues" est activé dans les réglages développeur de l'app Android Auto sur le téléphone (triple-tap sur le numéro de version) — un manifest/service par ailleurs correct n'apparaîtra pas sans cette étape.
- **SPEC-13.5.11** `ApkUpdaterPlugin` (plugin Capacitor `ApkUpdater`, méthode `downloadAndInstall({ url })`) télécharge la mise à jour APK via `DownloadManager` et lance l'installation via un `FileProvider` (`res/xml/file_paths.xml`) — appelé par `dj-mix/pwa.js#doApkUpdate()`, sans rapport fonctionnel avec Android Auto mais empaqueté dans le même wrapper natif.

### 13.6 Plein écran

- **SPEC-13.6.1** `requestFullscreen({ navigationUI: 'hide' })` avec fallback webkit.
- **SPEC-13.6.2** Auto-activation : tentative immédiate (Capacitor WebView), puis sur premier `pointerdown`.
- **SPEC-13.6.3** Réactivation automatique sur événement `fullscreenchange`.
- **SPEC-13.6.4** L'auto-activation (13.6.2/13.6.3) ne s'applique qu'en WebView Capacitor ou sur mobile (`isMobileDevice()` de `lib/ramProfile.js`) ; sur un navigateur desktop, `initAutoFullscreen()` ne tente aucun passage en plein écran automatique (l'utilisateur garde la main via `toggleFullscreen()`).

---

## 14. Interface utilisateur

### 14.1 Onglets principaux

- **Mix** : platines, crossfade slider, 18 raccourcis DJ FX, boutons AutoMix/AutoDJ.
- **Fil Rouge** : playlist de fond avec contrôles shuffle/loop/DJ plan.
- **Cache** : navigateur de morceaux téléchargés avec filtrage genre/année.
- **Config** : 10+ sections de configuration.

### 14.2 Rendu

- **SPEC-14.2.1** Queue, playlists et Fil Rouge rendus dynamiquement via `uiRenderer`.
- **SPEC-14.2.2** Drag-and-drop sur les éléments de la queue.
- **SPEC-14.2.3** Notifications toast pour actions et erreurs.
- **SPEC-14.2.4** Chaque platine affiche sous la barre de progression le temps actuel et la durée totale du morceau au format `m:ss / m:ss` (via `formatTime(positionMs) / formatTime(durationMs)`). L'affichage est masqué si aucun morceau n'est chargé (`durationMs = 0`).

### 14.3 Localisation

- **SPEC-14.3.1** L'interface est intégralement en français.

### 14.4 Volume global

- **SPEC-14.4.1** Un curseur de volume global (`#global-volume-slider`, `0`–`100`) est affiché dans la section player, sous le crossfade slider de mix.
- **SPEC-14.4.2** Un bouton mute (`#global-volume-btn`) permet de couper / rétablir le son en un clic. GIVEN volume > 0 — WHEN clic — THEN `globalVolume = 0` (icône 🔇). GIVEN volume = 0 — WHEN clic — THEN restaure le volume précédent.
- **SPEC-14.4.3** GIVEN `globalVolume = v` — WHEN `#applyDeckBaseMix(baseA, baseB)` est appelé — THEN les volumes effectifs des platines sont `nextA × v` et `nextB × v` (`v ∈ [0, 1]`).
- **SPEC-14.4.4** Le volume global est persisté dans `localStorage` sous la clé `dj-mix:global-volume`. Défaut : `1.0`.
- **SPEC-14.4.5** L'icône du bouton reflète le niveau : `🔇` si `v = 0`, `🔉` si `v < 0.5`, `🔊` sinon.

---

## 15. Monitoring et résilience

### 15.1 Santé de l'API

- **SPEC-15.1.1** `apiHealthMonitor` suit l'état online/offline. Les transitions déclenchent des callbacks.
- **SPEC-15.1.2** `apiHealthMonitor.probe()` déclenche une vérification immédiate de `/health`, quelle que soit l'état courant (online ou offline). Appelé sur `visibilitychange → visible` pour détecter rapidement toute perte de connexion survenue pendant que l'écran était éteint.

### 15.2 Logging

- **SPEC-15.2.1** Logging structuré via `logger` : `debug`, `info`, `warn`. Contexte : module, action, données.
- **SPEC-15.2.2** Mode debug activable via `dj-mix:logs:debug` dans `localStorage`.
- **SPEC-15.2.3** Métriques loguées toutes les `60 000 ms` (`METRICS_LOG_INTERVAL_MS`).

### 15.3 Tolérance aux pannes

- **SPEC-15.3.1** Une panne API ne crash pas l'application. Les fonctionnalités dégradées sont signalées par toast.
- **SPEC-15.3.2** Chaîne de fallback : API → Fil Rouge → arrêt gracieux.

---

## 16. Fingerprint et contrôle de boucle

### 16.1 Fingerprint multi-champ

- **SPEC-16.1.1** Le fingerprint d'un morceau comprend : `id`, `ratingKey`, `uri`, `name` (lowercase trim), `artist` (lowercase trim).
- **SPEC-16.1.2** Objectif : empêcher les boucles infinies entre platines quand l'Auto DJ re-queue un morceau qui est encore sur l'autre deck.
- **SPEC-16.1.3** GIVEN un morceau fini sur deck A — WHEN l'Auto DJ cherche le suivant — THEN le morceau encore sur deck B est exclu par match sur n'importe lequel des champs du fingerprint.

### 16.2 Historique de lecture

- **SPEC-16.2.1** `playHistory` stocke tous les variants d'ID du morceau joué : `[id, ratingKey, uri]` + combo `name+artist`.
- **SPEC-16.2.2** Persisté dans `localStorage` sous `AUTO_MODE_HISTORY_KEY`.
- **SPEC-16.2.3** `reset()` efface l'historique et le fingerprint courant.

### 16.3 Affichage du morceau suivant

- **SPEC-16.3.1** Le prochain morceau à jouer est affiché dans l'UI.
- **SPEC-16.3.2** L'utilisateur peut accepter ou rejeter la suggestion.

---

## Architecture technique

### Contraintes

- Limite souple de 350 lignes par module.
- Pattern factory pour les managers.
- État centralisé via `uiState` (singleton).
- Pas de framework front-end (vanilla JS + DOM).
- Compatible ES2020+ (modules natifs).

### Structure des données clés

**Track / QueueItem :** ces objets sont désormais des instances partagées entre la
Queue et le Fil Rouge (`lib/trackStore.js`, cf. SPEC-2.6) — un même morceau présent
dans les deux listes référence le même objet, pas une copie.
```
{ id, name, artist, duration, bpm, genre, loudnessDb,
  artUrl, stems { vocal, instru },
  persistedSourceUrl, downloadUrl, localBlobUrl,
  queueSource, startOffsetMs, autoDjStartOffsetMs,
  sourceState: 'idle' | 'downloading' | 'ready' | 'done' | 'error',
  djTrackId, djHasAnalysis, djTransition, djIsIconic,
  ratingKey, uri }
```

**MixData (analyse waveform) :**
```
{ durationSec, probableSongStartSec,
  peakZones[{ startSec, endSec, score, intensity }],
  safeTransitionZones[{ startSec, endSec, score, reason }],
  avoidTransitionZones[{ startSec, endSec, score, reason }],
  dropZones[{ startSec, endSec, score }],
  breakdownZones[{ startSec, endSec, score, reason }],
  neverMissZones[{ startSec, endSec, neverMissScore, label, reason, source }],
  outroZones[{ startSec, endSec }],
  confidence: { transitions: 0–1 },
  vocalPresenceProfile[{ timeSec, value }],
  phraseGrid[timeSec] }
```

**RelayState :**
```
{ sessionId, pushedAt,
  currentTrackId, currentIndex, isPlaying, activeDeck,
  deckA: { trackId, positionMs, volume },
  deckB: { trackId, positionMs, volume },
  queue[{ id, name, artist, artUrl, duration, persistedSourceUrl, bpm, genre }],
  filRouge[{ id, name, artist, artUrl, duration, persistedSourceUrl }],
  transitionMode, crossfadeMs, djMode }
```

### Constantes globales

```
FFT_SIZE = 1024
SMOOTH_TAU = 0.08
SMOOTH_JS = 0.34
ENERGY_EPSILON = 1e-4
DISTORTION_K = 140
ECHO_DELAY_S = 0.22
ECHO_FEEDBACK = 0.28
STEM_SYNC_INTERVAL_MS = 2500
LOOP_CUE_REPEAT_COUNT = 3
LOOP_CUE_INTERVAL_MS = 1500
SEARCH_DEBOUNCE_MS = 600
SPOTIFY_FIL_ROUGE_POLL_MS = 120_000
METRICS_LOG_INTERVAL_MS = 60_000
IDLE_SCHEDULE_FALLBACK_MS = 80
IDLE_SCHEDULE_TIMEOUT_MS = 2000
MAX_SESSION_BLOB_CACHE_ENTRIES = 12
LOW_MEMORY_PLAYBACK_MAX_RAM_MB = 3072
MOBILE_TRANSITION_RAM_BUDGET_RATIO = 0.12

---

## 17. Mix Blind Test — Cache serveur (StemClient)

### 17.1 Cache localStorage des pistes serveur

- **SPEC-17.1.1** `fetchServerCacheTracks()` vérifie d'abord le cache localStorage (clé `mix-blind-test:server-tracks-cache`) avant d'effectuer une requête réseau. Le TTL est de `5 minutes` (`300 000 ms`).
- **SPEC-17.1.2** GIVEN un cache dont `fetchedAt` est inférieur au TTL — WHEN `fetchServerCacheTracks()` est appelé sans option `forceRefresh` — THEN les pistes sont retournées depuis le cache sans requête HTTP.
- **SPEC-17.1.3** GIVEN un cache absent ou dont `fetchedAt` dépasse le TTL — WHEN `fetchServerCacheTracks()` est appelé — THEN une requête vers `/api/cache/files` est effectuée, le résultat est persisté en localStorage avec `fetchedAt = Date.now()`, et les pistes normalisées sont retournées.
- **SPEC-17.1.4** GIVEN l'option `forceRefresh: true` — WHEN `fetchServerCacheTracks({ forceRefresh: true })` est appelé — THEN le cache localStorage est ignoré et une requête serveur est systématiquement effectuée.
- **SPEC-17.1.5** GIVEN un objet cache dont le champ `tracks` est absent ou non-tableau — WHEN `isServerTracksCacheFresh` est évalué — THEN la valeur `false` est retournée (cache invalide).

### 17.2 Stockage local des stems sous forme de blob (IndexedDB)

- **SPEC-17.2.1** `saveStemBlob(track, variant, blob)` persiste le blob audio dans IndexedDB (base `mix-blind-test-stems`, store `stems`, clé = `stemKey`) en tant que stockage primaire, puis en Cache API si disponible.
- **SPEC-17.2.2** `getCachedStemObjectUrl(track, variant)` recherche le blob dans l'ordre suivant : (1) object URLs en mémoire, (2) IndexedDB, (3) Cache API. Retourne une `blob:` URL ou `''` si absent.
- **SPEC-17.2.3** `pruneCache()` supprime les entrées évincées à la fois d'IndexedDB et du Cache API avant de mettre à jour les méta en localStorage.
- **SPEC-17.2.4** `writeBlobToIdb` et `readBlobFromIdb` et `deleteBlobFromIdb` sont des méthodes atomiques sur le store IndexedDB ; toute erreur est silencieuse (retour `null` ou no-op).
- **SPEC-17.2.5** Les vérifications de disponibilité du Cache API utilisent `'caches' in globalThis` (compatible browser et Node) au lieu de `'caches' in window`.
```

---

## 18. ~~Vérification d'empreinte AcoustID~~ (Supprimé)

~~Logique pure (parsing réponse, construction de payload) extraite dans `lib/fingerprintController.js` ; le fetch et le rendu du bottom-sheet (`#fp-suggestion-sheet`) restaient dans `main.js` (`_fpCheck`, `_fpShowSuggestions`, `_fpCorrectAndDownload`).~~ (Supprimé : le bouton `.queue-fp-btn` de la file d'attente, son unique point d'entrée, a été remplacé par le bouton "Actualiser mix data" (§2, `.queue-refresh-mix-btn`). `lib/fingerprintController.js`, le bottom-sheet `#fp-suggestion-sheet` et toute la logique associée ont été retirés — plus aucun appel à `POST /api/fingerprint/check` ou `POST /api/fingerprint/correct` depuis le front.)

---

## 19. Téléchargement de masse persistant — "Tout télécharger" (DownloadBatch)

Moteur de téléchargement de masse pour le bouton "Tout télécharger" (`filRougeDownloader.downloadAll`), extrait dans `lib/downloadBatchStore.js` (persistance IndexedDB) et `lib/downloadBatchManager.js` (orchestration). Utilise uniquement des `fetch()` classiques via une file interne à fenêtre glissante (pas de Background Fetch API du navigateur, pas de limitation de débit). Portée limitée à ce bouton : la synchronisation au chargement de la page (`startFilRougeStartupCacheSync`), la boucle de sync Spotify et l'import TXT conservent leur propre logique de batch en mémoire, inchangée (SPEC-3.4.x).

### 19.1 Schéma IndexedDB

- **SPEC-19.1.1** Base `dj-mix-downloads` (version `1`), deux stores : `batches` (`keyPath: 'id'`) et `items` (`keyPath: 'id'`, index non-unique `batchId`).
- **SPEC-19.1.2** `DownloadBatch` : `{ id, createdAt, updatedAt, status, totalFiles, completedFiles, failedFiles, transport }`. `status` ∈ `pending` (jamais utilisé — un batch est créé directement `running`) | `running` | `paused-auth` | `completed` | `failed`. `transport` = `'internal-queue'` (seul mode supporté).
- **SPEC-19.1.3** `DownloadItem` : `{ id, batchId, cacheKey, trackName, artistName, filename, size, status, retries, startedAt, completedAt }`. `id = \`${batchId}::${cacheKey}\`` (et non le simple `cacheKey`) pour qu'un même morceau présent dans deux lots distincts (ex. un lot `paused-auth` orphelin et un nouveau lot relancé) n'entre jamais en collision sur la clé primaire. `status` ∈ `pending` | `downloading` | `completed` | `failed`. `size` reste `null` en v1 (non exposé par `prefetchTrackToLocalCache`).
- **SPEC-19.1.4** Toute erreur IndexedDB est silencieuse : chaque méthode de `downloadBatchStore` retourne une valeur sûre (`null`, `[]`, `0`, `false`) plutôt que de rejeter (même convention que SPEC-17.2.4). GIVEN `indexedDB` indisponible (navigateur, ou environnement de test sans polyfill) — THEN toutes les méthodes deviennent des no-op silencieux.
- **SPEC-19.1.5** `updateItem(itemId, patch)` accepte soit un objet patch statique, soit une fonction `(existing) => patch` — utilisée pour incrémenter `retries` sans lecture préalable côté appelant.

### 19.2 Reprise au démarrage de la PWA

- **SPEC-19.2.1** Au démarrage, `filRougeDownloader.resumeIncompleteBatches(playlist)` est appelé (en parallèle de SPEC-3.4.x, protégé par la déduplication SPEC-3.4.10) et lit tous les `DownloadBatch` dont `status !== 'completed'`.
- **SPEC-19.2.2** Pour chaque lot incomplet, les `DownloadItem` dont `status === 'completed'` sont ignorés (jamais re-téléchargés) ; ceux à `pending` ou `failed` sont traités de façon identique (retentative). De plus, les morceaux déjà trouvables dans le cache local (`isTrackInLocalCache`) sont marqués `completed` sans re-téléchargement.
- **SPEC-19.2.3** GIVEN un `DownloadItem` dont le `cacheKey` ne correspond plus à aucun morceau du Fil Rouge actuel (supprimé de la playlist depuis) — THEN il est ignoré silencieusement, sans erreur.

### 19.3 Transport : file interne fetch

- **SPEC-19.3.1** Tous les téléchargements utilisent une file interne à fenêtre glissante avec concurrence adaptative (`computeNextBatchSize`, concurrence initiale `6`, plafond `20`, identique à SPEC-3.4.1/3.4.9). Chaque item passe par `pending` → `downloading` → `completed`/`failed`, écrit en IndexedDB à chaque transition en plus du statut en mémoire déjà affiché (`setFilRougeTrackStatus`/`renderTrackStatus`). Pas de limitation de débit : les `fetch()` sont lancés sans throttle, seule la concurrence adaptative régule le nombre de téléchargements simultanés.
- **SPEC-19.3.2** Un lot commence toujours par créer son `DownloadBatch` et tous ses `DownloadItem` (`status: 'pending'`) dans IndexedDB AVANT toute activité réseau — aucun état de progression n'existe uniquement en mémoire.
- **SPEC-19.3.3** Évitement des doublons : avant de lancer un téléchargement, `isTrackInLocalCache` vérifie si le morceau est déjà en cache local (Cache Storage ou session blob). De plus, `prefetchTrackToLocalCache` déduplique les appels concurrents via une map `inFlightPrefetches` (un seul fetch par `cacheKey` à la fois).

### 19.4 Expiration d'authentification

- **SPEC-19.4.1** `downloadTrackViaApi` attache `err.status` (code HTTP) à l'erreur levée sur réponse non-OK. `prefetchTrackToLocalCache(item, { onError })` transmet cette erreur à l'appelant via le callback optionnel `onError`, sans changer sa valeur de retour (`boolean`).
- **SPEC-19.4.2** GIVEN un item de la file interne échoue avec `err.status` `401` ou `403` — THEN ce n'est PAS compté comme un échec (`downloadState` remis à `idle`, pas `error` ; item IndexedDB remis à `pending`, pas `failed`) et le traitement du lot s'arrête immédiatement (les items restants du lot ne sont pas tentés).
- **SPEC-19.4.3** Le lot passe à `status: 'paused-auth'` en IndexedDB, tous les items non encore tentés repassent à `pending` (IndexedDB) et `idle` (mémoire), et `onAuthExpired()` est appelé — câblé dans `main.js` sur `showToast('Session expirée : renouvelez le token API dans Config', true)`.
- **SPEC-19.4.4** Reprendre : un nouveau clic sur "Tout télécharger" (après renouvellement du token dans Config) suffit — les items `pending` sont réévalués normalement par `downloadAll`, aucune action de reprise dédiée n'est nécessaire.

### 19.5 Discipline mémoire

- **SPEC-19.5.1** Aucun Blob agrégé n'est jamais construit pour plusieurs fichiers : chaque téléchargement persiste son fichier en Cache Storage immédiatement après réception (`persistAudioBlob`, un `cache.put()` par morceau).
- **SPEC-19.5.2** La file interne ne garde en mémoire que les morceaux en cours de téléchargement (pool à fenêtre glissante, `2` à `20` morceaux en parallèle selon SPEC-3.4.9), jamais l'intégralité d'un gros lot.

### 19.6 Retentatives avec backoff

- **SPEC-19.6.1** GIVEN des morceaux en échec à l'issue d'un passage de la file interne — THEN ils sont retentés jusqu'à `MAX_DOWNLOAD_RETRY_ATTEMPTS` (= `3`) fois via la file interne, avec backoff exponentiel avant chaque vague : `DOWNLOAD_RETRY_BACKOFF_BASE_MS · 2^(n−1)` soit 2 s, 4 s, 8 s (constantes dans `lib/constants.js`, attente injectable via `waitFn` pour les tests). Chaque échec incrémente `retries` sur l'item (SPEC-19.1.5) ; un morceau récupéré passe `completed`. Les compteurs finaux du lot reflètent l'état post-retentatives.
- **SPEC-19.6.1.1** Avant chaque vague de retentatives, `apiHealthMonitor.recordSuccess()` est appelé pour réinitialiser le compteur de défaillances consécutives du moniteur de santé. Ceci évite que des échecs en lot (ex. démarrage à froid du serveur, timeout réseau transitoire) ne déclenchent le mode offline du moniteur, qui bloquerait immédiatement toutes les retentatives suivantes sans même tenter le réseau. Le lot de téléchargement a sa propre logique de retry avec backoff, indépendante du circuit-breaker du moniteur.
- **SPEC-19.6.2** GIVEN une expiration auth (`401`/`403`) pendant une vague de retentatives — THEN le comportement SPEC-19.4.2/19.4.3 s'applique (lot `paused-auth`, `onAuthExpired()`), et aucune vague supplémentaire n'est lancée.

### 19.7 Continuité écran éteint / application en arrière-plan

Contexte : la file interne dépend de `fetch()` exécutés depuis la page — si l'écran s'éteint (mise en veille), les navigateurs mobiles suspendent ou ralentissent fortement ce JS, ce qui bloquait un gros lot tant que l'utilisateur ne rallumait pas l'écran.

- **SPEC-19.7.1** `createDownloadBatchManager` accepte `onInternalQueueActiveChange(active: boolean)`, appelé `true` dès qu'un passage par la file interne démarre (premier passage ou retentatives, dans `startBatch` et `resumeIncompleteBatches`) et `false` quand plus aucun passage n'est en cours (compteur de recouvrement, pas un simple booléen). `main.js` câble cette raison sur un Wake Lock écran (`navigator.wakeLock`, raison `'download'`, partagée avec la raison `'playback'` déjà existante — l'écran reste allumé tant qu'au moins une raison est active).
- **SPEC-19.7.2** Le Wake Lock est libéré automatiquement par le navigateur dès que l'onglet passe en arrière-plan (`visibilitychange` → `hidden`) : il protège uniquement contre la mise en veille de l'écran pendant que l'app reste au premier plan, pas contre un changement d'application. GIVEN un retour au premier plan (`visibilitychange` → `visible`) — THEN le Wake Lock actif est ré-acquis, ET si aucune file interne ne tourne déjà dans cet onglet (`filRougeDownloader.isInternalQueueRunning()` retourne `false`), `resumeIncompleteBatches` est relancé pour reprendre tout lot resté bloqué par la suspension JS survenue pendant l'arrière-plan.
- **SPEC-19.7.3** `isInternalQueueRunning()` (exposé par `downloadBatchManager` et `filRougeDownloader`) évite qu'un retour au premier plan ne déclenche un traitement concurrent du même lot pendant qu'un passage de file interne est encore en cours dans cet onglet.

### 19.8 Persistance localStorage du statut de téléchargement

- **SPEC-19.8.1** GIVEN `setFilRougeTrackStatus(item, { downloadState: 'done', … })` est appelé (téléchargement réussi) ET `item.name` et `item.artist` sont définis — THEN `patchStoredTrackMeta(name, artist, { downloaded: true })` est appelé pour persister le statut de téléchargement dans `localStorage` (clé `dj-mix:track-meta:${artist}::${name}`). Cette écriture est idempotente (merge shallow) et survit aux rechargements de page.
- **SPEC-19.8.2** `getFilRougeTrackStatus(item)` infère `downloadState: 'done'` depuis trois sources (en priorité croissante) : (a) `item.cachePath` ou `item.persistedSourceUrl` (données persistées dans le fil rouge), (b) `meta.downloaded` dans `trackMetaStorage` (localStorage), (c) le flag `downloadState` de la map en mémoire `filRougeTrackStatusByKey`. Résultat : un morceau déjà téléchargé n'est jamais re-proposé au téléchargement par `filRougeDownloader.downloadAll`, même après un rechargement de page complet, même si `cachePath`/`persistedSourceUrl` ne sont pas renseignés.
- **SPEC-19.8.3** Le flag `downloaded: true` n'est pas supprimé automatiquement. Il devient obsolète seulement si le cache audio et le localStorage sont tous deux effacés (ex. "Effacer les données du site" navigateur), auquel cas le morceau repassera à `idle` et sera re-téléchargé normalement.

## 20. Mise à jour forcée de la PWA

- **SPEC-20.1** Bouton `#btn-force-update` dans le bloc "Application PWA" de Config, toujours visible (pas de `hidden` — contrairement à `#btn-install-pwa`/`#btn-apk-update`). Au clic, appelle `forceUpdatePwa()` (`pwa.js`).
- **SPEC-20.2** `forceUpdatePwa()` désinscrit tous les service workers actifs (`navigator.serviceWorker.getRegistrations()` + `unregister()` sur chacun) et vide les caches d'assets applicatifs (`caches.keys()` + `caches.delete()` sur chacun), **à l'exception du cache audio** `dj-mix:audio-cache:v1` qui est intentionnellement préservé pour ne pas obliger l'utilisateur à re-télécharger tous ses morceaux après une mise à jour, puis recharge la page (`location.reload()`) — y compris si une des étapes échoue (`try/finally`). La constante `AUDIO_CACHE_NAME = 'dj-mix:audio-cache:v1'` dans `pwa.js` doit rester synchronisée avec `AUDIO_CACHE` dans `sw.js`. Objectif : contourner un Service Worker resté bloqué avec l'ancien code malgré `updateViaCache: 'none'` et l'écoute de `controllerchange` (SPEC existant `initServiceWorker`).
- **SPEC-20.3** Après le rechargement, `initServiceWorker()` réinscrit un Service Worker neuf qui retélécharge tous les `ASSETS` de `sw.js` (plus aucun cache ni SW préexistant ne peut servir une version périmée).
