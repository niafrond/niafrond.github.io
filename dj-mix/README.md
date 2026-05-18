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

## Regle de taille module

Soft limit recommandee: 350 lignes par module (`lib/*.js`).

Quand un module depasse la limite:
- extraire les utilitaires purs d'abord,
- puis isoler la persistance et les adaptateurs UI,
- garder le module principal focalise sur l'orchestration.
