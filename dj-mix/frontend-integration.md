# Spec d'intégration front — dj-mix ↔ dj-planner

**Destinataires**: équipe front du lecteur `niafrond.github.io/dj-mix`.

**But de ce document**: permettre au front `dj-mix` de consommer l'API `dj-planner` (décisions de
mix, plans de playlist, preuves d'usage réel) sans avoir à lire l'ensemble du spec-kit backend.
Référence normative complète : [`contracts/api.md`](contracts/api.md) et
[`data-model.md`](data-model.md) — ce document les résume et ajoute les contraintes propres à
l'intégration front (réseau, UX, gestion d'erreurs). En cas de divergence, `contracts/api.md`
fait foi.

## 1. Modèle d'architecture — ce qui change, ce qui ne change pas

- `dj-planner` est un **backend local**, un par DJ, tournant sur la machine du DJ et exposé via un
  reverse proxy nginx local (le front n'adresse jamais le processus FastAPI directement, ni un
  port applicatif). Ce n'est **pas un service cloud partagé** : il n'y a pas de compte, pas
  d'authentification, pas de multi-utilisateur. Chaque utilisateur de `dj-mix` doit avoir sa propre
  instance `dj-planner` démarrée sur sa machine pour que l'intégration fonctionne.
- `dj-mix` reste responsable de : la lecture audio, l'UI, l'exécution effective des effets/EQ en
  temps réel, le catalogue `MIX_TRANSITION_MODES` (`lib/transitionModes.js`). `dj-planner` ne
  pilote jamais le matériel de mix — il retourne un **plan** que `dj-mix` doit interpréter et
  exécuter.
- `dj-planner` est responsable de : toute décision de mix (compatibilité, type de transition,
  points d'entrée/sortie, EQ, effets, confiance), toute optimisation de playlist, toute preuve
  d'usage réel (DJ ayant déjà joué cet enchaînement). **Le front ne doit jamais recalculer ou
  deviner une décision de mix lui-même** — il affiche ce que l'API retourne (Principe I/II de la
  constitution backend).
- Le catalogue `transition_type` retourné par l'API est **le même catalogue** que celui déjà
  utilisé par `dj-mix` (`transitionModes.js`, mirroré côté backend dans
  `transition_planner/transition_modes.py`). Aucune table de correspondance à écrire côté front —
  mais toute évolution de ce catalogue doit être faite **des deux côtés en même temps** (une
  valeur hors catalogue est silencieusement ramenée à `auto`, donc une désynchronisation fait
  perdre la recommandation sans erreur visible).

## 2. Connexion réseau (bloquant — à traiter en premier)

Le backend est servi derrière un reverse proxy nginx local — le front doit toujours passer par
l'URL exposée par ce proxy, jamais directement par une adresse/port applicatif. Cette URL de base (notée
`<DJ_PLANNER_BASE_URL>` ci-dessous) est propre à l'installation locale de chaque DJ et doit être
configurable côté `dj-mix` (ex. `localStorage`), jamais codée en dur.

**Statut actuel du backend** : `backend/api/main.py` n'a **aucun middleware CORS configuré**.
Depuis une page servie en HTTPS (`https://niafrond.github.io/dj-mix`), un appel `fetch()` vers
`<DJ_PLANNER_BASE_URL>` sera bloqué par le navigateur tant que le backend (ou le nginx devant lui)
ne renvoie pas les en-têtes CORS attendus. **C'est un prérequis backend, pas un problème côté
front** — je le fais ajouter côté `dj-planner` (origine autorisée : `https://niafrond.github.io`,
méthodes `GET/POST/PATCH`) avant que l'intégration puisse être testée de bout en bout. Rien à faire
côté front sur ce point, mais ne pas être surpris par des erreurs CORS tant que ce n'est pas livré
— et à vérifier que le nginx local ne filtre pas lui-même ces en-têtes.
- **Détection de disponibilité** : avant d'activer les fonctionnalités dépendant de `dj-planner`,
  `dj-mix` DOIT sonder `GET <DJ_PLANNER_BASE_URL>/health` (réponse `{"status": "ok"}`). Si
  injoignable (timeout court, ex. 2s), désactiver silencieusement les fonctionnalités liées et
  informer l'utilisateur qu'il doit démarrer son backend local — jamais un échec bloquant de
  l'app pour un utilisateur qui n'a pas encore installé `dj-planner`.
- Pas d'authentification à implémenter : aucune clé API, aucun token. Ne pas envoyer de
  credentials cross-origin.

## 3. Documentation API vivante

Le backend expose automatiquement (`T046`), via le même reverse proxy :
- Swagger UI interactif : `<DJ_PLANNER_BASE_URL>/docs`
- Schéma OpenAPI brut (pour générer un client TS) : `<DJ_PLANNER_BASE_URL>/openapi.json`

Recommandation : générer les types TypeScript du front à partir de `openapi.json` (ex.
`openapi-typescript`) plutôt que de les recopier à la main, pour rester synchronisé automatiquement
avec les schémas Pydantic réels du backend.

## 4. Les 6 endpoints — résumé et écran `dj-mix` associé

Détail complet des requêtes/réponses : [`contracts/api.md`](contracts/api.md).

