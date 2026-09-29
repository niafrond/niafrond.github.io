# Mob Rush — Spécifications (SDD)

Ce document liste les comportements attendus du jeu `mob-rush/`, organisés par domaine fonctionnel.
Chaque spec est formulée de manière testable (GIVEN / WHEN / THEN).
Les valeurs entre `backticks` sont les constantes ou bornes exactes du code (`engine.js`).

## Journal de session

- 2026-09-28 : à la demande de l'utilisateur (captures d'écran à l'appui), conception de la mécanique **« mur d'affrontement »** — avant qu'une unité bleue puisse infliger des dégâts au château, elle doit franchir un rassemblement compact de rouges (une « vague-mur ») qui doit être entièrement vaincu, au lieu de simplement traverser une zone occupée par des rouges en subissant des pertes au passage (comportement actuel : `resolveCombat` ne fait qu'un échange de dégâts par proximité, sans blocage physique — cf. §3). Choix de l'utilisateur sur les deux questions de cadrage : (1) livrable = documentation de design uniquement pour cette session, pas de code ; (2) le blocage doit être **physique** (les bleus s'arrêtent devant le mur tant qu'il reste des rouges vivants dedans), pas seulement un blocage des dégâts au château. Spec proposée en §4, non implémentée — voir « Statut » en tête de §4 pour la liste des changements de code à faire dans une session ultérieure.

---

## 1. Boucle de jeu — vue d'ensemble

- **SPEC-1.1** Le monde logique est un rectangle fixe `W`×`H` (`360`×`640`, portrait). Le canon du joueur est fixe en bas (`CANNON_Y = 590`), la base ennemie fixe en haut (`BASE = {x: W/2, y: 64, w: 130, h: 56}`).
- **SPEC-1.2** GIVEN le joueur tire — WHEN le canon tire — THEN des unités bleues sont créées au niveau du canon et montent vers la base (`vy = -BLUE_SPEED`), traversant des portes qui les multiplient (`×n`) ou les divisent (`÷n`).
- **SPEC-1.3** GIVEN une base non détruite — WHEN le temps s'écoule — THEN des unités rouges sont générées près de la base (`spawnRed`) et descendent vers le canon (`vy = +RED_SPEED` ou `+BRUTE_SPEED`).
- **SPEC-1.4** Une base est découpée en 2 à 4 « châteaux » successifs (`castleCount`/`splitCastles`) ; franchir un château change le terrain de portes (`swapTerrain`) du château suivant.

## 2. Génération des vagues de rouges (état actuel)

- **SPEC-2.1** Un flux continu (« trickle ») spawn `spawnGroup` rouges toutes les `spawnInterval` secondes (accéléré progressivement par `g.time / T.RAMP`).
- **SPEC-2.2** GIVEN `g.waveAcc >= waveEvery` — THEN un burst de `waveSize` rouges est généré d'un coup (`events.push({type:'wave', ...})`), sans changement de comportement de mouvement/collision par rapport au flux continu — c'est juste une salve plus dense.
- **SPEC-2.3** `spawnRed` place chaque unité à `x = BASE.x + (rng()-0.5) * (BASE.w - 20)` — une bande étroite centrée sous la base (~110px de large), pas sur toute la largeur du terrain. La formation « mur » large visible sur les captures d'écran est un effet émergent de l'accumulation de plusieurs salves qui n'ont pas encore atteint le canon, pas une formation générée comme telle.
- **SPEC-2.4** Après spawn, chaque rouge se dirige horizontalement vers `cannonX` (`want = clamp((cannonX - x)*0.35, -35, 35)`) tout en descendant à vitesse constante verticale — aucun regroupement ni alignement délibéré avec les autres rouges de la même vague.

## 3. Affrontement bleu/rouge (état actuel)

- **SPEC-3.1** `resolveCombat` (grille spatiale, cellules de `CELL=24`) ne fait qu'un échange de dégâts : pour chaque paire bleu/rouge dont les cercles se chevauchent (`dx²+dy² <= (u.r+e.r)²`), `d = min(u.hp, e.hp)` est retiré aux deux.
- **SPEC-3.2** Une unité bleue dont les PV tombent à 0 pendant ce combat est retirée en fin de frame (`g.blue = g.blue.filter(u => u.hp > 0)`) — mais **rien n'empêche une unité bleue survivante de continuer sa route vers la base pendant/après ce contact** : il n'y a aucune notion de « front bloqué », seulement une perte de PV mutuelle instantanée à l'instant du contact.
- **SPEC-3.3** Une unité bleue qui atteint `y - r <= baseBottom` (bord bas de la base) inflige ses PV restants à la base (`applyBaseDamage`), **indépendamment de la présence de rouges vivants ailleurs sur le terrain**. Un champion à PV élevés peut donc traverser une ligne de rouges en n'y perdant qu'une fraction de ses PV et continuer jusqu'à la base.
- **SPEC-3.4** Conséquence : la mise en scène « mur de rouges qui bloque le passage » vue sur les captures d'écran fournies par l'utilisateur est un résultat probabiliste de densité (beaucoup de rouges encore en vie devant peu de bleus survivants), pas une règle garantie — à faible densité de rouges ou avec un champion à PV élevés, aucune vraie « confrontation décisive » n'est imposée avant le château.

