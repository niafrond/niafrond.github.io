// La Fête des lanternes d'hiver : applique l'événement au monde assemblé (couche A → B, voir events/README.md).
//
// Ajoute le Village des lanternes enneigées (écran hors carte, comme un souterrain), son entrée dans la zone sauvage du Tonnerre (l'ancien col),
// deux terrains (le col des pins gelés, le sanctuaire de la flamme) et une chaîne de six quêtes facultatives. Appelé seulement si l'événement
// est activé (events/config.js) ; ne retire ni ne modifie aucune donnée permanente (il n'ajoute que ses énigmes à PUZZLES).

import { buildZone, freeNeighbor } from '../../world/mapKit.js';
import { occupancy, placeInLand } from '../../world/junctions.js';
import { PUZZLES } from '../../puzzle/levels.js';
import * as D from './data.js';
import * as T from './terrains.js';

const OPPOSITE = { W: 'E', E: 'W', N: 'S', S: 'N' };

function buildVillage() {
    const level = D.HOST.level;
    const chestAt = (def, at, tier, extra = {}) => ({ id: def.id, at, label: def.label, openText: def.openText, gold: 15 * level * tier, lootTier: Math.min(3, tier), ...extra });
    const npcAt = n => ({ id: n.id, at: n.at, name: n.name, title: n.title, idle: n.idle, ...(n.showWhen ? { showWhen: n.showWhen } : {}) });
    return buildZone({
        id: D.REALM_ID, region: D.HOST.region, biome: D.BIOME, kind: 'wild', grid: D.GRID, houses: D.HOUSES,
        npcs: [D.ANCIEN, D.CUISINIER, D.ARTISAN, D.GARDIEN, D.ENFANTS, D.ESPRIT_VILLAGE, D.FAMILLE, { ...D.RENARD, showWhen: D.REVEALED_BY }].map(npcAt),
        chests: [
            // les lanternes s'allument dans l'ordre : chacune n'apparaît qu'une fois la précédente allumée
            ...D.LANTERNS.map(l => chestAt(l, l.at, 1, {
                ...(l.item ? { questItem: { ...l.item, quest: D.QUEST_IDS.lanternes } } : {}), ...(l.showWhen ? { showWhen: l.showWhen } : {})
            })),
            chestAt(D.RIZ.chest, D.RIZ.chest.at, 1, { questItem: { ...D.RIZ.item, quest: D.QUEST_IDS.tangyuan } }),
            chestAt(D.SESAME.chest, D.SESAME.chest.at, 1, { showWhen: D.SESAME.chest.showWhen, questItem: { ...D.SESAME.item, quest: D.QUEST_IDS.tangyuan } }),
            chestAt(D.PUZZLE_MIROIR.chest, D.PUZZLE_MIROIR.chest.at, D.PUZZLE_MIROIR.tier, { puzzle: D.PUZZLE_MIROIR.id, questItem: { ...D.PUZZLE_MIROIR.item, quest: D.QUEST_IDS.flamme } })
        ],
        enemies: [],   // le village est un lieu de fête : aucun combat
        exits: []
    }, { npcDef: id => ({ id }), chestDef: id => ({ id }), screenText: () => ({ name: D.VILLAGE.name, arrival: D.VILLAGE.arrival }) });
}

// Case du bord d'un écran pour une porte (côté W ou E) et case intérieure d'arrivée symétrique.
function gateCell(screen, side) {
    if (screen.id === D.REALM_ID) return D.GATES[side];
    const g = screen.gates[side];
    return { W: { x: 0, y: g }, E: { x: screen.w - 1, y: g } }[side];
}
const inward = (screen, side) => { const c = gateCell(screen, side); return { x: c.x + (side === 'W') - (side === 'E'), y: c.y }; };

