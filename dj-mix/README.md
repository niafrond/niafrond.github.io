# dj-mix architecture

## Modules

- `lib/transitionModes.js`: catalogue des transitions + estimation RAM.
- `lib/ramProfile.js`: profil RAM appareil et filtrage des modes selon budget.
- `lib/storageKeys.js`: cles centralisees (localStorage).
- `lib/settingsStorage.js`: lecture/ecriture des settings UI.
- `lib/autoDjFxManager.js`: configuration Auto DJ FX, normalisation des intervalles, cooldown/gating.
- `lib/mixFeatures.js`: moteur effets audio (WebAudio / stems / M-S), sans logique de persistance.
- `lib/appState.js`: point d'entree pour les sous-etats transverses (queue DnD, timeline automix).
- `lib/queueDnD.js`: gestion des interactions drag/drop + activation d'item de queue.
- `lib/automixTimeline.js`: etat et helpers de declenchement automix.
- `lib/deckHelpers.js`: utilitaires de normalisation deck A/B.

## Integration actuelle

- `main.js` orchestre encore l'application, mais lit/ecrit ses settings uniquement via `settingsStorage`.
- Le filtrage RAM est calcule via `ramProfile`.
- Les decisions de cooldown Auto FX passent par `autoDjFxManager`.

## Transitions

| Mode | Label | RAM extra (Mo) | Overlap |
|------|-------|:--------------:|:-------:|
| `auto` | Auto (meilleur) | 0 | 0 |
| `crossfade_linear` | Crossfade lineaire | 18 | 1.0 |
| `crossfade_logarithmic` | Crossfade logarithmique | 20 | 1.02 |
| `fade_in_out` | Fade in / Fade out | 24 | 1.05 |
| `cut_transition` | Cut transition | 6 | 0.12 |
| `filter_sweep_low_high` | Filter sweep (low-pass / high-pass) | 96 | 1.2 |
| `eq_transition_simple` | EQ transition simple | 44 | 1.08 |
| `echo_out_light` | Echo out leger | 128 | 1.35 |
| `reverb_short_simple` | Reverb courte et simple | 172 | 1.55 |
| `short_loop` | Loop courte | 108 | 1.22 |
| `brake_tape_stop_simple` | Brake / tape stop simple | 58 | 1.12 |
| `short_reverse` | Reverse court | 122 | 1.24 |
| `sidechain_basic` | Sidechain basique | 52 | 1.1 |
| `volume_ducking` | Volume ducking | 40 | 1.06 |
| `gain_automation` | Automation de gain | 34 | 1.0 |
| `filter_automation` | Automation de filtre | 104 | 1.25 |
| `crossfade_lowpass` | Crossfade + Low-pass sortant | 140 | 1.18 |
| `crossfade_highpass_in` | Crossfade + High-pass entrant | 118 | 1.12 |
| `filter_dual_sweep` | Double filtre (low/high swap) | 178 | 1.35 |
| `echo_lowpass` | Echo + Low-pass sortant | 216 | 1.45 |
| `bass_swap` | Bass swap (echange des graves) | 175 | 1.30 |
| `kick_swap` | Kick swap (echange des kicks) | 145 | 1.25 |
| `beat_repeat` | Beat repeat (boucle acceleree) | 112 | 1.20 |
| `backspin` | Backspin (vinyl stop) | 85 | 0.95 |
| `echo_freeze` | Echo freeze (echo gele) | 195 | 1.48 |

## DJ FX

| Action | Description | Duree (ms) | Type |
|--------|-------------|:----------:|------|
| `filter` | Cycle low-pass / high-pass / off sur le deck actif | — | Toggle |
| `lowPass` | Active/desactive le filtre low-pass | — | Toggle |
| `highPass` | Active/desactive le filtre high-pass | — | Toggle |
| `vocalRemove` | Suppression des voix (stems) | — | Toggle |
| `instruRemove` | Suppression de l'instrumental (stems) | — | Toggle |
| `echoDelay` | Echo / Delay on/off | 1200 | Toggle |
| `reverb` | Reverb courte (echo + distortion temporaires) | 1200 | Transient |
| `roll` | Loop roll courte (220 ms, boucle rapide) | 1000 | Transient |
| `loop` | Loop longue (520 ms, boucle etendue) | 2600 | Transient |
| `beatRepeat` | Beat repeat (140 ms, seek instantane) | 900 | Transient |
| `brake` | Brake / tape stop (ralentissement progressif) | 900 | Transient |
| `backspin` | Backspin (recul rapide + acceleration) | 1200 | Transient |
| `noise` | Bruit vinyle + sample synthetique | 800 | Transient |
| `eq` | Cycle EQ + transition AutoMix | — | Toggle |
| `keyShift` | Key shift (+3.5% temporaire) | 1800 | Transient |
| `scratching` | Son de scratch vinyle | 450 | Transient |
| `hotCues` | Saut au prochain hot cue du deck | 450 | Transient |
| `loopCue` | Loop cue (retour au cue precedent, repete N fois) | ~3400 | Transient |
| `sampling` | Sample audio reel (airhorn/stab/laser/siren) | 500 | Transient |

## Regle de taille module

Soft limit recommandee: 350 lignes par module (`lib/*.js`).

Quand un module depasse la limite:
- extraire les utilitaires purs d'abord,
- puis isoler la persistance et les adaptateurs UI,
- garder le module principal focalise sur l'orchestration.