## 4. Mur d'affrontement (**implémenté**)

> **Statut** : implémenté dans cette session, conforme au design ci-dessous. `engine.js` : `WALL_SPAN`/`WALL_Y_JITTER`/`WALL_BLOCK_WIDTH`, `wallsPerCastle` dans `generateLevel`, `g.walls`/`g.nextWallId`/`g.wallsSpawnedThisCastle` dans `createGame`, `spawnRedAt`/`spawnWall`, passe de blocage dans la boucle « Unités bleues » de `step()`, recalcul des survivants + événement `wallCleared` en fin de `step()`, reset dans `swapTerrain`. `main.js`/`index.html`/`style.css` : `#hud-wall` (SPEC-4.4.1), floaters `MUR ENNEMI !`/`MUR VAINCU !`, halo doré autour des rouges de mur au rendu. Tests : `tests/unit/engine.test.js` > `describe('Mur d'affrontement (SPECS.md §4)')` (8 tests, blocage physique isolé sans portes, non-exemption du champion, événement `wallCleared`, création/quota/reset par château, renfort du flux continu). Vérifié en navigateur réel (Playwright, `chromium` local) : `#hud-wall` affiche bien « 🛡 MUR ENNEMI — N restants » pendant qu'un mur est actif, capture d'écran confirmant visuellement un mur compact (halos dorés) bloquant l'armée bleue avant le château, conforme aux captures d'écran fournies par l'utilisateur en amont. Suite complète `mob-rush-node` : 54/54 tests verts (46 existants + 8 nouveaux), y compris le test préexistant « le niveau 1 se gagne » (le niveau reste gagnable avec la mécanique active).
>
> Les valeurs de tuning ci-dessous (`WALL_*`, `wallsPerCastle`) sont des points de départ raisonnables mais non validées par simulation à grande échelle (contrairement à `T`, réglé par un bot sur les niveaux 1–30) — un run de vérification manuel (aim non optimal, tir au centre) a montré un mur pouvant grossir jusqu'à ~55 membres restants sur plusieurs dizaines de secondes via le renfort du flux continu (SPEC-4.2.3) : à surveiller si des retours de jeu signalent des murs impossibles à vaincre à certains niveaux — le premier levier d'ajustement serait de réduire le taux de renfort du flux continu pendant qu'un mur est actif, ou de plafonner sa taille totale.

### 4.1 Principe

Avant qu'une unité bleue puisse atteindre la base et lui infliger des dégâts, elle doit franchir physiquement un **mur** : une formation de rouges générée d'un bloc, alignée sur (une partie de) la largeur du terrain, qui **bloque le passage** de toute unité bleue tant qu'il reste au moins un rouge vivant appartenant à ce mur et positionné entre l'unité et la base. Ce n'est plus un simple échange de dégâts au contact (§3.1) : c'est une collision bloquante, du même type que celle déjà utilisée pour les murs de portes fermées (`step()`, boucle `for (const row of g.rows)`, cas `!gate`), mais appliquée à un ennemi mobile plutôt qu'à un obstacle fixe.

### 4.2 Génération du mur

- **SPEC-4.2.1** GIVEN le déclenchement d'une vague (remplace SPEC-2.2) — WHEN elle se déclenche — THEN un nouvel objet `wall` est créé : `{ id, y, hp: totalHp, members: [redId...], cleared: false }`, ajouté à `g.walls`.
- **SPEC-4.2.2** Les rouges de cette vague sont répartis sur une ligne large (`WALL_SPAN` — ex. 70–90% de `W`, pas la bande étroite de SPEC-2.3), avec un léger décalage aléatoire en `y` (±`WALL_Y_JITTER`) pour un rendu organique plutôt qu'une ligne parfaitement droite, et un `wallId` commun sur chaque unité (`red.wallId = wall.id`).
- **SPEC-4.2.3** Les rouges du flux continu (« trickle », SPEC-2.1) qui apparaissent alors qu'un mur est déjà actif rejoignent ce mur (même `wallId`) au lieu d'en créer un second — un seul mur actif à la fois par lane/terrain, pour rester lisible visuellement.
- **SPEC-4.2.4** `wallsPerCastle` (nouveau paramètre de `generateLevel`, ex. 1 à 3 selon le niveau) fixe combien de murs doivent être vaincus pendant la traversée d'un château donné ; au-delà, les vagues redeviennent du flux continu non bloquant (SPEC-2.1 inchangé) jusqu'au prochain mur programmé.

