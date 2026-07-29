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
- **SPEC-1.1.16** GIVEN un préchargement asynchrone du morceau suivant sur la platine inactive (`ensureLocalSource` → `playOnDeck` paused) — WHEN, au moment où la source est prête, la platine visée n'est plus inactive, OU l'item n'est plus assigné à cette platine, OU l'item est devenu le morceau courant — THEN le `playOnDeck` est abandonné (préchargement obsolète, log `stale … preload aborted`). S'applique aux 5 sites : préchargement post-crossfade et ghost fil rouge dans `startPlaybackForIndex` (main.js **et** `lib/playbackController.js`), remplacement de ghost dans `addToQueue` (main.js et `lib/queueManager.js`).
- **SPEC-1.1.17** GIVEN `launchDeckFromQueue(deck)` prépare une platine (chargement `paused`, cue manuel ou rafraîchissement de suggestion AutoDJ) — WHEN, une fois `preloadMixDataForDeckItem`/`ensureLocalSource` résolus, la platine visée n'affiche plus cet item (`deckDisplayItems[targetDeck] !== item`) OU cet item est déjà devenu le morceau courant (`uiState.currentTrackId === item.id`, typiquement parce qu'un vrai crossfade concurrent l'a déjà lancé) — THEN le `playOnDeck` est abandonné (log `stale deck target aborted`) plutôt que de recharger/rejouer le morceau depuis son offset de départ sur une platine déjà en train de le jouer. Implémenté dans main.js et `lib/playbackController.js`.

### 1.2 Crossfade