// Intérieur de la maison du village : mobilier d'hiver (kang, brasero, étagère à thé…), voir `furnishing` dans decor.js.
function buildMaison() {
    const zone = buildZone({
        id: D.MAISON.id, region: D.HOST.region, biome: 'house', kind: 'house', interior: true, grid: D.MAISON.grid,
        npcs: [], chests: [], enemies: [], exits: []
    }, { npcDef: id => ({ id }), chestDef: id => ({ id }), screenText: () => ({ name: D.MAISON.name }) });
    zone.furnishing = 'winter';
    const v = zone.exits; const door = { x: D.MAISON.grid[6].indexOf('v'), y: 6 };
    v.push({ x: door.x, y: door.y, to: D.REALM_ID, door: false, label: 'Sortie' });
    return zone;
}

function buildTerrain(t) {
    const level = D.HOST.level;
    const carve = Object.entries(t.gates).map(([side, v]) => ['.', ...(side === 'W' ? [0, v] : [t.w - 1, v])]);
    const grid = T.makeGrid(t.w, t.h, [...t.shapes, ...carve, ['S', ...t.spawn]]);
    const zone = buildZone({
        id: t.id, region: D.HOST.region, biome: D.BIOME, kind: 'wild', grid,
        ...(t.grass ? { grass: t.grass } : {}),
        npcs: t.npcs,
        chests: t.chests.map(({ tier, ...c }) => ({ ...c, gold: 15 * level * tier, lootTier: Math.min(3, tier) })),
        enemies: t.enemies.map(({ boss, ...e }) => ({ permanent: true, ...e, ...(boss ? { boss: { name: e.name, level: level + e.offset + 1 } } : {}) })),
        exits: []
    }, { npcDef: id => ({ id }), chestDef: id => ({ id }), screenText: () => ({ name: t.name, arrival: t.arrival }) });
    zone.underground = true;
    zone.gates = t.gates;
    return zone;
}

