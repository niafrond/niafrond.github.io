# Agents IA de Match3-Quest

Un fichier Markdown par **agent spécialisé**. Chaque fichier est un prompt système autonome : il dit ce que l'agent possède
(périmètre), ce qu'il lit avant d'agir, ce qu'il produit, ses règles et ses vérifications. À coller (ou à référencer) quand on
lance un sous-agent sur une tâche de ce domaine.

| Agent | Fichier | Domaine |
|---|---|---|
| Gameplay | [gameplay.md](gameplay.md) | Règles du match-3, combat, sorts, objets, classes |
| Scénario | [scenario.md](scenario.md) | Histoire, PNJ, quêtes, dialogues, ton |
| Musique | [musique.md](musique.md) | Pistes MP3 en boucle, compositeur procédural |
| Effets sonores | [sound-design.md](sound-design.md) | Clips `sfx`, correspondance événement → son |
| Animation pixel art | [animation-pixel-art.md](animation-pixel-art.md) | Sprites, cycles d'animation, effets visuels |
| Level design | [level-design.md](level-design.md) | Cartes, villages, zones sauvages, coffres, énigmes |
| Équilibrage | [equilibrage.md](equilibrage.md) | Courbes de niveau, dégâts, mana, économie, difficulté IA |
| UI / UX | [ui-ux.md](ui-ux.md) | Interface, mobile, accessibilité, tutoriel, textes d'interface |
| QA / Tests | [qa-tests.md](qa-tests.md) | Tests Jest, Playwright, non-régression, performance |

## Règles communes à tous les agents

1. **Source de vérité** : `UNIVERS.md` (identifiants, régions, PNJ, charte d'art). Les identifiants marqués FIXES ne changent
   jamais (régions, soleils, Fengmeng, classes, gabarits d'ennemis).
2. **Specs** : tout agent met à jour `SPECS.md` (journal de session, entrée datée en tête) pour ce qu'il a modifié. Ne jamais
   toucher `dj-mix/SPECS.md`.
3. **Langue** : français soigné pour tout ce que voit le joueur ; code et identifiants en anglais ou au format existant.
4. **Aucun emoji** dans le jeu (test `tests/unit/noEmoji.test.js`) ; pas de caractère non ASCII dans les SVG.
5. **Aucune synthèse audio en temps réel** : la musique et les effets sont pré-rendus (voir `tools/audio/README.md`).
6. **Chargement à la demande** : ne rien charger au démarrage qui puisse l'être par région (sprites en paquets, pistes à la scène).
7. **Tout public** : pas de gore, ton épique, poétique, humour léger.
8. **Vérifier avant de rendre** : `npm run test:unit` (projet `match3-quest-node`) doit rester vert ; ajouter un test pour toute
   règle chiffrée ou tout nouveau contenu.
9. **Périmètre** : ne pas modifier les fichiers d'un autre agent sans le dire ; en cas de besoin croisé, le signaler dans le
   compte rendu plutôt que de contourner.

10. **Style graphique** : exploration inspirée de Pokémon GBA (tuiles 16 unités, contour sombre unique, pourtour d'arbres, maisons à
    grand toit, rochers de salle) avec l'univers chinois conservé. Chaque agent concerné applique la section « Direction Pokémon GBA » de
    `animation-pixel-art.md` ; le code de rendu des tuiles est dans `tilePainter.js` (propriétaire : Animation pixel art).

## Qui touche à quoi (matrice rapide)

| Fichiers | Propriétaire principal | Consulté par |
|---|---|---|
| `board.js`, `matchMechanics.js`, `game.js`, `spells.json`, `classSpellEffects.js`, `items.js`, `weapons.js`, `equipment.js`, `classes.js`, `attributes.js` | Gameplay | Équilibrage, QA |
| `enemies.catalog.json`, `enemies.js`, `enemyAI.js`, `experience.js`, `progression.js` | Équilibrage | Gameplay |
| `story.js`, `companions.js`, `world/manifest.js`, `world/text/*`, `cinematics.js` (textes), `bossTips.js`, `UNIVERS.md` | Scénario | Level design |
| `world/*`, `world/maps/*`, `terrain.js`, `exploration.js`, `worldMap.js` | Level design | Scénario |
| `music.js`, `musicTracks.js`, `tools/audio/composer.js`, `audio/music/*` | Musique | Scénario |
| `sound.js`, `sfxCatalog.js`, `tools/audio/sfxRecipes.js`, `audio/sfx/*` | Effets sonores | Gameplay |
| `sprites/*`, `icons.js`, `sprites/tiles/*`, `explorationView.js` (rendu), `style.css`, `retro.css` | Animation pixel art | UI/UX |
| `index.html`, `style.css`, `tutorial.js`, `shop.js`, `worldMapView.js`, `gameOptions.js` | UI/UX | Gameplay |
| `tests/*` | QA | tous |

## Orchestration conseillée

- Nouvelle région : Scénario (manifest + textes) → Level design (cartes) → Pixel art (PNJ, décor) → Musique (`village-`, `wild-`,
  boss) → Équilibrage (niveaux, boss) → QA.
- Nouvelle zone / nouveau soleil (règles de profondeur, voir `scenario.md`) : Scénario (mini-arc, trois chemins, compagnons) → Level design (placement
  des gardes, du PNJ `parley`, des secrets) → Équilibrage (niveau de base, `weakenedBy`) → QA (tests « chemins multiples » et « compagnons »).
- Nouveau boss : Scénario (identité, `bossTips`) → Gameplay (mécanique) → Équilibrage → Pixel art → Musique (`boss-<nom>`) → QA.
- Nouveau sort ou objet : Gameplay → Équilibrage → Effets sonores → Pixel art (icône, effet) → QA.
