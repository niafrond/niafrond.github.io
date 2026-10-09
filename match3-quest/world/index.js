// Assemblage du « Grand Monde » : les 10 sanctuaires de story.js (un Soleil-Boss chacun) sont précédés d'un village
// plein écran (avec maisons explorables) et d'une zone sauvage à traverser. Voir world/FORMAT.md.
//
// assembleWorld(baseScreens, baseQuests) retourne { screens, quests, regionOrder }. Les régions dont le fichier
// `world/maps/<R>.js` est absent restent inchangées, ce qui permet de livrer le monde région par région.

import { merchantNpc } from '../merchants.js';
import { getXPCostForLevel } from '../experience.js';
import { buildZone, arrivalFor, freeNeighbor } from './mapKit.js';
import { EXPANDED_SIZES, scaleScreen, widenGates, linkGates, openPerimeter, addWaterBorder } from './expand.js';
import { applyJunctions } from './junctions.js';
import { addPrepSpots } from './spots.js';
import { buildAquaticWorld, applyYubu } from './aquatic.js';
import { applyUnderground } from './underground.js';
import { MAPS } from './maps/index.js';
import { TEXTS } from './text/index.js';

export const REGION_ORDER = ['rizieres', 'fleuve', 'bambous', 'gobi', 'tonnerre', 'volcan', 'fauves', 'mer', 'fusang', 'lune'];

// Niveau recommandé par région (aligné sur REGION_UNLOCK_LEVEL de story.js) : sert à dimensionner l'XP des quêtes.
export const REGION_LEVEL = { rizieres: 1, fleuve: 4, bambous: 6, gobi: 11, tonnerre: 17, volcan: 22, fauves: 27, mer: 32, fusang: 37, lune: 40 };
const QUEST_XP_SHARE = { main: 0.6, side: 0.25 };   // part du coût d'un niveau (experience.js : getXPCostForLevel)

// Chaque quête rapporte de l'XP : au moins une fraction du coût d'un niveau de sa région.
export function questXp(quest, region) {
    const level = REGION_LEVEL[region] || 1;
    const levelCost = getXPCostForLevel(Math.max(2, level));
    const share = quest.side ? QUEST_XP_SHARE.side : QUEST_XP_SHARE.main;
    return Math.max(quest.reward?.xp || 0, Math.round(levelCost * share / 10) * 10);
}

const clone = value => JSON.parse(JSON.stringify(value));

