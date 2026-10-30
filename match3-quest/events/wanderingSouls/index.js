// La Nuit des âmes errantes : applique l'événement au monde assemblé (couche A → B, voir events/README.md).
//
// Ajoute le Royaume des âmes errantes (écran hors carte, comme un souterrain), son entrée scellée dans la zone sauvage des Bambous,
// le talisman qui la descelle, la gardienne des rites du village et la chaîne de trois quêtes facultatives. Appelé seulement si
// l'événement est activé (events/config.js) ; ne retire ni ne modifie aucune donnée permanente (il n'ajoute que son énigme à PUZZLES).

import { buildZone, freeNeighbor } from '../../world/mapKit.js';
import { placeSafely } from '../../world/legends.js';
import { PUZZLES } from '../../puzzle/levels.js';
import * as D from './data.js';

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
            ...D.PUZZLE_LIST.map(p => chestAt(p.chest, p.chest.at, 3, { puzzle: p.id, questItem: { ...p.item, quest: D.QUEST_IDS.lanternes } })),
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

function buildQuests() {
    const T = D.QUESTS;
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
        })
    ];
}

/**
 * Crée le royaume, son entrée, le talisman, la gardienne des rites et les quêtes. Retourne `false` (sans rien modifier) si la région
 * hôte est absente du monde assemblé, p. ex. dans un monde de test réduit.
 */
export function applyWanderingSouls(screens, quests) {
    const wild = screens[D.HOST.wild], village = screens[D.HOST.village];
    if (!wild || !village) return false;
    const realm = buildRealm();

    // Entrée scellée sur la terre ferme de la zone sauvage, fermée tant que le talisman n'a pas été trouvé.
    const door = placeSafely(wild, screens, `${D.REALM_ID}_porte`);
    const back = door && freeNeighbor(wild, door.x, door.y);
    if (!door || !back) throw new Error(`événement ${D.ID} : pas de place pour l'entrée dans ${D.HOST.wild}`);
    wild.exits.push({
        x: door.x, y: door.y, to: D.REALM_ID, label: D.REALM.entrance, arrive: { ...realm.spawn },
        requires: D.TALISMAN.chest.id, lockedMessage: D.REALM.lockedMessage,
        closedWhen: D.QUEST_IDS.sceaux, closedMessage: D.REALM.closedMessage
    });
    realm.exits.push({ x: 0, y: realm.spawn.y, to: wild.id, label: D.REALM.exitLabel, arrive: back });

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
    talkDone(D.ZHONG_KUI.id, D.QUEST_IDS.sceaux, D.ZHONG_KUI.talkDone);
    talkDone(D.HUNGRY_GHOST.id, D.QUEST_IDS.lanternes, D.HUNGRY_GHOST.talkDone);

    D.PUZZLE_LIST.forEach(p => { PUZZLES[p.id] = p.def; });   // énigmes du royaume (moteur d'énigmes existant, seulement quand l'événement est actif)
    screens[D.REALM_ID] = realm;
    quests.push(...buildQuests());
    return true;
}

export default { id: D.ID, apply: applyWanderingSouls };