| Endpoint | Écran / action `dj-mix` | Notes d'intégration |
|---|---|---|
| `POST /v1/mix-decisions` | "Est-ce que ces deux morceaux se mixent ?" (morceau en cours + candidat sélectionné) | Réponse < 10s attendu (SC-001) → afficher un état de chargement. Voir §5 pour `compatible=false` et `422`. |
| `POST /v1/playlist-plans` | Génération d'un plan de set à partir d'une crate importée | `track_ids` = la sélection du DJ dans l'ordre qu'il veut voir réordonné. Peut être plus long selon N morceaux — prévoir un état de progression, pas un spinner bloquant instantané. |
| `PATCH /v1/playlist-plans/{plan_id}` | Verrouiller un morceau à une position ("celui-ci ouvre le set") puis redemander une réoptimisation | Même schéma de réponse que `POST`. `plan_id` retourné par le `POST` initial doit être conservé côté front (state du plan en cours). |
| `GET /v1/transitions/observed` | Badge "X DJ ont déjà joué cet enchaînement" sur une transition proposée | Query params `from_track_id`/`to_track_id`. `observed=false` est une réponse normale, pas une erreur — ne pas l'afficher comme un échec. |
| `GET /v1/styles/{style}/progressions` | Panneau "idées de progression" pour un style donné | Utilisé en exploration, hors décision ponctuelle. |
| `POST /v1/personal-history/import` | Import de l'historique de sets personnels du DJ | Fonctionnalité de fond ; retourne un résumé d'import (morceaux reconnus / non appariés / transitions ajoutées) à afficher tel quel, sans reformulation qui laisserait croire à un import garanti complet. |

## 5. Règles d'affichage obligatoires (non négociables)

Ces règles découlent directement de la constitution du backend (Principes II, III, V) et
conditionnent la confiance que le DJ peut avoir dans l'app — elles ne sont pas de simples
suggestions de design.

1. **`confidence` est toujours affiché**, pour toute `MixDecision` ou `PartialMixDecision`. Jamais
   masqué "pour épurer l'UI".
2. **Une `PartialMixDecision` ne doit jamais ressembler visuellement à une `MixDecision`
   complète.** Utiliser un badge distinct (ex. "décision partielle") et lister
   `missing_dimensions` de façon lisible (ex. "structure inconnue, stems non séparés"). Ne
   jamais compléter silencieusement les champs manquants côté front par une valeur par défaut.
3. **`compatible=false` doit toujours afficher `blocking_dimensions` et l'explication** — jamais
   un simple "non compatible" sans détail. C'est la donnée qui permet au DJ de comprendre le
   refus (harmonique / énergie / structurel / fréquentiel).
4. **`status="deliberate_exception"` doit être visuellement distinct** d'une décision standard
   (ex. bandeau ou icône dédiée), et ne doit **jamais** apparaître sauf si le DJ a explicitement
   demandé `allow_exception=true` pour cette requête précise. Ce flag ne doit **jamais être
   mémorisé** comme préférence globale — c'est une action ponctuelle, pas un mode.
5. **`evidence`/`occurrence_count`/`djs` doivent être distingués visuellement d'une justification
   audio.** Une transition "jouée 532 fois par des DJ réels" et une transition "compatible sur
   l'analyse audio locale, jamais observée" sont deux niveaux de confiance différents pour
   l'utilisateur — ne pas les fusionner dans un seul texte générique du type "compatible ✓".
6. **`flagged_tracks`** (dans `PlaylistPlan`) doit être présenté comme un signalement à traiter
   par le DJ, pas comme une erreur d'import — le morceau reste dans la crate, il est juste exclu
   de l'ordre proposé.
7. Ne jamais laisser le front proposer une action nécessitant une donnée absente côté backend
   (ex. proposer un effet basé sur les stems si `stems_available=false` pour l'un des deux
   morceaux) — s'appuyer uniquement sur ce que la réponse API contient réellement.

## 6. Gestion des erreurs

| Cas | Comportement API | Comportement front attendu |
|---|---|---|
| Analyse audio locale insuffisante pour une décision complète | `422` avec `partial_decision` (si une évaluation partielle reste possible) | Afficher comme `PartialMixDecision` (voir règle 2 ci-dessus), pas comme une erreur réseau. |
| Aucune évaluation possible du tout | `422` sans `partial_decision` | Afficher un message explicite ("analyse audio manquante pour ce morceau"), pas un état d'erreur générique. |
| Erreur interne backend | `500`, corps `{"detail": "Erreur interne du moteur de mixage"}` | Message d'erreur générique + retry possible ; logger `detail` pour le support, ne pas l'afficher tel quel au DJ. |
| Backend injoignable (pas démarré) | Timeout / connexion refusée | Voir §2 — désactiver les fonctionnalités liées, pas de crash de l'app. |
| Cache Meilisearch indisponible côté backend | Transparent — le backend recalcule directement, aucun signal distinct envoyé au front | Rien à gérer côté front ; la latence peut simplement être un peu plus longue (toujours < 10s visé). |

## 7. Hors périmètre de cette intégration (V1)

- Pas de découverte de nouveaux morceaux hors de la sélection déjà faite par le DJ dans `dj-mix`
  (le moteur décide/optimise sur un ensemble déjà choisi, il ne recommande pas de catalogue plus
  large).
- Pas de pilotage temps réel du matériel de mix par l'API — `dj-mix` reste seul responsable de
  déclencher effectivement les effets/EQ à partir du plan reçu.
- Usage mono-utilisateur : pas de notion de session ou de compte partagé entre plusieurs DJ sur la
  même instance backend.

## 8. Prérequis avant de démarrer l'intégration

- [ ] CORS activé côté `dj-planner` pour `https://niafrond.github.io` (voir §2 — à livrer côté
      backend avant tout test front réel).
- [ ] Une instance `dj-planner` locale démarrée et accessible (`GET /health` → `200`), avec au
      moins quelques morceaux disposant d'une analyse audio complète pour tester le chemin
      "décision complète" en plus du chemin "décision partielle".
- [ ] Génération d'un client TypeScript à partir de `<DJ_PLANNER_BASE_URL>/openapi.json` (§3),
      pour éviter la resaisie manuelle des schémas.