// options.legacy : monde « à l'ancienne » (cartes à leur taille d'origine, sans agrandissement, jonctions ni monde aquatique), réservé aux
// tests de mécanique qui s'appuient sur les coordonnées historiques des sanctuaires.
export function assembleWorld(baseScreens, baseQuests, maps = MAPS, texts = TEXTS, options = {}) {
    const screens = clone(baseScreens);
    const legacyNpcs = {};
    Object.values(baseScreens).forEach(s => s.npcs.forEach(n => { legacyNpcs[n.id] = clone(n); }));
    const quests = [...baseQuests];
    const newQuests = [];
    const relocated = new Set();
    const sanctuaryOf = new Set();

    REGION_ORDER.forEach((region, index) => {
        const map = maps[region];
        if (!map) return;
        const text = texts[region] || {};
        const helpers = {
            npcDef: id => {
                const merchant = merchantNpc(id);
                if (merchant) return merchant;
                const t = text.npcs?.[id];
                const base = legacyNpcs[id];
                if (!t && !base) { console.warn(`[world] PNJ sans texte : ${id}`); return { id, name: id, idle: ['…'] }; }
                return { id, ...(base || {}), ...(t || {}) };
            },
            chestDef: id => ({ id, ...(text.chests?.[id] || {}) }),
            screenText: id => text.screens?.[id] || {}
        };
        const prev = REGION_ORDER[index - 1];
        const sanctuary = screens[region];
        sanctuaryOf.add(region);

        // Maisons : chaque intérieur est rattaché au village (par défaut) ou au hameau (`in: 'hamlet'`) via sa lettre.
        const housesOf = zone => {
            const houses = {};
            (map.interiors || []).filter(i => (i.in || 'village') === zone)
                .forEach(i => { houses[i.house] = { to: i.id, name: text.screens?.[i.id]?.name }; });
            return houses;
        };
        const houses = housesOf('village');

        const village = buildZone({
            ...map.village, region, kind: 'village', houses,
            exits: [...(map.village.exits || [])]
        }, helpers);
        const wild = buildZone({ ...map.wild, region, kind: 'wild' }, helpers);

        // Sorties automatiques de la chaîne : village ⇄ zone sauvage ⇄ sanctuaire, village ⇄ sanctuaire précédent.
        const addExit = (zone, spec, ch, exit) => {
            if ((spec.exits || []).some(e => e.at === ch)) return;
            const a = anchorOf(spec.grid, ch);
            if (a) zone.exits.push({ ...exit, x: a.x, y: a.y });
        };
        if (prev) addExit(village, map.village, '<', { to: prev, label: screens[prev].name });
        addExit(village, map.village, '>', { to: wild.id, label: wild.name });
        addExit(wild, map.wild, '<', { to: village.id, label: village.name });
        const gate = map.wild.gate || {};
        addExit(wild, map.wild, '>', {
            to: region, label: sanctuary.name,
            ...(gate.requires ? { requires: gate.requires, lockedMessage: gate.lockedMessage || text.screens?.[wild.id]?.gateMessage || 'Une force invisible barre la route du sanctuaire.' } : {})
        });

        // Hameau (2e village de la région) : relié à la zone sauvage par ses ancres `v` (wild, bord bas) et `^` (hameau, bord haut).
        let hamlet = null;
        if (map.hamlet) {
            hamlet = buildZone({ ...map.hamlet, region, kind: 'village', houses: housesOf('hamlet'), exits: [...(map.hamlet.exits || [])] }, helpers);
            addExit(hamlet, map.hamlet, '^', { to: wild.id, label: wild.name });
            addExit(wild, map.wild, 'v', { to: hamlet.id, label: hamlet.name });
            screens[hamlet.id] = hamlet;
        }
        screens[village.id] = village;
        screens[wild.id] = wild;
        (map.interiors || []).forEach(i => {
            const parent = (i.in || 'village') === 'hamlet' && hamlet ? hamlet : village;
            const interior = buildZone({ ...i, region, kind: 'house', biome: 'house', interior: true, exits: [] }, helpers);
            const a = anchorOf(i.grid, 'v');
            if (a) interior.exits.push({ x: a.x, y: a.y, to: parent.id, door: false, label: 'Sortie' });
            screens[i.id] = interior;
        });

        // Sanctuaire existant : plus de PNJ de village (relogés), ses sorties passent par la zone sauvage / le village suivant.
        const placedNpcs = [village, wild, ...(hamlet ? [hamlet] : []), ...(map.interiors || []).map(i => screens[i.id])].flatMap(z => z.npcs.map(n => n.id));
        placedNpcs.forEach(id => relocated.add(id));
        sanctuary.exits.forEach(exit => {
            if (prev && exit.to === prev) { exit.to = wild.id; exit.label = wild.name; delete exit.arrive; }
        });
        // première région : le sanctuaire n'avait pas de sortie ouest, on en crée une vers la zone sauvage
        if (!prev && !sanctuary.exits.some(e => e.to === wild.id)) {
            sanctuary.exits.push({ x: 0, y: sanctuary.spawn.y, to: wild.id, label: wild.name });
        }
        // la sortie est du sanctuaire précédent mène désormais au village de cette région
        if (prev) {
            screens[prev].exits.forEach(exit => {
                if (exit.to === region) { exit.to = village.id; exit.label = village.name; delete exit.arrive; }
            });
        }
        if (map.sanctuary?.waypoint) {
            sanctuary.waypoint = { ...map.sanctuary.waypoint, name: text.waypointName || `Pierre de voyage — ${sanctuary.name}` };
        }
        if (text.arrivalSanctuary?.length) sanctuary.arrival = text.arrivalSanctuary;
        // l'ancien texte d'arrivée de la région passe au village (première visite)
        if (sanctuary.arrival && !village.arrival) { village.arrival = sanctuary.arrival; delete sanctuary.arrival; }
        if (text.quests?.length) newQuests.push(...text.quests);
    });

    // Grandes cartes reliées par leurs bords : zones sauvages, sanctuaires et hameaux sont agrandis, les villages gardent
    // leur taille ; tous les passages de bord (3 cases) ressortent en face, alignés (voir world/expand.js).
    if (!options.legacy) {
        buildAquaticWorld(screens);   // Mer des Mille Îlots : reliée à l'Anse des Coquillages, accessible avec le Pas de Yu
        REGION_ORDER.forEach(region => {
            if (!maps[region]) return;
            scaleScreen(screens[region], ...EXPANDED_SIZES.sanctuary);
            scaleScreen(screens[`${region}_wild`], ...EXPANDED_SIZES.wild);
            if (screens[`${region}_hamlet`]) scaleScreen(screens[`${region}_hamlet`], ...EXPANDED_SIZES.hamlet);
            widenGates(screens[`${region}_village`]);
        });
        linkGates(screens);
        Object.values(screens).forEach(openPerimeter);   // plus de bordure factice : les terrains sont reliés, la limite de la carte suffit
        Object.values(screens).forEach(addWaterBorder);  // ... mais de l'eau tout autour des terrains (franchissable avec le Pas de Yu)
        // Jonctions gardées : objet à rapporter à un garde, gardien spécial à vaincre (world/junctions.js).
        applyJunctions(screens, quests, REGION_LEVEL);
        applyYubu(screens, quests);   // reliques du Pas de Yu + quête de Gui (marcher sur les eaux)
        Object.values(screens).forEach(addPrepSpots);   // préparation du terrain : pièges, hautes herbes, belvédères
        applyUnderground(screens);   // cavernes et cryptes dans le noir (torche vendue par les marchands)

    }

    // Retire des sanctuaires les PNJ qui ont déménagé.
    sanctuaryOf.forEach(id => { screens[id].npcs = screens[id].npcs.filter(n => !relocated.has(n.id)); });

    // Tuiles d'arrivée symétriques + point d'apparition devant les pierres de voyage.
    Object.values(screens).forEach(s => {
        s.exits.forEach(e => {
            const target = screens[e.to];
            if (!target) return;
            const arrive = arrivalFor(s.id, target);
            if (arrive && !e.arrive) e.arrive = arrive;
        });
        if (s.waypoint) s.waypoint.spot = freeNeighbor(s, s.waypoint.x, s.waypoint.y) || { ...s.spawn };
    });

    // Quêtes : histoire principale, quêtes secondaires existantes, puis les nouvelles (toutes `side`).
    quests.push(...newQuests.map(q => ({ side: true, ...q })));
    const npcRegion = {};
    Object.values(screens).forEach(sc => sc.npcs.forEach(n => { npcRegion[n.id] = sc.region; }));
    quests.forEach((q, i) => {
        quests[i] = { ...q, reward: { ...(q.reward || {}), xp: questXp(q, npcRegion[q.giver] || 'rizieres') } };
    });
    return { screens, quests, regionOrder: REGION_ORDER };
}

function anchorOf(grid, ch) {
    for (let y = 0; y < grid.length; y++) {
        const x = grid[y].indexOf(ch);
        if (x >= 0) return { x, y };
    }
    return null;
}