- **SPEC-1.2.1** La durée du crossfade est réglable entre `1` et `30` secondes (clamp via `Math.max(1, Math.min(30, value))`). Défaut : `6` secondes.
- **SPEC-1.2.2** GIVEN un morceau en lecture — WHEN le temps restant (`duration - currentTime`) atteint `crossfadeDurationMs` — THEN le crossfade démarre automatiquement. Le plancher interne est `250 ms`.
- **SPEC-1.2.3** GIVEN un crossfade en cours — WHEN le progrès `t` avance de `0` à `1` — THEN le volume de la platine sortante décroît et celui de la platine entrante croît selon la courbe définie par le mode de transition actif.
- **SPEC-1.2.4** GIVEN un DJ Plan avec `crossfadeDurationSec > 0` — WHEN le crossfade est déclenché pour cette transition — THEN la durée du DJ Plan remplace temporairement la durée globale.
- **SPEC-1.2.5** GIVEN un crossfade déjà en cours (`isCrossfading === true`) — WHEN `crossfadeToDeck()` est appelé une seconde fois par un déclencheur concurrent (timer automix ET fin de piste/Fil Rouge par ex.) — THEN l'appel est rejeté silencieusement et **renvoie `false`** (au lieu d'un `undefined` ambigu) sans toucher aux platines. Les appelants (`startPlaybackForIndex`) DOIVENT vérifier cette valeur de retour et s'abstenir de mettre à jour `uiState.currentTrackId`/la file quand elle vaut `false` — sinon la file affiche un morceau différent de celui réellement audible sur la platine (bug constaté : "Criminal" affiché comme actif pendant que "Mayores" jouait réellement).
- **SPEC-1.2.7** GIVEN `startPlaybackForIndex` échoue (le `catch` retire toujours le morceau de la file d'attente `queue` et enchaîne sur le suivant, `autoMixBtn.click()` après `400 ms`) — WHEN l'échec est dû à une API hors ligne (`apiHealthMonitor.isOffline() === true` au moment du `catch`) — THEN le morceau n'est PAS retiré de la playlist/file prioritaire du Fil Rouge (contrairement à un échec « dur » — piste introuvable, fichier corrompu — où le retrait reste justifié) : une panne réseau est transitoire, le morceau redeviendra téléchargeable une fois l'API revenue et ne doit pas être perdu du Fil Rouge simplement parce qu'il n'a pas pu être lu cette fois-ci.

#### 1.2.6 Reprise manuelle pendant une transition

- **SPEC-1.2.6.1** GIVEN une transition automatique en cours (`isCrossfading === true`, mode générique via `#runTransitionMode` ou `beat_repeat` via `#runBeatRepeatTransition`) — WHEN l'utilisateur bouge le mix-slider (`deckMixSlider` → `applyDeckMixRatio` → `player.setDeckMixRatio`) — THEN `cancelActiveTransition()` est appelé automatiquement en tête de `setDeckMixRatio` : l'intervalle de progression (`#crossfadeInterval`) est stoppé immédiatement et la Promise en attente dans `#runTransitionMode`/`#runBeatRepeatTransition` est résolue sans attendre la fin naturelle de la transition, laissant la main au ratio manuel demandé par le slider.
- **SPEC-1.2.6.2** GIVEN une transition annulée manuellement — THEN aucun handoff définitif n'a lieu : la platine sortante n'est PAS mise en pause et son `src` n'est PAS vidé (contrairement à la fin normale d'un crossfade) — les deux platines restent chargées et audibles sous contrôle manuel du slider. Les nettoyages FX temporaires (echo/filtres activés pour le mode en cours, cf. catalogue §1.3.1) et le retour des `playbackRate` à `1` s'appliquent malgré tout, via les `finally` déjà existants de `#runTransitionMode`/`#runBeatRepeatTransition`.
- **SPEC-1.2.6.3** GIVEN une transition annulée manuellement — THEN `crossfadeToDeck()` retourne `false` (même convention que SPEC-1.2.5 : les appelants n'avancent pas `uiState.currentTrackId`/la file, puisqu'aucun morceau n'est réellement devenu actif) et l'évènement `transitioncancelled` (`{ fromDeck, toDeck, mode }`) est émis — câblé dans `main.js` sur un toast « Transition annulée — mix manuel repris ».
- **SPEC-1.2.6.4** `cancelActiveTransition()` est un no-op sûr (renvoie `false`) si aucune transition n'est en cours, ou si l'appel survient avant que la boucle de progression n'ait démarré (ex. pendant le chargement réseau de la piste entrante) ou après qu'elle soit déjà résolue — évite les doubles résolutions de Promise sur des appels répétés (glissement continu du slider).
- **SPEC-1.2.6.5** `renderDeckState` (`lib/uiRenderer.js`) ne vide `deckDisplayItems[clearedDeck]` sur un retour de `isCrossfading` à `false` que si la platine concernée n'a effectivement plus de source (`detail.deckX.hasSrc === false`) — et non plus sur le seul basculement `true → false` de `isCrossfading`. Sans cette garde, une transition annulée manuellement (SPEC-1.2.6.1–3, les deux platines restant chargées) ferait disparaître à tort la piste/pochette affichée sur la platine sortante alors qu'elle continue de jouer.

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
| 23 | `beat_repeat` | 112 | 1.20 | Plein pendant le loop (2 répétitions par palier, `8→1/16` temps, plancher absolu), puis superposition (fade) sur la mesure suivante | Minimal (5%) pendant le loop, puis superposition avec le deck sortant sur la mesure suivante |
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

#### 1.3.5 Beat repeat synchronisé — RETIRÉ, remplacé par §1.3.8 (Progressive Loop Morph)

- **SPEC-1.3.5.1 à .5 (retirées le 2026-07-28)** : `triggerBeatRepeatTransitionFx`/`triggerLoopRoll` (déclenché sur `transitionmode`, seek brut sur `HTMLAudioElement.currentTime` toutes les `windowMs`) faisait doublon avec le vrai moteur (§1.3.8) — et pire, comme il démarrait immédiatement sur la platine sortante alors que celle-ci n'est mute qu'après l'attente de l'ancrage, c'était LUI qu'on entendait en premier : un bug perceptible comme « ça boucle sur une fraction de seconde au démarrage ». Supprimé entièrement (`lib/djFxController.js`, plus d'appel depuis `main.js`). `triggerLoopRoll` lui-même reste utilisé ailleurs (FX manuels ponctuels, `handleDjFxAction`) — seul l'appel automatique pour `beat_repeat` est retiré.

#### 1.3.6 Continuité audio (pas de silence)

- **SPEC-1.3.6.1** GIVEN un mode de transition autre que `cut_transition` (coupure instantanée intentionnelle) — WHEN le crossfade progresse — THEN la somme des volumes `from + to` ne doit jamais rester sous `0.05` pendant plus de `100 ms`, garantie qui couvre à plus forte raison l'exigence produit "aucune transition ne doit créer de silence supérieur à 500 ms". Cette garantie est vérifiée automatiquement pour les 23 modes de transition non-`cut_transition` (hors `auto`, qui délègue toujours à un mode concret).
- **SPEC-1.3.6.2** GIVEN le mode `fade_in_out` — WHEN le crossfade progresse — THEN le volume entrant (`to`) commence sa montée dès `t=0` (courbe `t^0.7`, pas de palier plat initial).
- **SPEC-1.3.6.3** GIVEN le mode `backspin` — WHEN le crossfade progresse — THEN le volume entrant (`to`) commence sa montée dès `t=0.2`, avant l'arrêt complet du deck sortant à `t=0.35`, évitant tout palier de silence total.
- **SPEC-1.3.6.4** GIVEN le mode `brake_tape_stop_simple` — WHEN le crossfade progresse — THEN le playback rate des deux platines suit le comportement générique (retour lissé vers `1`) — ce mode n'applique plus de décélération dédiée du playback rate.
- **SPEC-1.3.6.5** GIVEN le lissage générique du playback rate pendant une transition (`+= (1 − rate) × 0.18` par tick nominal de `30 ms`) — WHEN l'onglet/l'app passe en arrière-plan pendant qu'une transition est en cours — THEN le facteur `0.18` est corrigé par le temps réellement écoulé depuis le tick précédent (`timeCorrectedRateEase(0.18, elapsedMs)`, équivalent à `1 − (1 − 0.18)^(elapsedMs/30)`) plutôt qu'appliqué tel quel à chaque appel de `setInterval`. Sans cette correction, le throttling des `setInterval` en arrière-plan (navigateur réduisant la cadence des ticks, parfois à ~1/s) ralentit artificiellement la convergence du playback rate vers sa cible, laissant le tempo d'une platine décalé (perçu comme un BPM qui diminue doucement) tant que l'app reste en arrière-plan ; au retour au premier plan, les ticks reprennent leur cadence normale et le rate rattrape sa cible en une fraction de seconde, ce qui donnait l'impression d'une "correction" brutale. Bug corrigé le 2026-07-27.

#### 1.3.7 Mode `reverb_short_simple` désactivé

- **SPEC-1.3.7.1** Le mode `reverb_short_simple` produisait un son jugé insupportable (queue de réverb simulée via l'effet distortion) et est désactivé : il reste implémenté dans le catalogue (RAM, courbes, `switch`) mais n'est plus jamais choisi.
- **SPEC-1.3.7.2** GIVEN le mode `auto` — WHEN un mode est tiré au sort — THEN `reverb_short_simple` est exclu du pool (`#chooseAutoTransitionMode`), même s'il figure dans `allowedTransitionModes`.
- **SPEC-1.3.7.3** GIVEN le sélecteur manuel "Mode AutoMix" — THEN l'option `reverb_short_simple` n'est plus proposée dans le `<select>`.
- **SPEC-1.3.7.4** `reverb_short_simple` est retiré de `allowedTransitionModes` côté `main.js` (`DISABLED_TRANSITION_MODES`), donc même une valeur persistée (ancien réglage) retombe sur `auto` via `getSafeAllowedTransitionMode` / `#resolveAllowedTransitionMode`.

#### 1.3.8 Mode `beat_repeat` : « Progressive Loop Morph », machine à états à 8 phases

**Réécriture complète le 2026-07-29** sur demande explicite de l'utilisateur, qui a fourni la spécification intégrale sous forme de machine à états (`dj-mix/lib/loopmorph.md`) et a rejeté l'architecture précédente (une dizaine de fonctions pures spécifiques par palier) au profit d'une **timeline pilotée par une seule fonction d'interpolation générique** : « je ne coderais pas la transition avec 8 fonctions différentes ; je la décrirais comme une timeline pilotée par une machine à états ». Toutes les itérations précédentes de `beat_repeat` documentées plus haut dans ce fichier (raccourcissement progressif par palier, ancienne fenêtre de superposition finale avec bouclage miroir) sont **retirées et remplacées** par ce qui suit. Moteur dédié : `lib/loopMorphEngine.js` (fonctions pures + `LoopMorphEngine`), orchestré depuis `DJPlayer#runBeatRepeatTransition` dans `player.js`.

- **SPEC-1.3.8.19** GIVEN le mode `beat_repeat` — THEN la transition suit **8 phases** numérotées (`LOOP_MORPH_PHASE_COUNT` = `8`), chacune décrite dans `lib/loopmorph.md` par une longueur de loop (deck sortant), un nombre de répétitions, et des valeurs cibles de gain/filtre/écho. « Deck1 »/« Deck2 » du document correspondent respectivement au deck **sortant** (`context.fromDeck`) et **entrant** (`context.toDeck`).
- **SPEC-1.3.8.20** GIVEN les phases 1 à 5 — THEN chacune boucle le deck sortant sur une longueur donnée, jouée un nombre de répétitions **littéral** (confirmé avec l'utilisateur, pas étiré pour égaliser les durées) : `4` temps ×`2`, `2`×`2`, `1`×`2`, `1/2`×`1`, `1/2`×`1` (`MAIN_PHASES` — timing resserré : la phase 4→5 reste à `1/2` temps au lieu de continuer à réduire, voir `lib/loopmorph.md`). Leur durée réelle est donc entièrement déterminée par le BPM du deck sortant (`secondsPerBeat = 60 / bpm`, `getSafeLoopMorphBpm`, clampé `60`–`220`) — indépendante de `player.crossfadeDuration` (voir SPEC-1.3.8.27).
- **SPEC-1.3.8.21** GIVEN la phase 6 — THEN le deck sortant parcourt `1/4 → 1/4 → 1/4 → 1/16` temps (`PHASE6_SUBDIVISION_BEATS` — timing resserré : reste à `1/4` temps trois fois avant de chuter directement au plancher, au lieu de la réduction progressive `1/2 → 1/4 → 1/8 → 1/16` d'origine), chaque subdivision **étirée** (« repeat each subdivision enough times to create acceleration ») pour occuper une part égale de la durée allouée à la phase 6 (`buildFillSegments` : `reps = max(2, round(sliceSec / longueur))`, jamais moins que `2` répétitions). Le dernier segment (`1/16` temps, plancher `LOOP_MORPH_FLOOR_BEATS`) est prolongé sans nouveau `AudioBufferSourceNode` jusqu'à la fin de la phase 7 : un seul segment continu couvre phase 6 et phase 7, pas un redémarrage à la frontière de phase — c'est CE segment que SPEC-1.3.8.22 retune en plein vol à l'entrée de la phase 7.
- **SPEC-1.3.8.22** **RETOUR UTILISATEUR DU 2026-07-29 — direction inversée** : le deck **entrant** ne se synchronise plus jamais (ni tempo ni bouclage) ; il joue normalement, à son tempo natif, du début à la fin de la transition. Seule sa position est calée en phase 6 (« Seek to transition cue ») sur la prochaine limite de **mesure** (`computeLoopMorphAnchorSeconds(currentTimeSec, secondsPerBeat, LOOP_MORPH_BEATS_PER_BAR)`, généralisation à `4` temps de l'ancrage battement-par-battement de SPEC-1.3.8.24 — même limite assumée : aucune détection de downbeat réelle, phase zéro supposée au début de piste) : `context.to.currentTime = toAnchorSec`, un simple seek, sans moteur de bouclage dédié. C'est à la place le deck **sortant** qui bouge : à l'instant précis où la phase 7 démarre, le `playbackRate` du **dernier segment déjà en cours** (celui de SPEC-1.3.8.21, qui couvre phases 6+7) est basculé de son taux natif vers `computeLoopMorphBpmSyncRatio(toBpm, fromBpm) = toBpm / fromBpm` via `LoopMorphEngine#scheduleFinalSegmentRateChange(t0 + timeline.phase7StartSec, ratio)` — un second `AudioParam#setValueAtTime` sur le nœud déjà démarré (pas un nouveau nœud, pas de redémarrage). Résultat perçu : le minuscule bouclage du deck sortant, déjà entendu depuis la phase 1, se met soudain à battre exactement au tempo du deck entrant — « comme si c'était juste les battements de l'autre chanson qu'on entend » — avant même que l'audio réel du deck entrant devienne audible (sa propre montée de gain, SPEC-1.3.8.29). Cette retonalité est intrinsèquement temporaire : le nœud est détruit quand la boucle s'arrête (fin de phase 7), donc aucune restauration explicite n'est nécessaire (contrairement à un vrai `playbackRate` de platine).
- **SPEC-1.3.8.23** *(retirée le 2026-07-29 — le deck entrant n'a plus de bouclage propre à faire échouer ; son seek de phase 6 est une simple affectation synchrone de `currentTime`, rien à absorber silencieusement).*
- **SPEC-1.3.8.24** Le bouclage est mis en œuvre par un unique moteur Web Audio dédié (`LoopMorphEngine`, sur le deck **sortant** seulement depuis le 2026-07-29 — le deck entrant n'en a plus, SPEC-1.3.8.22) : le morceau est décodé transitoirement (`AudioContext#decodeAudioData` sur son `blob:` déjà local), seule une petite fenêtre autour de l'ancrage est retenue en mémoire. Chaque segment a son propre `AudioBufferSourceNode` (`loop = true`, `loopStart` fixe à l'ancrage, `loopEnd` qui varie par segment), tous les instants de départ/arrêt calculés une seule fois à l'avance (`ctx.currentTime`) — lecture **sample-accurate**, aucun changement de longueur en plein milieu d'un temps (le changement de `playbackRate` de SPEC-1.3.8.22 est la seule exception délibérée, sur le tout dernier segment). L'ancrage du deck sortant (phase 1) reste au **prochain** temps, jamais en arrière (`computeLoopMorphAnchorSeconds(currentTimeSec, secondsPerBeat, 1)`), et le moteur attend que la lecture en direct l'ait réellement atteint (`DJPlayer#waitForLoopMorphAnchor`) avant de basculer — un ancrage en arrière ferait rejouer un instant déjà entendu (bug corrigé le 2026-07-28, toujours valable ici).
- **SPEC-1.3.8.25** GIVEN un changement de longueur de loop — THEN un fondu enchaîné court est appliqué entre segments consécutifs pour éviter tout clic (`computeLoopMorphCrossfadeWindowSec`, proportionnel à la longueur du segment concerné, borné **`5 ms`–`10 ms`** — la fourchette explicite de `lib/loopmorph.md`, plus étroite que l'ancienne implémentation). Les points de boucle (`loopStart`/`loopEnd`) sont en complément ajustés au plus proche passage par zéro (recherche `± 5 ms`).
- **SPEC-1.3.8.26** GIVEN un échec du décodage du deck sortant à l'ancrage — THEN l'automatisation gain/filtre/écho du `tick` continue normalement (silencieuse, faute de boucle audio) plutôt que de faire échouer toute la transition.
- **SPEC-1.3.8.27** LA MACHINE À ÉTATS : un unique calendrier (`computeLoopMorphTimeline(secondsPerBeat, player.crossfadeDuration / 1000)`) donne, pour chacune des `8` phases, son `startSec`/`durationSec` — les phases 1-5 déterminées par le BPM (SPEC-1.3.8.20), le temps restant (`crossfadeDuration − durée des phases 1-5`, plancher `0.3 s × 3` pour ne jamais collapser) réparti à parts égales entre les phases 6, 7, 8. `player.crossfadeDuration` reste la référence de durée totale (confirmé avec l'utilisateur), mais n'a d'effet que sur ces `3` dernières phases : à un BPM courant, les phases 1-5 seules peuvent dépasser la durée configurée — limite assumée, pas de troncature des répétitions littérales de SPEC-1.3.8.20.
- **SPEC-1.3.8.28** **LE PILOTE GÉNÉRIQUE** : `computeLoopMorphStateAtElapsed(timeline, elapsedSec)` est l'unique fonction que `player.js` appelle à chaque `tick` (`~30 ms`) pour obtenir `{deck1Gain, deck2Gain, hpFilterPct, echoPct, deck2FilterPct}` — aucun branchement par phase. Chaque valeur est interpolée (courbe **equal-power**, `lib/loopmorph.md` : « Use Equal-Power gain curves instead of linear fades » — `computeLoopMorphStateAtElapsed`'s `equalPowerLerp`, réutilisant le `sin()` déjà utilisé pour les fondus à deux signaux ailleurs dans `player.js`) depuis la valeur de **fin de la phase précédente** jusqu'à la valeur de **fin de la phase courante** (`PHASE_BOUNDARIES`, `9` entrées : ÉTAT INITIAL + fin de chacune des `8` phases). `deck2FilterPct` est l'interprétation de cette implémentation pour « Deck2 ... Gradually restore bass frequencies » (phase 7, non chiffré dans le document source) : le deck entrant rejoint avec le même filtre que le deck sortant à ce moment (thème « les deux platines dans le même état », déjà établi dans les itérations précédentes de cet effet) puis le restaure explicitement à `0` en fin de phase 7.
- **SPEC-1.3.8.29** GIVEN les valeurs de `PHASE_BOUNDARIES` — THEN elles reproduisent littéralement `lib/loopmorph.md` : ÉTAT INITIAL (`deck1Gain=1`, `deck2Gain=0`, `hpFilterPct=0`, `echoPct=0`) ; fin phase 2/3/4 (`hpFilterPct=0.05/0.12/0.20`) ; fin phase 5 (`hpFilterPct=0.35`, `deck1Gain=0.95`) ; fin phase 6 (`hpFilterPct=0.60`, `deck1Gain=0.90`, `echoPct=0.20`) ; fin phase 7 (`hpFilterPct=0.90`, `deck1Gain=0.40`, `deck2Gain=0.60`, `echoPct=0.45`) ; ÉTAT FINAL / fin phase 8 (`deck1Gain=0`, `deck2Gain=1`, `hpFilterPct=0`, `echoPct=0.60`).
- **SPEC-1.3.8.30** « The user crossfader remains unchanged; only internal deck gains are automated » — THEN `audio.volume` (`HTMLAudioElement`, piloté par le crossfader utilisateur via `#applyDeckBaseMix`) est figé à `1` sur les deux platines dès le début de la transition et `#applyDeckBaseMix` n'est plus appelé pendant le `tick` : tout le mixage perçu vient de `SimpleMixFeatures#setDeckGain` (nouveau — automatise `preGain`, un nœud de gain déjà câblé dans le graphe mais jusqu'ici inutilisé, en amont du signal sec uniquement — le départ d'écho branche directement sur `sourceBus`, donc `preGain` peut descendre à `0` pendant que l'écho continue de sonner, cf. phase 8). `preGain` est remis à `1` (neutre) et le crossfader reprend la main (`#applyDeckBaseMix(0,1)` orienté) une fois la transition terminée — sauté si l'utilisateur a repris la main manuellement (`cancelActiveTransition`) pour ne pas fighting son geste.
- **SPEC-1.3.8.31** Le filtre high-pass continu (`SimpleMixFeatures#setDeckFilterSweep(deck, pct)`, nouveau) balaye exponentiellement de `LOOP_MORPH_FILTER_MIN_HZ` = `20 Hz` (quasi transparent) à `LOOP_MORPH_FILTER_MAX_HZ` = `280 Hz` (même cible que l'ancien mode binaire `deckFx.filterMode = 'highPass'`, conservée comme référence à `100%`) — indépendant du système `deckFx.filterMode` discret utilisé par les autres modes de transition. L'écho (`SimpleMixFeatures#setEchoIntensity(value, deck)`, étendu avec un paramètre `deck` optionnel) ne s'active que sur le deck sortant, jamais sur l'entrant.
- **SPEC-1.3.8.32** GIVEN le début de la phase 8 — THEN le moteur `LoopMorphEngine` du deck sortant s'est déjà arrêté naturellement (son propre calendrier programmé à l'avance se termine pile à cet instant) : ce déclencheur unique se contente de réactiver la contribution du `HTMLAudioElement` du deck **sortant** (`SimpleMixFeatures#setDeckElementGain(fromDeck, 1)`) pour que sa lecture réelle (non bouclée) prenne le relais du moteur de boucle — le deck **entrant** n'a jamais été coupé (SPEC-1.3.8.22), rien à réactiver de son côté. GIVEN la fin de la phase 8 (`deck1Gain` a atteint `0`) — THEN la platine sortante continue de jouer silencieusement `200 ms` (« Continue playback silently for 200 ms ») avant que la transition ne se résolve — c'est ce délai, pas la résolution immédiate, qui laisse le temps au nettoyage de `crossfadeToDeck` (pause/reset de la platine sortante) de s'exécuter après coup.
- **SPEC-1.3.8.33** GIVEN la transition terminée OU interrompue — THEN le filtre/écho/gain interne des deux platines sont restaurés à neutre et le moteur `LoopMorphEngine` du deck sortant est arrêté (idempotent). Aucune restauration de `playbackRate` n'est nécessaire pour la platine entrante : elle n'a jamais été modifiée (SPEC-1.3.8.22) ; le `#smoothSetDeckPlaybackRate(toDeck, 1, 220)` du `finally` reste présent par symétrie défensive avec la platine sortante mais est un no-op dans ce mode.
- **SPEC-1.3.8.34** GIVEN l'`AudioContext`/`SimpleMixFeatures` indisponible (navigateur sans Web Audio) — THEN la transition se dégrade en un basculement instantané (`#applyDeckBaseMix` orienté) plutôt que de ne produire aucun mixage : ce mode dépend fondamentalement du graphe `preGain`/filtre de `SimpleMixFeatures`, il n'existe pas d'équivalent « `HTMLAudioElement` seul » à « le crossfader reste inchangé, seuls les gains internes bougent ».
- **SPEC-1.3.8.37** **RETOUR UTILISATEUR DU 2026-07-29 — le loop rapide (phase 6+) sonnait comme un bourdonnement chaotique au lieu d'une batterie rythmée** : boucler un buffer audio brut en continu, une fois le cycle assez court, ne produit pas des répétitions rythmiques distinctes mais une synthèse par table d'onde (une tonalité/bourdonnement). `LoopMorphEngine#run` applique désormais un **gate percussif** par cycle pour tout segment dont `lengthSec < PERCUSSIVE_GATE_THRESHOLD_SEC` (`0.2 s` — sépare les loops longs des phases 1-5, déjà clairement rythmiques par la longueur du contenu musical répété, des subdivisions rapides de la phase 6) : au lieu d'un unique palier de gain plat sur toute la durée du segment, chaque cycle est ré-attaqué (`gain.setValueAtTime(1, cycleStart)`) puis décroît (`gain.exponentialRampToValueAtTime(PERCUSSIVE_GATE_FLOOR = 0.08, cycleStart + decaySec)`, `decaySec = PERCUSSIVE_GATE_DECAY_FRACTION (0.55) × durée du cycle`) — la fraction restante du cycle est un creux quasi-silencieux (plancher `0.08`, jamais `0`, pour éviter un clic) qui sépare audiblement chaque « coup » du suivant. Le nombre de cycles est calculé et étiré pour occuper exactement la portion de sustain du segment (entre les fondus d'entrée/sortie de SPEC-1.3.8.25), même mécanique « étirer pour remplir un créneau » que `buildFillSegments`. Les segments non concernés gardent leur unique palier de gain plat inchangé.
- **SPEC-1.3.8.38** **BUG CORRIGÉ LE 2026-07-29 — grésillement/stutter persistant en fin de transition, après SPEC-1.3.8.37** : `startEcho` (`const`, capturé une seule fois avant la boucle du `tick`) ne reflète que l'état AVANT la transition, jamais l'état courant ; le `tick` (`if (!startEcho) this.setMixFeatures({ echo: true })`) rappelait donc `setMixFeatures({ echo: true })` à **chaque tick** (`~30 ms`) tant que `state.echoPct > 0` (phases 6 à 8, potentiellement des dizaines d'appels) — confirmé par un flot de logs `[mixFeatures] setEnabled`/`apply`. Chaque appel déclenche `SimpleMixFeatures#apply()`, qui remet instantanément (`.value =`, pas de rampe) `wet`/`dry`/`distWet`/`distDry`/`distBaseSend`/`distStemSend`/`echoBaseSend`/`echoStemSend` sur les **deux** platines et met en pause tout stem audio actif — d'où le grésillement, un artefact à chaque appel. Corrigé avec un drapeau local mutable (`echoEnabled`, initialisé à `startEcho`) qui ne déclenche `setMixFeatures({ echo: true })` qu'**une seule fois** par transition, dès que `echoPct` dépasse `0` pour la première fois.

#### 1.3.9 Mode `short_loop` plafonné à 3 répétitions

- **SPEC-1.3.9.1** GIVEN le mode `short_loop` — WHEN la piste entrante dépasse `SHORT_LOOP_LENGTH_SEC` (`0.85 s`) depuis son point de ré-ancrage (`loopAnchor`) et que `progress < 0.45` — THEN elle est ré-ancrée à `loopAnchor` (`shouldResetShortLoop`), mais au maximum `SHORT_LOOP_MAX_REPEATS` = `3` fois : au-delà, la lecture continue normalement sans nouveau seek arrière, même si `progress` reste `< 0.45`.
- **SPEC-1.3.9.2** Le compteur de répétitions (`shortLoopRepeatCount`) est réinitialisé à chaque nouvelle transition (variable locale à `#runTransitionMode`), donc chaque `short_loop` dispose bien de ses 3 répétitions.

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
- **SPEC-2.6.9** GIVEN un `artUrl` de type `blob:` (URL objet issue de `restoreArtwork`/Cache Storage, révoquée dès que le document qui l'a créée se décharge) — WHEN `trackStore.save()` sérialise l'enregistrement, OU `trackStore.restore()` charge une entrée déjà persistée avec un tel `artUrl` — THEN ce champ est vidé (`''`) plutôt que persisté/restauré tel quel, afin que le code appelant (`fetchAndStoreArtworkForItem`/`fetchFilRougeArtwork`) le traite comme « artwork manquant » et le retélécharge (Cache Storage → cache d'URLs artwork → API/CDN) au lieu d'afficher une pochette cassée indéfiniment. La valeur en mémoire (session en cours) n'est pas altérée, seule la copie persistée l'est.

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
- **SPEC-3.4.12** GIVEN `startFilRougeStartupCacheSync` (Phase 1, au chargement de la page) constate qu'un morceau marqué `done` (via `item.cachePath` connu ou le flag `localStorage` de SPEC-19.8.1) n'est en réalité plus retrouvable dans le Cache Storage du navigateur (`isTrackInLocalCache` renvoie `false`) — THEN son `downloadState` est rétrogradé à `idle` plutôt que de rester affiché « Download fini ». Objectif : ne jamais laisser croire qu'un morceau est jouable hors-ligne alors qu'il redemandera en réalité un accès réseau à la lecture (cf. SPEC-11.3.5) ; permet aussi à la Phase 2 de le proposer au (re)téléchargement une fois l'API de retour.
- **SPEC-3.4.13** GIVEN `apiHealthMonitor.isOffline()` est déjà vrai avant la Phase 2 de `startFilRougeStartupCacheSync` — THEN la Phase 2 est entièrement sautée (aucune tentative de téléchargement), pour éviter de faire clignoter chaque morceau manquant en `downloading` puis `error` pour un lot voué à l'échec. GIVEN l'API bascule offline pendant l'exécution de la Phase 2 (détecté après un batch) — THEN les morceaux du batch qui viennent d'échouer sont marqués `idle` (pas `error`, qui impliquerait un problème propre à la piste) et les batches restants ne sont pas tentés.

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
- **SPEC-4.3.8** GIVEN « Lire maintenant » (bouton "Fade", relais §9.4) — THEN la piste est TOUJOURS positionnée immédiatement sous le titre en cours (`currentIndex + 1`), jamais en fin de file : `addToQueue(..., { playNow: true })` insère désormais à `currentIndex + 1` (comme `asNext`) au lieu d'ajouter en fin de queue — cf. `lib/queueManager.js`/`main.js` (`if (asNext || playNow) { … splice … }`). GIVEN une piste en cours de lecture — WHEN `triggerSearchFade()` doit d'abord ajouter la piste (absente de la queue) avant de précharger la platine inactive — THEN l'ajout se fait via `addToQueue(track, { asNext: true })`, pour la même raison.

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
- **SPEC-5.1.5** GIVEN un nouveau morceau "suivant" est sélectionné (Fil Rouge ou suggestion Auto DJ) — WHEN la recherche de mix data pour ce morceau démarre — THEN `nextTrackMixData` est immédiatement remis à `null` (et `onMixDataUpdated(null)` déclenché) AVANT l'appel réseau, afin que les zones de mix de l'ancien "prochain morceau" ne restent pas affichées sur le nouveau pendant que le fetch est en cours. `onMixDataUpdated(mixData)` est aussi appelé dès que le fetch se résout, pour rafraîchir l'affichage sans attendre que le morceau devienne le morceau courant.

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
- **SPEC-5.7.4** `AutoFadeManager.getNextIndex()` (déclenché par l'évènement `crossfadeready` du player, indépendant du déclenchement `trackend`/Fil Rouge) NE boucle vers l'index `0` que si le mode boucle de la file (`getQueueLoopEnabled()`) est actif. Sinon, en fin de file, il retourne `-1` pour laisser le fallback Fil Rouge (déclenché ailleurs, sur `trackend`) prendre le relais — il ne doit jamais rejouer arbitrairement le début de la file.
- **SPEC-5.7.5** GIVEN le player est déjà en train de crossfader (`player.isCrossfading === true`, ex. un AutoMix manuel ou le fallback Fil Rouge sur `trackend` déjà en vol) — WHEN l'évènement `crossfadeready` déclenche `AutoFadeManager.handleReady()` — THEN ce second déclenchement est ignoré (`isPlayerCrossfading()` vérifié avant `perform()`), pour éviter qu'un crossfade concurrent soit silencieusement no-opé côté player (cf. SPEC-1.2.5) tout en corrompant l'état de la file avec un morceau jamais réellement devenu audible.

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

### 7.6 Auto BPM (synchronisation tempo continue)

- **SPEC-7.6.1** GIVEN le réglage `autoBpm` actif ET les deux platines en lecture — WHEN `SimpleMixFeatures#tick(activeDeck)` est appelé (depuis `#trackInterval` de `player.js`, `setInterval(..., 300)`) — THEN la platine inactive est ramenée vers `targetRate = clamp(1 + delta × 0.02, 0.94, 1.06)` (`delta` = écart de `currentTime` entre platine active et inactive) et la platine active est ramenée vers `1`, chacune via un lissage exponentiel dont le facteur par tick nominal (`300 ms`) est `0.2` (inactive) / `0.1` (active).
- **SPEC-7.6.2** GIVEN l'appel de `tick()` — THEN le facteur de lissage est corrigé par le temps réellement écoulé depuis l'appel précédent (`timeCorrectedEase(perTickFactor, elapsedMs)`, équivalent à `1 − (1 − perTickFactor)^(elapsedMs/300)`) plutôt qu'appliqué tel quel à chaque appel. Sans cette correction, le throttling du `setInterval` de `#trackInterval` en arrière-plan (navigateur réduisant la cadence des ticks) ralentit artificiellement la convergence des `playbackRate` vers leur cible, laissant le tempo d'une platine décalé (perçu comme un BPM qui diminue doucement) tant que l'app reste en arrière-plan ; au retour au premier plan, la cadence normale reprend et le rate rattrape sa cible en une fraction de seconde. Bug corrigé le 2026-07-27.

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

### 9.1 Identité du maître (pas de « session » serveur)

Il n'y a pas de session créée côté serveur : le maître est identifié par CET appareil,
via un identifiant permanent qu'il génère lui-même. Le serveur ne fait qu'auto-créer
l'entrée correspondante au premier `PUT /api/relay/state/:id` (aucun appel
`POST /api/relay/session` n'est effectué).

- **SPEC-9.1.1** `getOrCreateRelayMasterId()` (`lib/settingsStorage.js`) génère un
  identifiant court (6 caractères alphanumériques, `Math.random().toString(36)` — pas
  un hash des caractéristiques de l'appareil) au premier passage en mode Maître, et le
  persiste dans `localStorage` sous `dj-mix:relay:master-id`.
- **SPEC-9.1.2** Cet identifiant est permanent : il ne change jamais d'un
  rafraîchissement à l'autre, et n'est PAS effacé quand l'appareil repasse en mode
  Autonome (`_activateStandalone()` ne touche pas `dj-mix:relay:master-id`) — seul
  `dj-mix:relay:mode` (le rôle courant) est réinitialisé.
- **SPEC-9.1.3** Partage par QR code (librairie qrcodejs, 200×200, correction M) ou URL.
- **SPEC-9.1.4** Format URL : `${origin}${dir}relay?relay-master=${masterId}&relay-api=${apiUrl}&relay-relay=${relayUrl}&relay-token=${apiToken}`. `relay-api` cible l'API principale (recherche, `/api/search`) ; `relay-relay` cible le process relay autonome (état/commandes, cf. SPEC-9.1.6), reachable derrière la même URL de base que l'API via le reverse proxy (routage par chemin `/api/relay/...`, pas par port). Si `relay-relay` est absent (lien généré par une version antérieure), `relay.js` retombe sur `relay-api`.
- **SPEC-9.1.6** Le serveur relay (`/api/relay/*`) est un process autonome, détaché de l'API principale (process séparé depuis juillet 2026, initialement sur un port dédié), mais reachable derrière la même URL de base que l'API via un reverse proxy nginx qui route par chemin plutôt que par port. `getDownloaderRelayUrl()` (`lib/downloaderConfig.js`) dérive systématiquement cette URL depuis `getDownloaderApiUrl()` — même base URL (`deriveRelayUrlFromApiUrl`) — pas de configuration séparée en `localStorage`, contrairement à l'URL CDN (SPEC-11.2.4). `lib/relayModeManager.js` (maître ET relais applicatif complet) l'utilise pour toutes ses requêtes `/api/relay/*` (état, commandes, audio proxifié) ; `relay.js` (relais léger) l'utilise via le paramètre `relay-relay` pour l'état et les commandes, mais garde `relay-api` pour `/api/search`.
- **SPEC-9.1.5** Le relais léger (`relay.js`) génère lui aussi un identifiant d'appareil
  court (6 caractères alphanumériques, `Math.random().toString(36)` — pas un hash des
  caractéristiques du device) au premier chargement, persisté dans `localStorage` sous
  `dj-mix:relay:device-id` (clé distincte de `dj-mix:relay:master-id` pour éviter toute
  collision si un même appareil ouvre à la fois `index.html` en maître et `relay.html`
  en relais) et réutilisé tel quel indéfiniment. Envoyé dans `cmd.deviceId` sur chaque
  commande (`POST /api/relay/commands/:masterId`).
- **SPEC-9.1.7** Lors de la première génération de l'ID (maître `getOrCreateRelayMasterId()`
  ou relais léger `_getDeviceId()` dans `relay.js`), un appel best-effort à
  `navigator.storage.persist()` est effectué (aucune garantie ni prompt selon les
  navigateurs) pour réduire le risque que le navigateur purge le `localStorage` d'un
  appareil resté inactif plusieurs jours (ex. purge ITP de Safari après 7 jours
  d'inactivité, éviction sous pression de stockage) — sans quoi l'ID redeviendrait
  aléatoire à la prochaine génération, cassant la permanence visée par SPEC-9.1.2.
  N'est appelé qu'à la création (pas à chaque lecture) pour éviter les appels redondants.

### 9.2 Mode Maître

- **SPEC-9.2.1** État diffusé :
  ```
  {
    pushedAt,
    currentTrackId, currentIndex, isPlaying, activeDeck,
    deckA: { trackId, positionMs, volume },
    deckB: { trackId, positionMs, volume },
    queue: [{ id, name, artist, artUrl, duration, persistedSourceUrl, bpm, genre }],
    filRouge: [{ id, name, artist, artUrl, duration, persistedSourceUrl }],
    transitionMode, crossfadeMs, djMode
  }
  ```
- **SPEC-9.2.2** Endpoint : `PUT /api/relay/state/:id` sur le serveur relay autonome (SPEC-9.1.6), pas l'API principale.
- **SPEC-9.2.3** Debounce : `1000 ms` (`PUSH_DEBOUNCE_MS`).
- **SPEC-9.2.4** Déduplication par hash : `_hashState()` exclut `positionMs` pour éviter le spam. Inclut : currentTrackId, currentIndex, isPlaying, activeDeck, transitionMode, crossfadeMs, djMode, queue IDs, FX echo/distortion.

### 9.3 Mode Relais

- **SPEC-9.3.1** Polling : `GET /api/relay/state/:id` (serveur relay autonome, SPEC-9.1.6) toutes les `1500 ms` (`POLL_MS`). Premier poll immédiat.
- **SPEC-9.3.2** GIVEN un nouvel état reçu — THEN `onApplyRelayState(state)` est appelé pour synchroniser morceau, position, paramètres.
- **SPEC-9.3.3** GIVEN de nouveaux items dans queue/filRouge — THEN `onRelayQueueItemsAvailable(items)` déclenche le pré-téléchargement.
- **SPEC-9.3.3.1** GIVEN un morceau présent à la fois dans `queue` et `filRouge` de l'état relais reçu (trackStore partagé côté maître, cf. SPEC-2.6.1) — WHEN les items sont transmis à `onRelayQueueItemsAvailable` — THEN il n'est signalé qu'une seule fois (déduplication par `id`), évitant un double pré-téléchargement côté relais.
- **SPEC-9.3.4** Polling de commandes : toutes les `2500 ms`, âge max `60 000 ms`.
- **SPEC-9.3.5** GIVEN une commande `addToQueue` reçue du relais (boutons « Lire maintenant » / « Ajouter en suivant ») — THEN elle est déléguée à la file "incoming" (`relayIncomingQueue`, cf. §9.4) plutôt que traitée immédiatement : la piste n'est insérée dans la file d'attente qu'une fois téléchargée.
- ~~**SPEC-9.3.6 (ancien)** GIVEN la page relais est chargée et que l'utilisateur a appuyé pour initialiser l'AudioContext — THEN : (a) le polling de métadonnées démarre immédiatement ; (b) le flux audio n'est PAS démarré ; (c) le bouton `▶ Lancer le flux` est affiché.~~
- ~~**SPEC-9.3.7 (ancien)** GIVEN le bouton `▶ Lancer le flux` est cliqué — THEN l'audio suit l'état maître (moteur `AudioContext` local, decks, crossfade, correction de dérive).~~
- ~~**SPEC-9.3.8 (ancien)** GIVEN le bouton `⏹ Arrêter le flux` est cliqué — THEN l'audio local est mis en pause.~~
  (Supprimé : le relais léger n'a plus de lecture audio locale — seul le maître joue le
  son. Tout le moteur audio (`AudioContext`, decks, crossfade, filtre/écho/distortion,
  téléchargement/cache des fichiers audio, correction de dérive par
  `requestAnimationFrame`, événements planifiés `upcoming`) ainsi que
  `lib/relayStreamController.js` ont été retirés. Remplacé par SPEC-9.3.6 à 9.3.8
  ci-dessous.)
- **SPEC-9.3.6** Le relais léger (`relay.js`) ne télécharge ni ne met en cache aucun
  fichier audio, et n'initialise aucun `AudioContext`. Le polling de métadonnées démarre
  immédiatement au chargement de la page — aucun geste utilisateur n'est requis.
- **SPEC-9.3.7** L'écran relais n'affiche aucune mention "relais" ni aucun texte de
  statut de connexion — uniquement jaquette, titre/artiste en cours, progression et
  file d'attente. La progression est interpolée côté client par horloge murale
  (`Date.now()`) à partir de `positionMs`/`capturedAt` reçus du maître, recalée à
  chaque poll (1500 ms), et non par une horloge audio locale (aucune lecture audio sur
  le relais).
- **SPEC-9.3.8** La file d'attente affichée (`#relay-screen-queue-list`) provient de
  `state.queue` tronqué après `currentIndex` (`getUnreadQueue()`,
  `lib/relayQueueView.js`) ; affichage informatif seulement (pas d'action au tap),
  remplace l'ancien aperçu à un seul titre (`#relay-screen-next`).

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
- **SPEC-9.4.11** `cmd.deviceId` (cf. SPEC-9.1.5) est propagé par `relayIncomingQueue`
  jusque dans les entrées de log (`relay.incoming.now.rejected`,
  `relay.incoming.now.downloadFailed`, `relay.incoming.next.rejected`,
  `relay.incoming.next.downloadFailed`) afin d'identifier l'appareil à l'origine d'une
  commande sans authentification ni fingerprinting côté serveur.
- **SPEC-9.4.12** `triggerSearchFade()` déclenche l'AutoMix via un appel direct à
  `performAutoMix()` (fonction extraite du listener `click` du bouton AutoMix), **pas**
  via `autoMixBtn.click()`. Raison : `autoMixBtn.disabled` n'est remis à jour qu'au
  prochain `requestAnimationFrame` planifié par `renderQueue()` (cf. `_renderQueueRafId`),
  qui n'a pas forcément eu lieu au moment de l'appel — en particulier pour « Lire
  maintenant » depuis le relais, où `prefetchTrackToLocalCache()` a déjà téléchargé la
  piste avant `triggerSearchFade()`, donc `launchDeckFromQueue()` résout quasi
  instantanément (cache local) au lieu d'attendre un vrai téléchargement réseau — ce qui
  laissait le bouton encore `disabled` (car `queue.length` venait tout juste de passer de
  `1` à `2`) au moment du `.click()`, qui ne déclenche alors silencieusement aucun
  listener (comportement standard des boutons `disabled` dans le DOM). Symptôme observé :
  la piste apparaissait bien dans la file mais l'AutoMix ne se déclenchait pas. Corrigé en
  appelant directement `performAutoMix()`, indépendamment de l'état `disabled` du bouton.
  **Non couvert par un test unitaire** : `triggerSearchFade`/`performAutoMix` vivent dans
  `main.js` (pas dans `lib/`) et ne sont importés par aucun fichier de test existant (même
  lacune préexistante que SPEC-4.3.7/4.3.8, `tests/unit/specs/spec-4-search.test.js` n'a
  aucune couverture de `triggerSearchFade`).
- **SPEC-9.4.13** GIVEN une commande acceptée (« Lire maintenant » ou « Ajouter en
  suivant ») — THEN `prefetchMixData(cmd.track)` (câblé dans `main.js` sur
  `autoModeManager.fetchMixData(track.name, track.artist)`) est lancé en parallèle de
  `prefetchTrackToLocalCache()`, en tâche de fond (erreur ignorée, résultat non attendu).
  Raison : sans cet appel anticipé, `startPlaybackForIndex()` (`main.js`) ne déclenche son
  propre `fetchMixData()` (nécessaire au calcul de l'offset de démarrage zone-based) qu'au
  moment de lancer la lecture, et attend jusqu'à `700 ms` (`Promise.race` avec un
  `setTimeout`) sa résolution — un délai perceptible à chaque « Lire maintenant » demandé
  depuis le relais, même quand l'audio est déjà en cache local (`prefetchTrackToLocalCache`
  ayant déjà téléchargé la piste). Avec le prefetch anticipé, `fetchMixData()` est déjà
  résolu (ou en cours, avec un net avantage de tête) et servi depuis le cache mémoire
  (`MIX_DATA_CACHE`, `lib/autoModeManager.js`) au moment de `startPlaybackForIndex()`, ce
  qui élimine la majeure partie de l'attente. `createRelayIncomingQueue({ prefetchMixData })`
  accepte cette dépendance optionnelle (omise : comportement inchangé, cf. tests).
- **SPEC-9.4.14** GIVEN deux commandes « Ajouter en suivant » soumises par des appareils
  différents à des instants différents (`cmd.requestedAt`, horodatage posé par
  `relay.js` au moment du clic, ex. `Date.now()`) — WHEN elles arrivent au maître dans
  un ordre différent de leur `requestedAt` (latence réseau, lot de commandes récupéré
  en une seule fois par `GET /api/relay/commands/:sessionId`) — THEN `relayIncomingQueue`
  les réordonne par `requestedAt` croissant avant tout commit : une commande envoyée
  à 3h20 ne passe jamais devant une commande envoyée à 3h15, même si elle arrive ou
  termine son téléchargement en premier. Implémentation : `_nextSlots` est maintenu
  trié par insertion (`_insertSortedNext`, tri stable — à `requestedAt` égal, l'ordre
  d'arrivée est conservé) ; le commit FIFO (SPEC-9.4.4/9.4.5) s'applique ensuite sur ce
  tableau trié. GIVEN une commande sans `requestedAt` (relais ancienne version) — THEN
  elle est traitée comme soumise à l'instant présent (`Date.now()` au moment du
  traitement côté maître).
- **SPEC-9.4.15** Le téléchargement lancé par SPEC-9.4.3 (`prefetchTrackToLocalCache` →
  `downloadTrackViaApi`, `POST /api/download`) n'est **jamais** soumis à un timeout
  (pas de `AbortSignal.timeout`/`signal` sur cet appel `fetch`, contrairement à
  `/api/stems/*` ou au health-probe de `apiHealthMonitor.js`) et le slot occupé
  (« now » ou « next ») n'est **jamais** libéré/retiré par expiration d'une durée : seul
  un échec réel (`onError` appelé, ou la promesse résolue à `false`) libère le slot
  (SPEC-9.4.3). Raison : un ajout via relais peut légitimement prendre longtemps
  (réseau du relais, résolution/téléchargement côté serveur pour une piste jamais
  téléchargée) ; couper l'attente avec un timeout ferait disparaître la piste alors que
  l'utilisateur l'attend toujours, sans qu'aucun échec réel ne se soit produit.

### 9.5 Retour visuel côté maître (files "incoming"), directement dans la file d'attente

Le retour visuel sur l'état des files "incoming" (§9.4) est intégré à la file d'attente
principale (`#queue-list`) plutôt qu'affiché dans un panneau séparé sous le QR code — le
DJ regarde sa file, pas l'écran de partage du lien relais. Sans polling réseau : le maître
lit son propre `relayIncomingQueue` directement en mémoire.

- **SPEC-9.5.1** `relayIncomingQueue.getStatus()` expose, en plus de
  `nowPending`/`nextCount`/`nextMax` (SPEC-9.4.7), le détail des pistes en cours :
  `now: { name, artist, artUrl, deviceId } | null` (slot « Lire maintenant », `null` si
  libre) et `next: [{ name, artist, artUrl, deviceId, ready }]` (slots « Ajouter en
  suivant », dans l'ordre FIFO de soumission ; `ready: true` une fois le téléchargement
  résolu mais pas encore committé — slot pas encore en tête de file).
- **SPEC-9.5.2** `createRelayIncomingQueue({ onChange })` : callback optionnel invoqué à
  chaque mutation d'un slot (acceptation, téléchargement résolu/échoué, commit) —
  permet un rendu immédiat côté UI sans dépendre du polling `buildRelayStateSnapshot()`.
  `main.js` câble `onChange: () => renderQueue()` : toute mutation d'un slot redéclenche
  un rendu de la file d'attente.
- **SPEC-9.5.3** `lib/uiRenderer.js` (`buildQueueHTML`, option `getRelayIncomingStatus`)
  insère une ligne `.queue-incoming-row` par piste en attente, positionnée juste après la
  ligne `.queue-item.is-current` (ou en tête de liste si aucune piste n'est en cours,
  `currentIndex < 0`) : d'abord le slot « Lire maintenant » s'il est occupé
  (`.queue-incoming-row--now`), puis les slots « Ajouter en suivant » dans l'ordre FIFO
  (`.queue-incoming-row--next`). Chaque ligne affiche la jaquette, le titre, l'artiste, une
  étiquette (« Lire maintenant » / « Ajouter ensuite ») et un indicateur de chargement
  animé — remplacé par un ✓ (`.queue-incoming-status--ready`) pour un slot « Ajouter en
  suivant » dont le téléchargement est résolu mais pas encore en tête de file. Ces lignes
  n'ont pas de `data-index` ni la classe `.queue-item` : elles ne sont donc jamais
  ciblées par les handlers de clic/drag-and-drop de la file (`lib/queueDnD.js`), qui lisent
  `data-index` sur tout `.queue-item` — un item factice sans index casserait
  `reorderQueue`/`removeFromQueue` (`splice` avec un index `NaN`).
- **SPEC-9.5.4** Une teinte distincte marque chaque type de ligne : ambre
  (`var(--fade)`, cohérent avec `.queue-item.is-crossfading`) pour « Lire maintenant »
  (lecture imminente), bleu (`#2980b9`, cohérent avec `.relay-indicator--relay`) pour
  « Ajouter en suivant » (simple mise en file).
- **SPEC-9.5.5** GIVEN une ligne « incoming » affichée après l'item courant — WHEN la
  piste en cours change (`currentIndex` avance) avant la fin du téléchargement — THEN la
  ligne se repositionne automatiquement au rendu suivant juste après le nouvel item
  courant, car sa position est recalculée à chaque appel de `buildQueueHTML` à partir de
  `currentIndex` en direct, jamais mémorisée.

### 9.6 Retour visuel côté relais léger (files "incoming" et Fil Rouge à venir)

- **SPEC-9.6.1** L'état diffusé par `buildRelayStateSnapshot()` (§9.2.1) inclut
  `filRougeNext: { id, name, artist, artUrl } | null`, résolu via
  `filRougeManager.peekNextTrackFromAny()` (file prioritaire d'abord, puis playlist) —
  le morceau qui démarrerait si la file d'attente se vidait (cf. SPEC-3.1.4). `null` si le
  Fil Rouge est inactif ou ne peut pas déterminer de prochain morceau (shuffle sans loop en
  fin de playlist).
- **SPEC-9.6.2** `lib/relayModeManager.js#_hashState()` inclut l'`id` de `filRougeNext`
  ainsi qu'un condensé de l'état `ready` de chaque slot « Ajouter en suivant »
  (`relayIncoming.next[].ready`) — sans quoi une piste qui passe `ready:true` sans que
  `nextCount`/`nowPending` changent ne serait jamais republiée vers les relais (cf. le
  piège des 3 hash de dédoublonnage documenté en mémoire de session, déjà rencontré pour
  `relayIncomingNowPending`).
- **SPEC-9.6.3** `relay.js` affiche les mêmes placeholders « Lire maintenant »/« Ajouter en
  suivant » que le maître (SPEC-9.5.3/9.5.4), en tête de `#relay-screen-queue-list`, avant
  les titres réels de `getUnreadQueue()`. Ce rendu (`_updateQueueList`) tourne à chaque
  poll réussi, indépendamment du hash léger `_stateHash()` local à `relay.js` (qui ne gate
  que la mise à jour piste/position) — `nextCount`, l'état `ready` et la position peuvent
  changer sans que le reste de l'état bouge.
- **SPEC-9.6.4** GIVEN `state.filRougeNext` non nul — THEN un bloc `#relay-screen-filrouge`
  affiche « Fil rouge — à suivre » avec la jaquette, le titre et l'artiste du prochain
  morceau, indépendamment de l'état de la file d'attente (visible même si `#relay-screen-queue`
  est masqué faute d'items). GIVEN `filRougeNext` nul — THEN le bloc est masqué.
- **SPEC-9.6.5** Ce rendu est purement informatif (comme SPEC-9.3.8) : aucune action au tap,
  aucune requête réseau supplémentaire déclenchée pour l'afficher.

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
- **SPEC-11.2.3** Étape 2 (octets) : `GET /api/stream?cachePath=<cachePath>` sur le serveur CDN audio indépendant (`getDownloaderCdnUrl`, process séparé `audioCdnServer.js`), qui reste joignable même si l'API principale est occupée par une tâche longue. Reachable derrière la même URL de base que l'API via le reverse proxy (routage par chemin, pas par port). Le blob résultant est converti en `blob:` URL via `URL.createObjectURL(blob)`.
- **SPEC-11.2.4** `getDownloaderCdnUrl` : si l'utilisateur a configuré une URL CDN explicite (`localStorage`, clé `dj-mix:downloader:cdn:url`), elle est utilisée telle quelle ; sinon elle est dérivée automatiquement de l'URL de l'API, identique à celle-ci (`deriveCdnUrlFromApiUrl`, même base URL — le reverse proxy route CDN et API par chemin sur le même port).
- **SPEC-11.2.5** Le téléchargement d'un stem (`GET /api/stems/download?stem=...`) cible le CDN quand `item.cachePath` est connu (le CDN ne supporte pas la résolution par nom) ; sinon il retombe sur l'API principale, qui supporte encore la résolution par `trackName`/`artistName`.
- **SPEC-11.2.6** GIVEN un téléchargement résolu via l'étape 1 (orchestration) — WHEN la réponse contient un `cachePath` — THEN `item.cachePath` est mis à jour sur l'item (queue ou prefetch) avant de poursuivre, afin qu'un futur appel pour le même item bénéficie du raccourci SPEC-11.2.0 sans repasser par l'API principale.
- **SPEC-11.2.7** GIVEN `item.cachePath` inconnu — THEN avant l'étape 1 (orchestration), l'item est recherché dans la DB locale de paths (`trackPathDb`, cf. §11.5) via sa cache key (`id`, sinon `artist::name`, avec repli identique à SPEC-11.1.x) — si une correspondance existe, l'étape 1 est court-circuitée exactement comme SPEC-11.2.0 (streaming CDN direct), sans aucun appel réseau vers l'API principale.
- **SPEC-11.2.8** GIVEN l'étape 1 (orchestration) résout un `cachePath` — THEN, en plus de la mise à jour de l'item (SPEC-11.2.6), la DB locale de paths est mise à jour (`trackPathDb.set(cacheKey, cachePath)`), pour que le raccourci SPEC-11.2.7 s'applique dès le prochain morceau partageant la même clé — y compris après un rechargement de page ou dans une autre session du navigateur.

### 11.3 Cache

- **SPEC-11.3.1** Cache persistant : clé `https://dj-mix.local/cache-audio/${encodeURIComponent(cacheKey)}` dans `caches.open(audioCacheName)`.
- **SPEC-11.3.2** Cache session (in-memory Map) : max `12` entrées (`MAX_SESSION_BLOB_CACHE_ENTRIES`). Éviction FIFO.
- **SPEC-11.3.3** `releaseLocalBlob()` appelle `URL.revokeObjectURL()` sur les blob URLs (y compris stems).
- **SPEC-11.3.4** Clé de cache unifiée : `addToQueue` utilise `getTrackCacheKey(track)` comme `id` de l'item queue, garantissant la même clé que le fil rouge pour le cache persistant et session. Résolution : `track.id` → sinon `artist::name` (lowercased). En défense supplémentaire, `ensureLocalSource` et `isTrackInLocalCache` tentent aussi la clé `artist::name` en fallback si la clé primaire ne matche pas.
- **SPEC-11.3.5** GIVEN `apiHealthMonitor.isOffline()` est vrai — WHEN `ensureLocalSource` valide `item.persistedSourceUrl` (ou l'URL directe issue de `getDirectPlayableSourceUrl`) — THEN la vérification réseau (`canLoadAudioSource`, qui charge l'URL via un élément `<audio>`) est court-circuitée et l'URL est considérée jouable sans probe : une piste déjà connue comme locale (URL persistée d'une session précédente) ne doit pas être traitée comme manquante, ni déclencher une tentative de re-téléchargement via `POST /api/download`, simplement parce que le serveur local est injoignable au moment du contrôle.

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
| disabledTransitionModes | `dj-mix:transition:disabled-modes` |
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
| relayMasterId | `dj-mix:relay:master-id` |
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
| Downloader API URL | `https://192.168.8.149:8443` | — | — |
| Volume global | 1.0 | 0.0 | 1.0 |

### 12.4 Désactivation manuelle des modes de transition

- **SPEC-12.4.1** Le menu de config affiche une case à cocher par mode de transition (bloc « Transitions de mix »), à l'exception de `auto`, `cut_transition` (fallbacks garantis, jamais proposés) et des modes déjà désactivés en dur (`reverb_short_simple`, cf. SPEC-1.3.7).
- **SPEC-12.4.2** GIVEN une case décochée par l'utilisateur — THEN le mode correspondant est ajouté à `userDisabledTransitionModes`, persisté (`dj-mix:transition:disabled-modes`, JSON), et retiré de `allowedTransitionModes` : il n'est plus proposé dans le sélecteur manuel « Mode AutoMix » ni tiré au sort en mode `auto`.
- **SPEC-12.4.3** GIVEN le mode de transition actuellement sélectionné qui devient désactivé — THEN le réglage retombe automatiquement sur un mode autorisé via `getSafeAllowedTransitionMode` (repli sur `auto` si disponible), avec un toast de confirmation.
- **SPEC-12.4.4** La désactivation manuelle se cumule avec le filtre RAM (SPEC-1.3.4) : un mode est disponible seulement s'il n'est exclu ni par le budget RAM, ni par `DISABLED_TRANSITION_MODES`, ni par `userDisabledTransitionModes`.

### 12.5 Vider le cache local

- **SPEC-12.5.1** `clearLocalCache()` (`lib/settingsController.js`) est appelée par le bouton `#clear-cache-btn`. THEN `clearPersistedBlobs()` (→ `audioSourceManager.clearAllPersistedBlobs`, IndexedDB `dj-mix-blobs`) est appelé inconditionnellement, le cache mémoire (`sessionBlobCache`) est vidé, et le toast `Cache local vidé` est affiché. GIVEN la Cache Storage API aussi disponible (`'caches' in window`) — THEN l'ancien bucket `AUDIO_CACHE_NAME` (legacy, utilisateurs HTTPS avec d'anciennes entrées) est également supprimé via `caches.delete()`.
- **SPEC-12.5.2** BUG CORRIGÉ (juillet 2026) : `clearLocalCache()` dépendait auparavant entièrement de la Cache Storage API, absente en contexte non sécurisé (IP LAN en HTTP — `192.168.x.x`/`10.x.x.x` — le mode de déploiement réel de l'app), et se contentait alors d'un toast d'avertissement sans rien vider de significatif. IndexedDB (SPEC-13.1.4) n'ayant pas cette restriction, le nettoyage réussit désormais pleinement dans ce contexte aussi : `clearPersistedBlobs()` ne dépend d'aucune disponibilité de `window.caches`.
- **SPEC-12.5.3** GIVEN une erreur levée pendant `clearPersistedBlobs()` ou `caches.delete()` — THEN un toast d'erreur `Erreur suppression cache: <message>` est affiché.

### 12.6 Test de connexion API downloader (contenu mixte)

- **SPEC-12.6.1** `isLikelyMixedContentBlock(err, baseUrl, isSecureContext)` (`lib/downloaderConfig.js`) détecte le blocage navigateur « contenu mixte » : GIVEN une erreur `TypeError: Failed to fetch`, une `baseUrl` en `http://` sur un hôte non local (ni `localhost`, ni `127.0.0.1`, ni `[::1]`), ET `isSecureContext === true` (page courante en HTTPS, ex. déploiement GitHub Pages ou PWA installée ; passé explicitement par l'appelant via `window.isSecureContext`, même pattern que `clearLocalCache()` en 12.5) — THEN la fonction retourne `true`.
- **SPEC-12.6.2** GIVEN l'URL API est `localhost`/`127.0.0.1`, OU l'URL API est en `https://`, OU l'erreur n'est pas un `TypeError: Failed to fetch`, OU `isSecureContext` est faux — THEN `isLikelyMixedContentBlock` retourne `false`.
- **SPEC-12.6.3** `describeApiTestError(err, baseUrl, isSecureContext)` retourne un message explicite (« Bloqué par le navigateur (contenu mixte)… ») quand `isLikelyMixedContentBlock` est vrai, sinon retourne `err.message` tel quel.
- **SPEC-12.6.4** Le bouton « Tester » du panneau de config (`testBtn` dans `createDownloaderConfigManager`) appelle `describeApiTestError(err, getDownloaderApiUrl(), window.isSecureContext)` pour construire le toast `Serveur indisponible: <message>`, évitant d'afficher un simple « Failed to fetch » indiscernable d'un serveur réellement injoignable quand la vraie cause est le blocage HTTPS→HTTP du navigateur.

---

## 13. PWA et intégration mobile

### 13.1 Service Worker

- **SPEC-13.1.1** Cache nommé `djmix-v{version}`. 56+ fichiers cachés (main.js, style.css, tous les lib/*.js).
- **SPEC-13.1.2** Exclusions : requêtes cross-origin, requêtes `/api/`, requêtes Spotify/CDN.
- **SPEC-13.1.3** Navigation : les query params sont strippés pour permettre les paramètres relay.
- **SPEC-13.1.4** BUG CORRIGÉ (juillet 2026) : la persistance locale des morceaux téléchargés (audio + artwork) reposait sur la Cache Storage API (`window.caches`, bucket `dj-mix:audio-cache:v1`), qui **n'existe que dans un contexte sécurisé** (HTTPS, ou spécifiquement `localhost`/`127.0.0.1`) — elle est totalement absente quand l'app est ouverte via une IP LAN en HTTP simple (ex. `http://192.168.x.x:8000` depuis un téléphone sur le même réseau, le mode de déploiement réel de l'app via `npm run start:local`). Résultat : rien ne persistait jamais dans ce contexte, malgré `item.cachePath` connu côté serveur — chaque lecture repartait sur le réseau. Le stockage a été migré vers IndexedDB (base `dj-mix-blobs`, `lib/blobStore.js`, deux object stores `audio`/`artwork` clés par `getTrackCacheKey`/`trackKey`, valeurs = `Blob` stockés directement) : `indexedDB`, contrairement à `caches`, n'a pas de restriction de contexte sécurisé — ce repo s'appuie déjà sur ce fait ailleurs (`lib/downloadBatchStore.js`, `mix-blind-test/stem-client.js`). `persistAudioBlob`/`restorePersistedAudioBlobUrl`/`persistArtworkBlob`/`restorePersistedArtworkBlobUrl` (`lib/audioSourceManager.js`) délèguent désormais à un `blobStore` injectable (option `blobStore` de `createAudioSourceManager`, défaut `createBlobStore()`) au lieu de `caches.open`/`cache.put`/`cache.match`. `deleteLocalCacheSong` évince aussi le blob local (audio + artwork) correspondant après un succès de suppression serveur (`blobStore.deleteBlob`), ce qui n'existait pas avant. Tests : `dj-mix/tests/unit/blobStore.test.js`, cas dédiés dans `dj-mix/tests/unit/audioSourceManager.test.js` (describe `SPEC-13.1.4 / SPEC-13.3.9`).
- **SPEC-13.1.5** Notifications : notification du nombre de succès/échecs en fin de téléchargement.

### 13.2 Installation

- **SPEC-13.2.1** Installable via prompt Chrome/Edge (manifest PWA).
- **SPEC-13.2.2** Packaging APK via Capacitor.
- **SPEC-13.2.3** GIVEN une release semantic-release — THEN `dj-mix/sw.js` (constante `CACHE`, format `djmix-v<version>`) et `dj-mix/version.js` sont mis à jour par `.github/scripts/sync-match3-version.mjs` ET committés par `@semantic-release/git` (présents dans sa liste `assets` de `.releaserc.json`). Sans ce commit, `sw.js` déployé sur GitHub Pages reste identique octet par octet : le navigateur ne réinstalle jamais le service worker, et les PWA installées continuent de servir indéfiniment l'ancien `main.js`/`lib/*` depuis le cache `djmix-v<ancienne version>` (stratégie cache-first) — les correctifs déployés n'atteignent alors jamais les téléphones. Régression réelle : `dj-mix/sw.js` et `dj-mix/version.js` manquaient de la liste `assets` entre le 14 juillet et le 24 juillet 2026 (versions figées à `djmix-v1.229.3`/1.218.x alors que la racine était en 2.11.0).

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
- **SPEC-13.3.9** GIVEN `POST /api/download` renvoie un `artworkUrl` au format `/api/artwork?cachePath=...` (jaquette iTunes/Deezer mirrorée par le backend sur son propre CDN, avec CORS) — WHEN `ensureLocalSource` OU `prefetchTrackToLocalCache` reçoit ce résultat via `downloadTrackViaApi` — THEN `resolveCdnArtworkUrl` construit l'URL absolue (base CDN + token) et, si elle diffère de `item.artUrl`, celui-ci est mis à jour et persisté via `persistArtUrl` (→ `trackStore.patch`). Raison : les CDN tiers (mzstatic.com, dzcdn.net) n'envoient pas `Access-Control-Allow-Origin`, donc une `<img>` les affiche mais ni `fetch()` (conversion data URI, SPEC-13.3.2) ni le décodage interne de Media Session ne peuvent les lire — Android retombe alors sur l'icône de l'app dans la notification système à la place de la jaquette. Router vers le CDN maison (CORS permissif) corrige ce cas. Les deux points d'appel sont nécessaires : une fois qu'un morceau a un `cachePath` connu (qu'il vienne d'un pré-téléchargement ou d'une lecture précédente), `downloadTrackViaApi` prend le raccourci direct-vers-CDN et ne repasse plus jamais par `POST /api/download`, donc `prefetchTrackToLocalCache` doit appliquer la mise à niveau au même titre qu'`ensureLocalSource`. `startPlaybackForIndex` ré-invoque `updateNowPlaying` après `ensureLocalSource` si l'`artUrl` a changé, car son premier appel a lieu avant la résolution de la source locale. Limite connue (comblée par SPEC-13.3.10) : sans elle, les morceaux déjà téléchargés avant ce correctif resteraient figés sur l'URL brute, `cachePath` déjà connu court-circuitant `POST /api/download`.
- **SPEC-13.3.10** GIVEN un morceau déjà téléchargé avant SPEC-13.3.9 (donc `item.cachePath` déjà connu) dont l'`artUrl` est encore une URL tierce brute (`isStuckRemoteArtworkUrl` : `http(s)://` et ne contient pas `/api/artwork`) — WHEN `downloadTrackViaApi` emprunte l'un des deux raccourcis direct-vers-CDN (`item.cachePath` déjà présent, ou résolu via `trackPathDb`) — THEN `maybeRefreshStuckArtwork` déclenche en tâche de fond (fire-and-forget, sans bloquer la lecture ni ré-attendre l'audio) un `POST /api/download` allégé (métadonnées seulement, le backend sert son raccourci "déjà téléchargé localement") ; si la réponse contient une référence CDN différente, `item.artUrl` est mis à jour et persisté via `persistArtUrl`. Un `Set` en mémoire (`artworkRefreshAttempted`, par cache key) évite de retenter à chaque lecture du même morceau dans la session ; un échec retire l'entrée du Set pour permettre une nouvelle tentative plus tard. Comme ce refresh se termine après le démarrage de la lecture, le callback `persistArtUrl` (main.js) rappelle `updateNowPlaying(deckItem, focusDeck)` immédiatement si la piste corrigée est la piste courante (`uiState.currentTrackId`) et occupe le deck focus — la notification système se met à jour en cours de lecture au lieu d'attendre la lecture suivante. Aucune tentative si `apiHealthMonitor.isOffline()`. Côté backend (`Spotify-mp3-downloader/script.js`), les trois raccourcis "déjà en cache" (`existingLocalFile`, `cachedTrackEntry`, `nearDuplicateEntry`) appellent désormais `ensureMirroredArtworkUrl` avant de répondre : si l'`artworkUrl` stocké dans le sidecar est encore une URL tierce brute, `cacheRemoteArtwork` (déjà utilisé pour les téléchargements neufs) la mirrore sur le CDN maison et réécrit le sidecar — sans quoi le raccourci se contentait de renvoyer indéfiniment l'URL brute stockée. Combiné, un morceau déjà en bibliothèque se corrige tout seul à la prochaine lecture, sans devoir le supprimer/re-télécharger ni lancer manuellement `scripts/backfill-artwork-cdn.js`.
- **SPEC-13.3.11** GIVEN `GET /api/cache/files` renvoie un `artworkUrl` encore au format brut `/api/artwork?cachePath=...` (bibliothèque en cache, panneau "Bibliothèque") — WHEN un fichier de ce panneau est ajouté à la file (`playlistManager.addCacheFileToQueue`) ou lancé en fondu direct (`main.js` `triggerCacheFade`) — THEN `resolveCacheFileArtUrl` (playlistManager.js, réutilise `resolveCdnArtworkUrl` extrait dans downloaderConfig.js) préfixe cette référence avec l'URL CDN (+ token) avant de l'assigner à `item.artUrl`, exactement comme `resolveCdnArtworkUrl` le fait déjà pour `downloadTrackViaApi`/`prefetchTrackToLocalCache` (SPEC-13.3.9). Bug corrigé : ces deux points d'entrée assignaient jusqu'ici `file.artworkUrl` tel quel à `item.artUrl`, sans jamais passer par la résolution CDN — un `<img src="/api/artwork?cachePath=...">` est alors résolu par le navigateur contre l'origine de la page elle-même (ex. le déploiement GitHub Pages) au lieu du CDN, d'où un 404 sur `https://<origine-app>/api/artwork?...`. `isStuckRemoteArtworkUrl` (SPEC-13.3.10) ne rattrapait pas ce cas non plus : son test `http(s)://` ne matche pas une référence relative. `trackStore.isDeadPersistedArtUrl` traite désormais aussi un `artUrl` déjà persisté sous cette forme brute comme mort (au même titre qu'un `blob:`), pour que les entrées affectées avant ce correctif se corrigent d'elles-mêmes à la prochaine restauration au lieu de rester bloquées indéfiniment.
- **SPEC-13.3.12** GIVEN une référence `/api/artwork?cachePath=...` déjà correctement résolue (base CDN + token) mais dont le fichier mirroré a été évincé du cache disque du CDN (nettoyage, pression disque…) — WHEN son chargement échoue (404) via l'un des trois points d'observation existants — l'`<img>` du deck en focus (`focusArt.onerror`), l'`<img>` du deck inactif/à venir (`inactiveArt.onerror`), ou le `fetch()` de conversion data URI pour Media Session (`_fetchArtworkDataUri` dans `updateNowPlaying`, `!response.ok`) — THEN `uiRenderer` appelle `onArtworkLoadFailed(item)` (nouveau callback injecté depuis `main.js`), qui délègue à `audioSourceManager.handleArtworkLoadError`. Cette fonction réutilise le même self-heal que SPEC-13.3.10 (`attemptArtworkSelfHeal` / `refreshStuckArtworkInBackground`) : un `POST /api/download` (métadonnées seulement) force le backend à re-résoudre l'artwork depuis l'origine (iTunes/Deezer) et à re-mirrorer le fichier sur son disque, ce qui répare le `cachePath` mort — que la référence renvoyée soit identique (même fichier réécrit au même endroit) ou différente (auquel cas `item.artUrl` est mis à jour et persisté via `persistArtUrl`). Ne se déclenche que si `item.artUrl` contient déjà `/api/artwork` (sinon c'est le cas SPEC-13.3.10 qui s'applique) ; le même `Set` `artworkRefreshAttempted` (par cache key) évite de retenter plusieurs fois par session, et aucune tentative n'est faite si `apiHealthMonitor.isOffline()`.
- **SPEC-13.3.13** BUG CORRIGÉ (juillet 2026) : `persistArtwork`/`restoreArtwork` (octets d'artwork, `lib/audioSourceManager.js`) existaient déjà mais n'étaient quasiment jamais atteints en pratique — leurs deux seuls points d'appel (`fetchFilRougeArtwork`, `fetchAndStoreArtworkForItem` dans `main.js`) court-circuitaient dès que `item.artUrl` était déjà renseigné, ce qui est le cas pour la quasi-totalité des morceaux (recherche, import Spotify, onglet Cache, réponse de `POST /api/download`) : seule l'URL (texte) était alors mémorisée (`persistArtUrl`/`artworkUrlCache.js`), jamais les octets de l'image — chaque affichage d'une pochette retéléchargeait l'image, même quand l'audio était bien caché localement. Corrigé à deux niveaux : (1) `lib/artworkPersistence.js` (`resolveArtworkForItem`) vérifie désormais le blob local **avant** tout court-circuit sur une `artUrl` distante déjà connue, et comble le cache en arrière-plan (`persistArtwork`) quand une `artUrl` distante existe sans blob local — câblé dans `fetchFilRougeArtwork`/`fetchAndStoreArtworkForItem` ; (2) `streamCachedTrackFromCdn` (le point de passage unique de tout téléchargement audio — raccourci `cachePath` connu, raccourci `trackPathDb`, orchestration complète) persiste désormais aussi l'artwork (`extra.artworkUrl || item.artUrl`) à chaque téléchargement, pas seulement dans le cas restreint où l'item n'avait encore aucune `artUrl`. `playlistManager.addCacheFileToQueue` (ajout depuis l'onglet Cache) persiste aussi les octets de l'artwork qu'il résout via `resolveCacheFileArtUrl`. Tests : `dj-mix/tests/unit/artworkPersistence.test.js`, cas dédié dans `dj-mix/tests/unit/audioSourceManager.test.js` ("persists both audio and artwork bytes on download, even when cachePath (and artUrl) were already known").

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
- **SPEC-14.1.2** Aucun bouton local (Low-pass / High-pass / Suggestion AutoDJ) n'est affiché au-dessus des platines. Les filtres low-pass/high-pass restent pilotables via les modes de transition AutoMix (`filter_sweep_low_high`, etc.) et le menu FX DJ ; le renouvellement de suggestion AutoDJ reste piloté par `refreshAutoSuggestionForCurrentTrack()` en arrière-plan.
- **SPEC-14.1.3** GIVEN un clic/tap sur la carte d'une platine (hors bouton, curseur, ou barre de progression) — WHEN la platine est en lecture — THEN elle se met en pause ; WHEN elle est en pause avec une source chargée — THEN elle reprend ; WHEN elle n'a pas de source chargée — THEN le morceau suivant de la file y est lancé. Ce comportement est indépendant du pourcentage de volume ou de la position de la platine dans le mix global (crossfade).

### 14.2 Rendu

- **SPEC-14.2.1** Queue, playlists et Fil Rouge rendus dynamiquement via `uiRenderer`.
- **SPEC-14.2.2** Drag-and-drop sur les éléments de la queue.
- **SPEC-14.2.3** Notifications toast pour actions et erreurs.
- **SPEC-14.2.4** Chaque platine affiche sous la barre de progression le temps actuel et la durée totale du morceau au format `m:ss / m:ss` (via `formatTime(positionMs) / formatTime(durationMs)`). L'affichage est masqué si aucun morceau n'est chargé (`durationMs = 0`).
- **SPEC-14.2.5** GIVEN le menu mix est réduit (classe `mix-options-collapsed` sur `#tab-mix`) — WHEN `#dj-plan-section` serait autrement visible — THEN il reste masqué. Il redevient visible dès que le menu mix est déplié, selon son propre état (`updateDjPlanIndicator()`).
- **SPEC-14.2.6** Le titre du morceau (`.deck-track-title`) s'affiche sur une seule ligne, avec ellipsis si trop long, sur toute la largeur de la carte platine. Le nom de l'artiste (`.deck-track-artist-name`) s'affiche en dessous, dans une police plus petite, également sur une seule ligne. La troncature s'adapte à la largeur réelle de la platine (`.deck-panel` a `min-width: 0`, requis car c'est un item de grille CSS — sans quoi un titre long empêcherait la colonne de rétrécir et l'ellipsis ne s'appliquerait jamais).

### 14.3 Localisation

- **SPEC-14.3.1** L'interface est intégralement en français.

### 14.4 Volume global

- **SPEC-14.4.1** Un curseur de volume global (`#global-volume-slider`, `0`–`100`) est affiché dans la section player, sur la même ligne que le bouton « Afficher/cacher le menu mix » (`#toggle-mix-menu-btn`), au-dessus du crossfade slider de mix.
- **SPEC-14.4.2** Un bouton mute (`#global-volume-btn`) permet de couper / rétablir le son en un clic. GIVEN volume > 0 — WHEN clic — THEN `globalVolume = 0` (icône 🔇). GIVEN volume = 0 — WHEN clic — THEN restaure le volume précédent.
- **SPEC-14.4.3** GIVEN `globalVolume = v` — WHEN `#applyDeckBaseMix(baseA, baseB)` est appelé — THEN les volumes effectifs des platines sont `nextA × v` et `nextB × v` (`v ∈ [0, 1]`).
- **SPEC-14.4.4** Le volume global est persisté dans `localStorage` sous la clé `dj-mix:global-volume`. Défaut : `1.0`.
- **SPEC-14.4.5** L'icône du bouton reflète le niveau : `🔇` si `v = 0`, `🔉` si `v < 0.5`, `🔊` sinon.

---

## 15. Monitoring et résilience

### 15.1 Santé de l'API

- **SPEC-15.1.1** `apiHealthMonitor` suit l'état online/offline. Les transitions déclenchent des callbacks.
- **SPEC-15.1.2** `apiHealthMonitor.probe()` déclenche une vérification immédiate de `/health`, quelle que soit l'état courant (online ou offline). Appelé sur `visibilitychange → visible` pour détecter rapidement toute perte de connexion survenue pendant que l'écran était éteint.
- **SPEC-15.1.3** `apiHealthMonitor.checkNow()` : contrôle ponctuel appelé une seule fois, au tout début de `init()` (avant `restoreQueue()` et toute résolution de source audio). Contrairement à `recordFailure()` qui nécessite `failureThreshold` échecs consécutifs, un seul échec de `/health` (réponse non-`ok` ou exception réseau) fait basculer directement en offline. But : détecter un serveur local déjà éteint dès le rechargement de page, avant que la lecture d'une piste ne consomme inutilement ses premières tentatives réseau (cf. SPEC-11.3.5).

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
{ pushedAt,
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
- **SPEC-19.8.4** Au démarrage, la synchronisation initiale du fil rouge ne doit jamais se baser sur `filRougeTrackStatusByKey` seul pour décider des morceaux à télécharger ; elle doit utiliser `getFilRougeTrackStatus(item)` afin d'honorer la persistance `localStorage` après rechargement.

## 20. Mise à jour forcée de la PWA

- **SPEC-20.1** Bouton `#btn-force-update` dans le bloc "Application PWA" de Config, toujours visible (pas de `hidden` — contrairement à `#btn-install-pwa`/`#btn-apk-update`). Au clic, appelle `forceUpdatePwa()` (`pwa.js`).
- **SPEC-20.2** `forceUpdatePwa()` désinscrit tous les service workers actifs (`navigator.serviceWorker.getRegistrations()` + `unregister()` sur chacun) et vide les caches d'assets applicatifs (`caches.keys()` + `caches.delete()` sur chacun), **à l'exception du cache audio** `dj-mix:audio-cache:v1` qui est intentionnellement préservé pour ne pas obliger l'utilisateur à re-télécharger tous ses morceaux après une mise à jour, puis recharge la page (`location.reload()`) — y compris si une des étapes échoue (`try/finally`). La constante `AUDIO_CACHE_NAME = 'dj-mix:audio-cache:v1'` dans `pwa.js` doit rester synchronisée avec `AUDIO_CACHE` dans `sw.js`. Objectif : contourner un Service Worker resté bloqué avec l'ancien code malgré `updateViaCache: 'none'` et l'écoute de `controllerchange` (SPEC existant `initServiceWorker`).
- **SPEC-20.3** Après le rechargement, `initServiceWorker()` réinscrit un Service Worker neuf qui retélécharge tous les `ASSETS` de `sw.js` (plus aucun cache ni SW préexistant ne peut servir une version périmée).
- **SPEC-20.4** BUG CORRIGÉ (juillet 2026) : le handler `activate` de `sw.js` supprimait auparavant **tous** les caches dont la clé différait de `CACHE` (le cache d'app-shell courant, ex. `djmix-v2.18.0`), y compris le cache audio persistant `dj-mix:audio-cache:v1` (SPEC-13.1.4) et tout autre cache. Comme `CACHE` embarque le numéro de version et change à **chaque release** (semantic-release bump `sw.js` sur quasiment chaque merge), cette purge automatique s'exécutait à chaque activation d'un nouveau Service Worker, effaçant les morceaux du fil rouge et de la file d'attente déjà téléchargés côté navigateur — obligeant un re-téléchargement complet, en contradiction avec l'intention déjà documentée en SPEC-20.2 pour le bouton "Mise à jour forcée". Le handler `activate` ne supprime désormais que les clés de cache préfixées `djmix-v` (anciennes versions de l'app shell) différentes de `CACHE` ; tout cache utilisant un autre espace de nommage (`dj-mix:audio-cache:v1`, etc.) est systématiquement préservé, sans dépendre d'une liste d'exclusion explicite. Test : `tests/unit/sw.test.js`.