function buildQuests() {
    const Q = D.QUESTS, I = D.QUEST_IDS;
    const side = q => ({ chapter: '✦ Quête secondaire — La Fête des lanternes d\'hiver', requires: [], side: true, ...q });
    const base = (q, giver, extra) => side({ id: q.id, title: q.title, giver, turnIn: giver, offer: q.offer, hint: q.hint, complete: q.complete, reward: { ...q.reward, fragment: q.fragment }, ...extra });
    const item = (id, text) => ({ type: 'item', target: id, text });
    return [
        base(Q.solstice, D.ANCIEN.id, {
            objectives: [
                { type: 'talk', target: D.CUISINIER.id, text: Q.solstice.objectives.cook, lines: Q.solstice.cookLines },
                { type: 'talk', target: D.ARTISAN.id, text: Q.solstice.objectives.artisan, lines: Q.solstice.artisanLines }
            ]
        }),
        base(Q.lanternes, D.ARTISAN.id, {
            requires: [I.solstice],
            objectives: D.LANTERNS.map((l, i) => ({ type: 'chest', target: l.id, text: Q.lanternes.objectives.lantern(i + 1) }))
        }),
        base(Q.tangyuan, D.CUISINIER.id, {
            requires: [I.solstice],
            objectives: [item(D.RIZ.item.id, Q.tangyuan.objectives.riz), item(D.SESAME.item.id, Q.tangyuan.objectives.sesame), item(D.CLOCHETTE.item.id, Q.tangyuan.objectives.clochette)]
        }),
        base(Q.flamme, D.GARDIEN.id, {
            requires: [I.lanternes, I.tangyuan],
            objectives: [item(D.FRAGMENTS[0].id, Q.flamme.objectives.f1), item(D.FRAGMENTS[1].id, Q.flamme.objectives.f2), item(D.FRAGMENTS[2].id, Q.flamme.objectives.f3)]
        }),
        base(Q.chaleur, D.GARDIEN.id, {
            requires: [I.flamme],
            objectives: [{ type: 'kill', target: D.BOSS.id, text: Q.chaleur.objectives.boss }, item(D.JADE.item.id, Q.chaleur.objectives.jade)]
        }),
        base(Q.celebration, D.ANCIEN.id, {
            requires: [I.chaleur],
            objectives: [
                { type: 'talk', target: D.FAMILLE.id, text: Q.celebration.objectives.famille, lines: D.FAMILLE.celebrationLines },
                { type: 'talk', target: D.ENFANTS.id, text: Q.celebration.objectives.enfants, lines: D.ENFANTS.celebrationLines },
                { type: 'talk', target: D.ESPRIT_VILLAGE.id, text: Q.celebration.objectives.esprit, lines: D.ESPRIT_VILLAGE.celebrationLines }
            ]
        })
    ];
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Case de l'entrée : terre ferme libre, à bonne distance des sorties, de l'apparition et de tout ennemi (patrouilles comprises).
function placeEntrance(host, screens) {
    const danger = host.enemies.flatMap(e => [{ x: e.x, y: e.y }, ...(e.patrol || []).map(p => (Array.isArray(p) ? { x: p[0], y: p[1] } : p))]);
    const wall = host.enemies.flatMap(e => (e.wall || []).map(([x, y]) => ({ x, y })));
    const clear = pos => cheb(pos, host.spawn) >= 4 && danger.every(d => cheb(pos, d) >= 4) && wall.every(w => cheb(pos, w) >= 2);
    return placeInLand(host, occupancy(host, screens), `${D.REALM_ID}_porte_${host.id}`, clear);
}

// Répliques de fin de quête et conditions d'apparition des PNJ du village.
function addTalk(village) {
    const talkDone = (n, whenDone) => { village.npcs.find(x => x.id === n.id).talk = [{ whenDone, lines: n.talkDone }]; };
    talkDone(D.ANCIEN, D.QUEST_IDS.celebration);
    talkDone(D.CUISINIER, D.QUEST_IDS.tangyuan);
    talkDone(D.ARTISAN, D.QUEST_IDS.lanternes);
    talkDone(D.GARDIEN, D.QUEST_IDS.chaleur);
}

/**
 * Crée le village, son entrée dans la zone sauvage du Tonnerre, le col, le sanctuaire et les quêtes. Retourne `false` (sans rien modifier)
 * si la zone hôte est absente du monde assemblé, p. ex. dans un monde de test réduit.
 */
export function applyWinterLanternFestival(screens, quests) {
    const wild = screens[D.HOST.wild];
    if (!wild) return false;
    const village = buildVillage();
    const door = placeEntrance(wild, screens);
    const back = door && freeNeighbor(wild, door.x, door.y);
    if (!door || !back) throw new Error(`événement ${D.ID} : pas de place pour l'entrée dans ${wild.id}`);

    wild.exits.push({
        x: door.x, y: door.y, to: D.REALM_ID, label: D.VILLAGE.entrance, arrive: { ...village.spawn },
        rememberReturn: { x: back.x, y: back.y }, sprite: D.GATE_SPRITE
    });
    village.exits.push({ x: D.GATES.W.x, y: D.GATES.W.y, to: wild.id, label: D.VILLAGE.exitLabel, arrive: back, returnToSaved: true, sprite: D.GATE_SPRITE });
    village.underground = true;   // écran hors carte : mêmes exemptions que les souterrains (agrandissement, bordure, musique de la région)
    village.eventNotice = D.VILLAGE.notice;
    village.biomeIntro = D.VILLAGE.intro;
    addTalk(village);

    D.PUZZLE_LIST.forEach(p => { PUZZLES[p.id] = p.def; });   // énigmes de l'événement (moteur d'énigmes existant, seulement quand l'événement est actif)
    screens[D.REALM_ID] = village;
    screens[D.MAISON.id] = buildMaison();

    T.TERRAINS.forEach(t => { screens[t.id] = buildTerrain(t); });
    T.LINKS.forEach(l => {
        const A = screens[l.from], B = screens[l.to], back2 = OPPOSITE[l.side];
        const a = gateCell(A, l.side), b = gateCell(B, back2);
        A.exits.push({ x: a.x, y: a.y, to: B.id, label: l.label, arrive: inward(B, back2), ...(l.requires ? { requires: l.requires, lockedMessage: l.lockedMessage } : {}) });
        B.exits.push({ x: b.x, y: b.y, to: A.id, label: A.name, arrive: inward(A, l.side) });
    });
    quests.push(...buildQuests());
    return true;
}

export default { id: D.ID, apply: applyWinterLanternFestival };
