# Extension « Grand Monde » — format des données

Chaque **région** (rizieres, fleuve, bambous, gobi, tonnerre, volcan, fauves, mer, fusang, lune) devient une chaîne de zones :

```
… région précédente (sanctuaire) ──► <R>_village ──► <R>_wild ──► <R> (sanctuaire, EXISTANT, contient le Soleil-Boss)
                                       │  portes
                                       └─► maisons explorables : <R>_h_<nom> (intérieurs)
```

* `<R>_village` : **village plein écran 9:16** (20×24 tuiles ; lune 16×22 ; rangées 12 à 22 = quartier sud : ancres j k m n réservées aux 4 coffres de jardin et de marché), zone sûre (aucun ennemi), 4 à 6 maisons enterrables, PNJ sur la place,
  coffres, une **pierre de voyage** (voyage rapide).
* `<R>_wild` : zone sauvage 18×12 que l'on traverse pour atteindre le sanctuaire : ennemis, coffres, mini-boss ou énigme qui
  garde la sortie vers le sanctuaire (`requires`), pierre de voyage de mi-parcours.
* `<R>` : le sanctuaire existant (`story.js`, 14×10, Soleil-Boss). On n'y touche pas, sauf pour en retirer les PNJ de village
  (déplacés dans le village) et lui rajouter une pierre de voyage près de l'entrée ouest.
* Maisons : intérieurs 10×7 ou 12×8, zone sûre, 1 à 3 PNJ, 0 à 3 coffres.

Seule la région `lune` (finale) n'a pas de Soleil-Boss : village = « Hameau sous la Lune » plus petit (16×11), wild = sentier, sanctuaire = Pic existant.

## 1. Fichiers

| Fichier | Auteur | Contenu |
|---|---|---|
| `world/manifest.js` | Maître scénariste | Squelette narratif : ids, noms, rôles, intentions de quêtes (§2) |
| `world/text/<R>.js` | Maître scénariste | Tous les textes : PNJ, coffres, maisons, quêtes, arrivées (§3) |
| `world/maps/<R>.js` | Maître gameplay | Cartes ASCII + placement des entités (§4) |
| `world/mapKit.js` | moteur | Lit les cartes ASCII ; fusionne les textes (ne pas modifier) |

Langue : français soigné, ton de `UNIVERS.md` (épique, poétique, humour léger chez les villageois, tout public). Vouvoiement pour
les anciens/dignitaires, tutoiement pour les proches et enfants. Les ids sont en `snake_case` ASCII, uniques dans tout le jeu.

## 2. `world/manifest.js` (maître scénariste, étape 1)

```js
export const MANIFEST = {
  rizieres: {
    village: { id: 'rizieres_village', name: 'Hameau de Dongqiao', mood: 'une phrase d’ambiance',
               arrival: ['Texte du Narrateur à la 1re visite (1 à 3 phrases)'] },
    wild:    { id: 'rizieres_wild', name: 'Digue et Marais Craquelés', mood: '…', arrival: ['…'],
               gate: { type: 'kill' | 'chest' | 'quest', id: 'rizieres_warden', hint: 'Pourquoi la voie du sanctuaire est fermée' } },
    houses: [ { id: 'rizieres_h_wen', name: 'Maison du Doyen Wen', desc: '…', residents: ['elder_wen'], chests: ['wen_scroll_box'] }, … ],
    npcs: [ { id: 'lin_wife', name: 'Ping', title: 'Épouse de Lin', emoji: '👩‍🌾', where: 'place' | 'house:<houseId>' | 'wild', role: 'ambiance|marchand|donneur|indice' }, … ],
    chests: [ { id: 'rice_jar', where: 'village|wild|house:<id>', tier: 1|2|3, label: 'Jarre de riz' }, … ],
    enemies: [ { id: 'rizieres_warden', name: 'Gardien de la digue', templateHint: 'forest_guardian', role: 'gate|quest|elite' }, … ],
    quests: [ { id: 'sq_xxx', title: '…', giver: 'npc_id', turnIn: 'npc_id', chain: null | 'sq_prev', summary: '…',
                objectives: [ { type: 'kill'|'killGroup'|'chest'|'talk'|'visit', target: 'id' } ] }, … ]
  }, …
};
```

