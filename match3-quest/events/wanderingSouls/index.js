// La Nuit des âmes errantes : applique l'événement au monde assemblé (couche A → B, voir events/README.md).
//
// Ajoute le Royaume des âmes errantes (écran hors carte, comme un souterrain), son entrée scellée dans la zone sauvage des Bambous,
// le talisman qui la descelle, la gardienne des rites du village et la chaîne de trois quêtes facultatives. Appelé seulement si
// l'événement est activé (events/config.js) ; ne retire ni ne modifie aucune donnée permanente (il n'ajoute que son énigme à PUZZLES).

import { buildZone, freeNeighbor } from '../../world/mapKit.js';
import { placeSafely } from '../../world/legends.js';
import { occupancy, placeInLand } from '../../world/junctions.js';
import { PUZZLES } from '../../puzzle/levels.js';
import * as D from './data.js';
import * as T from './terrains.js';

const TERRAIN_QUEST = T.QUEST_DIYU;

function buildRealm() {
    const level = D.HOST.level;
    const chestAt = (def, at, tier, extra = {}) => ({ id: def.id, at, label: def.label, openText: def.openText, gold: 15 * level * tier, lootTier: Math.min(3, tier), ...extra });
    const zone = buildZone({
        id: D.REALM_ID, region: D.HOST.region, biome: D.BIOME, kind: 'wild', grid: D.GRID,
        npcs: [
            { id: D.ZHONG_KUI.id, at: '1', name: D.ZHONG_KUI.name, title: D.ZHONG_KUI.title, idle: D.ZHONG_KUI.idle },
            { id: D.HUNGRY_GHOST.id, at: 'j', name: D.HUNGRY_GHOST.name, title: D.HUNGRY_GHOST.title, idle: D.HUNGRY_GHOST.idle },
            { id: D.GUIDE.id, at: D.GUIDE.at, name: D.GUIDE.name, title: D.GUIDE.title, idle: D.GUIDE.idle, showWhen: D.GUIDE.showWhen }
        ],
        chests: [
            ...D.LANTERNS.map(l => chestAt(l, l.at, 1, {
                // les lanternes s'allument dans l'ordre : chacune n'apparaît qu'une fois la précédente allumée
                ...(l.item ? { questItem: { ...l.item, quest: D.QUEST_IDS.lanternes } } : {}), ...(l.showWhen ? { showWhen: l.showWhen } : {})
            })),
            chestAt(D.SEAL.chest, D.SEAL.chest.at, 2, { questItem: { ...D.SEAL.item, quest: D.QUEST_IDS.sceaux } }),
            chestAt(D.BELL.chest, D.BELL.chest.at, 2, { questItem: { ...D.BELL.item, quest: D.QUEST_IDS.lanternes } }),
            chestAt(D.OFFERING, D.OFFERING.at, 2, { showWhen: D.OFFERING.showWhen }),
            ...D.PUZZLE_LIST.map(p => chestAt(p.chest, p.chest.at, p.tier || 3, { puzzle: p.id, questItem: { ...p.item, quest: D.QUEST_IDS.lanternes } })),
            chestAt(D.JADE.chest, D.JADE.chest.at, 3, { questItem: { ...D.JADE.item, quest: D.QUEST_IDS.sceaux } })
        ],
        enemies: D.ENEMIES.map(([id, at, templateId, name, kind, offset, patrol, boss, extra]) => ({
            id, at, templateId, name, kind, offset, permanent: true,
            ...(patrol ? { patrol } : {}), ...(boss ? { boss: { name, level: level + 2 } } : {}), ...(extra || {})
        })),
        exits: []
    }, { npcDef: id => ({ id }), chestDef: id => ({ id }), screenText: () => ({ name: D.REALM.name, arrival: D.REALM.arrival }) });
    zone.underground = true;   // écran hors carte : mêmes exemptions que les souterrains (agrandissement, bordure, musique de la région)
    return zone;
}

// Case du bord d'un écran pour une porte (côté W, E, N ou S) et case intérieure d'arrivée symétrique.
const OPPOSITE = { W: 'E', E: 'W', N: 'S', S: 'N' };
function gateCell(screen, side) {
    if (screen.id === D.REALM_ID) return T.HUB_GATES[side];
    const g = screen.gates[side];
    return { W: { x: 0, y: g }, E: { x: screen.w - 1, y: g }, N: { x: g, y: 0 }, S: { x: g, y: screen.h - 1 } }[side];
}
const inward = (screen, side) => { const c = gateCell(screen, side); return { x: c.x + (side === 'W') - (side === 'E'), y: c.y + (side === 'N') - (side === 'S') }; };