### 4.3 Blocage physique

- **SPEC-4.3.1** GIVEN une unité bleue en mouvement vers la base — WHEN un rouge vivant avec `red.wallId` non nettoyé se trouve entre l'unité et la base (i.e. `red.y <= u.y` et alignement horizontal dans une marge `WALL_BLOCK_WIDTH` autour de `u.x`) — THEN l'unité bleue s'arrête au contact (même traitement que `stopY`/glissement latéral déjà utilisé pour un mur de porte fermée en §3 de `engine.js`, réutilisable tel quel) au lieu de continuer sa progression verticale.
- **SPEC-4.3.2** Le combat continue de se résoudre normalement (§3.1, `resolveCombat` inchangé) pendant que les unités sont à l'arrêt contre le mur — les PV s'échangent au contact comme aujourd'hui, mais l'unité bleue ne peut plus dépasser un rouge du mur tant que celui-ci est vivant.
- **SPEC-4.3.3** GIVEN tous les rouges d'un `wallId` donné sont morts — WHEN le dernier meurt — THEN `wall.cleared = true`, un événement `{ type: 'wallCleared', id }` est émis (pour le HUD/les effets), et le blocage de SPEC-4.3.1 cesse immédiatement pour toutes les unités bleues concernées (elles reprennent leur route vers la base à la frame suivante, sans knockback).
- **SPEC-4.3.4** Un champion (`u.champ`) n'est pas exempté du blocage — un mur suffisamment dense doit pouvoir arrêter même un champion à PV élevés, cohérent avec la lecture des captures d'écran (« il faut battre le mur avant d'espérer toucher le château », pas de passe-droit pour l'unité la plus forte).

### 4.4 HUD / lisibilité

- **SPEC-4.4.1** GIVEN un mur actif (`g.walls` contient une entrée non `cleared`) — THEN un indicateur HUD dédié (sur le modèle de `hud-boss` déjà existant, `main.js:622-627`) affiche un état du type « Mur ennemi — N restants », pour que le joueur comprenne pourquoi sa progression est stoppée malgré des tirs actifs.
- **SPEC-4.4.2** L'événement `wallCleared` (SPEC-4.3.3) déclenche un feedback visuel/sonore distinct de `castleDown`, pour marquer la bascule « affrontement gagné → dégâts au château à nouveau possibles ».

### 4.5 Questions tranchées à l'implémentation

- Un mur non vaincu qui atteint le canon inflige des dégâts au canon comme n'importe quel rouge (SPEC de `cannonHit`, inchangée) — le mur ne s'arrête pas de lui-même, il continue de descendre normalement ; c'est le blocage de SPEC-4.3.1 (les unités bleues qui buttent dessus) qui crée la rencontre, pas une pause artificielle du mur lui-même.
- Valeurs retenues (non issues d'une simulation à grande échelle, cf. avertissement en tête de §4) : `WALL_SPAN = 0.82`, `WALL_Y_JITTER = 18`, `WALL_BLOCK_WIDTH = 26`, `wallsPerCastle = clamp(1 + floor(level/5), 1, 3)` (1 au niveau 1, jusqu'à 3 à partir du niveau 10).
- Interaction avec les portes mobiles/verrouillées/pulsées existantes : un mur peut se former devant une porte encore fermée, cumulant les deux blocages — aucune règle spéciale, les deux collisions sont indépendantes et s'appliquent l'une après l'autre dans la boucle `for (const row of g.rows)` de `step()` (le blocage du mur, calculé juste avant cette boucle, peut déjà avoir immobilisé l'unité avant qu'elle n'atteigne la porte).
- Un seul mur actif (non vaincu) à la fois par partie (pas par lane) : si une nouvelle vague se déclenche alors qu'un mur précédent n'est pas encore vaincu, elle le renforce (mêmes membres, `wallId` commun) au lieu d'en ouvrir un second — cf. avertissement ci-dessus sur le risque de mur qui grossit indéfiniment si le flux continu le renforce plus vite que le joueur ne le vide.
- Le combat de boss (après le dernier château) ne crée plus de nouveau mur (`!bossActive` dans la condition de `step()`) — plus rien à protéger une fois tous les châteaux tombés — mais un mur déjà actif au moment où le boss démarre continue d'exister et d'être renforcé par le flux continu jusqu'à sa défaite ; observé en session de vérification (capture d'écran) : HUD `hud-boss` et `hud-wall` affichés simultanément dans ce cas, sans conflit visuel (positions HUD distinctes).