PNJ existants (`story.js`) à CONSERVER et à placer dans le village (leurs textes ne changent pas ; ne pas les redéfinir, les
citer dans `residents`/`npcs` avec seulement leur `id` et `where`) : voir la liste en §5. Les 15 quêtes secondaires existantes
(`sq_*`) et leurs ennemis restent inchangés.

Quantités visées **par région** (9 régions complètes, `lune` allégée) : 2 à 3 nouveaux **sous-quêtes** (dont 1 chaîne de 2 étapes
au moins sur la moitié des régions), 6 à 8 nouveaux **PNJ** (ambiance, marchands de rumeurs, enfants, anciens, animaux parlants
selon le folklore chinois…), 5 à 7 **coffres** (3 pour le village/maisons, 2 à 4 dans la wild, dont un coffre « clé » éventuel),
4 à 6 maisons. Les PNJ de ambiance doivent relier le monde (rumeurs sur Fengmeng, sur l’élixir, sur le soleil voisin).
Les types d’objectifs : `kill` (ennemi nommé), `killGroup` (id de groupe), `chest` (ouvrir/trouver), `talk` (parler à un PNJ),
`visit` (atteindre un écran, ex. une maison cachée ou la wild).

## 3. `world/text/<R>.js` (maître scénariste, étape 2)

```js
export default {
  screens: { rizieres_village: { name, arrival: [...] }, rizieres_wild: {...}, rizieres_h_wen: { name, arrival: [...]?, } },
  npcs: {   // clé = id de PNJ du manifeste (nouveaux PNJ uniquement)
    ping: { name: 'Ping', title: 'Épouse de Lin', emoji: '👩‍🌾',
            idle: ['réplique 1', 'réplique 2'],                       // 2 à 4 répliques tournantes courtes
            talk: [ { whenDone: 'sun_1' | 'q_sun_2' | ['a','b'], lines: [...] } ] } },  // répliques selon l’avancement (≥1 par PNJ de village)
  chests: { rice_jar: { label: 'Jarre de riz', openText: '🎁 Quelques sous au fond de la jarre.', emoji: '🏺'?, emojiOpened: '…'? } },
  quests: [ { id, title, chapter: '✦ Quête secondaire — <Nom de région>', giver, turnIn, requires: [...], side: true,
              objectives: [ { type: 'talk', target: 'npc_id', text: 'Phrase d’objectif lisible, avec le lieu', lines: ['réplique de la cible quand on lui parle (talk)'] } ],
              offer: [...], hint: [...], complete: [...],
              reward: { gold: 60, fragment: 'Nom d’un composant de flèche', xp: 40 } } ]
};
```

Règles : `chapter` des secondaires = `'✦ Quête secondaire — ' + nom de région`. `reward.gold` entre 30 et 200 selon la région (1→9),
`reward.xp` 20 → 400. Une quête `talk` doit donner des `lines` à chaque objectif `talk`. Les textes ne contiennent jamais de coordonnées
« (x, y) » mais peuvent citer des lieux (« derrière la forge », « dans la maison de Mei »).

## 4. `world/maps/<R>.js` (maître gameplay)

```js
export default {
  village: { id: 'rizieres_village', region: 'rizieres', biome: 'paddy', grid: [ '…20 chars…', … 13 lignes ],
             /* entités, voir plus bas */ },
  wild:    { id: 'rizieres_wild', … grid 12 lignes de 18 },
  interiors: [ { id: 'rizieres_h_wen', house: 'A' /* lettre du bâtiment dans la grille du village */, grid: [...] , … } ],
  sanctuary: { id: 'rizieres', waypoint: { x: 1, y: 4 }, removeNpcs: true /* retire les PNJ du village de story.js */ }
};
```