// Un terrain du royaume : carte tracée par formes, portes creusées dans le mur, entités posées en x, y.
function buildTerrain(t) {
    const level = D.HOST.level;
    const carve = Object.entries(t.gates).map(([side, v]) => ['.', ...(side === 'W' ? [0, v] : side === 'E' ? [t.w - 1, v] : side === 'N' ? [v, 0] : [v, t.h - 1])]);
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
    zone.gates = t.gates;   // côtés et positions des portes (voir gateCell)
    return zone;
}

function buildQuests() {
    const T = D.QUESTS, Q = TERRAIN_QUEST;
    const side = q => ({ chapter: '✦ Quête secondaire — La Nuit des âmes errantes', requires: [], side: true, ...q });
    const lanternObjectives = D.LANTERNS.map((l, i) => ({ type: 'chest', target: l.id, text: T.lanternes.objectives.lantern(i + 1) }));
    return [
        side({
            id: T.talisman.id, title: T.talisman.title, giver: D.GIVER.id, turnIn: D.GIVER.id,
            objectives: [{ type: 'item', target: D.TALISMAN.item.id, text: T.talisman.objective }],
            offer: T.talisman.offer, hint: T.talisman.hint, complete: T.talisman.complete,
            reward: { gold: 120, fragment: T.talisman.fragment, xp: 100 }
        }),
        side({
            id: T.lanternes.id, title: T.lanternes.title, giver: D.ZHONG_KUI.id, turnIn: D.ZHONG_KUI.id, requires: [T.talisman.id],
            objectives: [
                ...lanternObjectives,
                { type: 'talk', target: D.HUNGRY_GHOST.id, text: T.lanternes.objectives.ghost, lines: D.HUNGRY_GHOST.appeaseLines }
            ],
            offer: T.lanternes.offer, hint: T.lanternes.hint, complete: T.lanternes.complete,
            reward: { ...T.lanternes.reward, fragment: T.lanternes.fragment }
        }),
        side({
            id: T.sceaux.id, title: T.sceaux.title, giver: D.ZHONG_KUI.id, turnIn: D.ZHONG_KUI.id, requires: [T.lanternes.id],
            objectives: [
                { type: 'kill', target: 'ws_gardien_jugement', text: T.sceaux.objectives.boss },
                { type: 'item', target: D.JADE.item.id, text: T.sceaux.objectives.jade }
            ],
            offer: T.sceaux.offer, hint: T.sceaux.hint, complete: T.sceaux.complete,
            reward: { ...T.sceaux.reward, fragment: T.sceaux.fragment }
        }),
        side({
            id: Q.id, title: Q.title, giver: D.ZHONG_KUI.id, turnIn: D.ZHONG_KUI.id, requires: [D.QUEST_IDS.sceaux],
            objectives: [
                { type: 'talk', target: 'ws_meng_po', text: Q.objectives.talk },
                { type: 'item', target: 'qi_ws_souvenir', text: Q.objectives.souvenir },
                { type: 'kill', target: 'ws_reflet_peche', text: Q.objectives.reflet },
                { type: 'kill', target: 'ws_yanluo', text: Q.objectives.yanluo }
            ],
            offer: Q.offer, hint: Q.hint, complete: Q.complete,
            reward: { ...Q.reward, fragment: Q.fragment }
        })
    ];
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Case de l'entrée : terre ferme libre, à bonne distance des sorties (placeInLand), de l'apparition et de tout ennemi (patrouilles comprises).
function placeEntrance(host, screens) {
    const danger = host.enemies.flatMap(e => [{ x: e.x, y: e.y }, ...(e.patrol || []).map(p => (Array.isArray(p) ? { x: p[0], y: p[1] } : p))]);
    const wall = host.enemies.flatMap(e => (e.wall || []).map(([x, y]) => ({ x, y })));   // lignes de piliers d'un boss : jamais sur la porte ni à côté
    const clear = pos => cheb(pos, host.spawn) >= 4 && danger.every(d => cheb(pos, d) >= 4) && wall.every(w => cheb(pos, w) >= 2);
    return placeInLand(host, occupancy(host, screens), `${D.REALM_ID}_porte_${host.id}`, clear);
}

// Zones sauvages de plein air (une par région) qui accueillent une entrée du royaume : ni souterrain, ni carte aquatique, ni écran d'événement.
const isWildHost = s => s.kind === 'wild' && /_wild$/.test(s.id) && !s.aquatic && !s.underground && !s.event && !s.interior;

/**
 * Crée le royaume, son entrée, le talisman, la gardienne des rites et les quêtes. Retourne `false` (sans rien modifier) si la région
 * hôte est absente du monde assemblé, p. ex. dans un monde de test réduit.
 */
export function applyWanderingSouls(screens, quests) {
    const wild = screens[D.HOST.wild], village = screens[D.HOST.village];
    if (!wild || !village) return false;
    const realm = buildRealm();

    // Une entrée sur la terre ferme de la zone sauvage de chaque région (accessible de n'importe quel biome), ouverte sans condition ;
    // elle se referme quand la chaîne de quêtes est terminée. La sortie du royaume ramène à l'entrée empruntée (exit.returnToSaved).
    const hostBack = {};
    Object.values(screens).filter(s => isWildHost(s)).sort((a, b) => (a.id === wild.id ? -1 : b.id === wild.id ? 1 : 0)).forEach(host => {
        const door = placeEntrance(host, screens);
        const back = door && freeNeighbor(host, door.x, door.y);
        if (!door || !back) {
            if (host.id === wild.id) throw new Error(`événement ${D.ID} : pas de place pour l'entrée dans ${host.id}`);
            return;   // zone trop encombrée : les autres régions suffisent
        }
        host.exits.push({
            x: door.x, y: door.y, to: D.REALM_ID, label: D.REALM.entrance, arrive: { ...realm.spawn },
            rememberReturn: { x: back.x, y: back.y }, closedWhen: D.QUEST_IDS.diyu, closedMessage: D.REALM.closedMessage,
            sprite: D.GATE_SPRITE
        });
        hostBack[host.id] = back;
    });
    realm.exits.push({ x: 0, y: realm.spawn.y, to: wild.id, label: D.REALM.exitLabel, arrive: hostBack[wild.id], returnToSaved: true, sprite: D.GATE_SPRITE });
    realm.eventNotice = D.REALM.notice;
    realm.biomeIntro = D.REALM.intro;

    const chestPos = placeSafely(wild, screens, D.TALISMAN.chest.id);
    if (!chestPos) throw new Error(`événement ${D.ID} : pas de place pour le talisman dans ${D.HOST.wild}`);
    wild.chests.push({
        id: D.TALISMAN.chest.id, label: D.TALISMAN.chest.label, openText: D.TALISMAN.chest.openText, gold: 15 * D.HOST.level,
        questItem: { ...D.TALISMAN.item, quest: D.QUEST_IDS.talisman }, x: chestPos.x, y: chestPos.y
    });

    const giverPos = placeSafely(village, screens, D.GIVER.id);
    if (!giverPos) throw new Error(`événement ${D.ID} : pas de place pour ${D.GIVER.id} dans ${D.HOST.village}`);
    village.npcs.push({
        id: D.GIVER.id, name: D.GIVER.name, title: D.GIVER.title, idle: D.GIVER.idle, x: giverPos.x, y: giverPos.y,
        talk: [{ whenDone: D.QUEST_IDS.talisman, lines: D.GIVER.talkDone }]
    });

    // Répliques de fin de quête des habitants du royaume.
    const talkDone = (id, whenDone, lines) => { realm.npcs.find(n => n.id === id).talk = [{ whenDone, lines }]; };
    talkDone(D.ZHONG_KUI.id, D.QUEST_IDS.diyu, D.ZHONG_KUI.talkDone);
    talkDone(D.HUNGRY_GHOST.id, D.QUEST_IDS.lanternes, D.HUNGRY_GHOST.talkDone);

    [...D.PUZZLE_LIST, ...T.TERRAIN_PUZZLES].forEach(p => { PUZZLES[p.id] = p.def; });   // énigmes du royaume (moteur d'énigmes existant, seulement quand l'événement est actif)
    screens[D.REALM_ID] = realm;

    // Les six terrains au-delà de la salle d'entrée, reliés par des portes symétriques (certaines ne s'ouvrent qu'après un exploit : `requires`).
    T.TERRAINS.forEach(t => { screens[t.id] = buildTerrain(t); });
    T.LINKS.forEach(l => {
        const A = screens[l.from], B = screens[l.to], back = OPPOSITE[l.side];
        const a = gateCell(A, l.side), b = gateCell(B, back);
        A.exits.push({ x: a.x, y: a.y, to: B.id, label: l.label, arrive: inward(B, back), ...(l.requires ? { requires: l.requires, lockedMessage: l.lockedMessage } : {}) });
        B.exits.push({ x: b.x, y: b.y, to: A.id, label: A.name, arrive: inward(A, l.side) });
    });
    quests.push(...buildQuests());
    return true;
}

export default { id: D.ID, apply: applyWanderingSouls };