### Grille ASCII (toutes les lignes de même longueur)
`.` sol · `#` obstacle (arbre, rocher, mur, décor selon biome) · `~` liquide · `=` chemin décoratif (franchissable) · `A`…`H` bâtiment (rectangle
d’une même lettre, la porte est la lettre minuscule correspondante `a`…`h` dans la **rangée du bas** du rectangle ; la porte est franchissable, le reste est mur) ·
`S` départ/arrivée par défaut · `W` pierre de voyage (bloque le passage, on la touche pour l’activer) · chiffres `0`-`9` et `<` `>` `^` `v` : **ancres** (sol libre)
nommées par leur caractère, utilisées par les entités (`at: '3'`). Les sorties de zone sont des ancres (`<` à l’ouest, `>` à l’est, `^`/`v`).

### Entités
```js
npcs:    [ { id: 'ping', at: '3' } ],                       // texte = world/text ou story.js (PNJ existants)
chests:  [ { id: 'rice_jar', at: '5', gold: 25 } ],         // optionnel: showWhen/hideWhen
enemies: [ { id: 'rizieres_warden', at: '7', templateId: 'forest_guardian', emoji: '🌳', name: '…', kind: 'sentinel'|'patrol',
             patrol: ['7','8'] /* ancres */, offset: 0|1|-1, permanent: true, group: 'id' } ],     // wild seulement
exits:   [ { at: '<', to: 'rizieres_wild', arriveAt: '>' /* ancre de la zone d’arrivée */, label: 'Digue', requires: 'rizieres_warden', lockedMessage: '…' } ],
```
Les portes (`a`…`h`) génèrent automatiquement l’entrée de la maison correspondante et la sortie de l’intérieur (ancre `v` de l’intérieur ⇒ arrivée devant la porte).
Un intérieur a `#` sur tout son pourtour, une ancre `v` (sortie, bas-centre) et des ancres pour ses PNJ/coffres.

### Contraintes vérifiées par les tests (`tests/unit/world.test.js`)
* chaque zone est connexe (toute ancre/entité atteignable depuis `S`), aucune entité sur un obstacle ni deux entités sur une même tuile ;
* chemin sanctuaire → village → wild → sanctuaire cohérent, sorties symétriques ;
* tous les ids de textes existent dans les cartes et inversement ; tous les objectifs de quêtes pointent sur des entités existantes ;
* quêtes principales faisables sans aucune quête secondaire ; la sortie `wild → sanctuaire` est franchissable (gate atteignable sans passer par le sanctuaire).
* **Équilibrage ennemis** : `offset` (-1/0/+1), nombre d’ennemis wild : 5 à 9 (dont ≥ 2 patrouilleurs), au moins un mini-boss `permanent` (`offset: 1`) comme gardien du gate (ou un coffre-clé plus loin), jamais d’ennemi à moins de 3 tuiles de `S`/`<`.
* **Récompenses** : coffre palier 1/2/3 → or ≈ `15·R·1`, `15·R·2`, `15·R·3` (R = numéro de région 1…10) ; un coffre caché derrière du décor par région.

## 5. PNJ existants à placer (déjà décrits dans `story.js`)

rizieres: change (Chang'e, chez Hou Yi), elder_wen, farmer_lin · fleuve: ferryman_gu, weaver_mei · bambous: monk_zhen, herbalist_xu ·
gobi: merchant_ma, guide_dawa · tonnerre: smith_tie, hermit_lei · volcan: miner_shan, priestess_yan · fauves: hunter_wu, shepherd_zi ·
mer: fisher_hai, envoy_longwang · fusang: crane_envoy (et `sun_ten`, qui reste au sanctuaire) · lune: change_moon (reste au sanctuaire).
Coffres existants qui restent au sanctuaire (ne pas redéfinir) : lotus_cache, fleuve_chest, temple_bell, bambous_chest, oasis_cache, gobi_chest, lei_drum, tonnerre_chest,
phoenix_brazier, volcan_chest, zi_bell, fauves_chest, dragon_pearl, mer_chest, crane_nest, moon_cakes_cache, moon_altar.

## 6. Précisions d'implémentation (prioritaires sur §4 en cas de divergence)

* `world/maps/<R>.js` : `export default { village: {id, biome, grid, npcs, chests}, wild: {id, biome, grid, npcs, chests, enemies, gate: {requires: '<id coffre|ennemi|quête>', lockedMessage}}, interiors: [{id, house: 'A', grid, npcs, chests}], sanctuary: {waypoint: {x, y}} }`, puis enregistrement dans `world/maps/index.js` (`import rizieres from './rizieres.js'; export const MAPS = { rizieres, … }`).
* Sorties automatiques (ne pas les déclarer) : village `<` → sanctuaire précédent (pas de `<` dans le village de `rizieres`), village `>` → wild, wild `<` → village, wild `>` → sanctuaire (fermée par `gate.requires`), porte minuscule → intérieur, ancre `v` d’un intérieur → village. Les ancres `<` `>` doivent donc être posées sur le **bord** de la grille (x = 0 / x = w-1) avec une tuile libre juste à l’intérieur. L’ancre `S` est le point d’apparition (`rizieres_village` : devant la maison de Hou Yi).
* Pas de champ `name` dans les cartes : les noms viennent de `world/text/<R>.js` (`screens.<id>.name`). Tous les textes (PNJ, coffres, quêtes) sont écrits par le scénariste, clés = ids du manifeste.
* Les PNJ existants sont placés par `{ id: 'elder_wen', at: '3' }` comme les autres. Un PNJ peut recevoir `showWhen`/`hideWhen` dans la carte.
* Ennemis (wild) : champs `id, at, templateId, emoji, name, kind ('sentinel'|'patrol'), patrol ['ancre', …], offset, permanent, group` ; mini-boss : ajouter `boss: { name, level }` (level ≈ 2 niveaux sous le Soleil de la région, voir UNIVERS.md §2). Les ennemis nommés du manifeste (templateHint) doivent être placés avec leur `id` exact.
* Le groupe `group` d’un ennemi déclaré dans le manifeste sert aux objectifs `killGroup`.
* Pierres de voyage : lettre `W` dans la grille du village et de la wild (un seul `W` par grille) ; sanctuaire via `sanctuary.waypoint`.
* Les tuiles devant une porte (au sud, y+1) et devant/autour des ancres d’entrée doivent être libres.

## 7. Hameau (2e village par région, sauf `lune`)

`world/maps/<R>.js` peut aussi exporter `hamlet: { id: '<R>_hamlet', biome, grid, npcs, chests }` : village 16×11 (comme un village : ruelles, 2-3 bâtiments `A`-`H`, PNJ de place, coffres, pierre `W` optionnelle). Il se rattache à la zone sauvage : ancre `^` sur le **bord haut** du hameau et ancre `v` sur le **bord bas** de la wild (sorties créées automatiquement, tuile libre juste à l'intérieur de chaque bord). Ses maisons sont des entrées de `interiors` avec `in: 'hamlet'` (leur lettre de bâtiment est celle de la grille du hameau). Aucun ennemi dans le hameau. La wild doit rester connexe avec l'ancre `v` atteignable sans passer par le gate. Le manifeste complémentaire est `world/manifest2.js` (PNJ/coffres/ennemis supplémentaires de TOUS les écrans, y compris les villages et wilds déjà dessinés : ajouter des ancres/places libres si besoin).

## 8. Ancres supplémentaires
Outre les chiffres `0`-`9` et `< > ^ v`, les lettres minuscules **`i` à `u` et `w` à `z`** (hors `v`) sont des ancres libres : elles servent exactement comme les chiffres (`at: 'k'`, extrémités de patrouille…). Les minuscules `a`-`h` restent les portes des bâtiments `A`-`H`.
