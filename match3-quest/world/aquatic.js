// Monde aquatique et « Pas de Yu » (yubu). Logique pure, sans DOM.
//
//  - la quête `sq_pas_de_yu` (Gui la tortue noire, à Port-à-Sec de Hekou) enseigne la technique sacrée : le Rouleau du Pas de Yu
//    et la Stèle des Neuf Pas, cachés dans deux zones sauvages lointaines, puis remise à Gui. Une fois la quête terminée, le héros
//    marche sur toutes les eaux (exploration.js : `canWalkOnWater`) ;
//  - le Monde aquatique (Mer des Mille Îlots + Île de la Tortue-Dragon, région « mer ») est une carte de mer ouverte : on y accède
//    depuis l'Anse des Coquillages par un passage qui exige le Pas de Yu. Ses eaux (`screen.aquatic`) sont franchissables.

import { buildZone } from './mapKit.js';
import { occupancy, placeInLand } from './junctions.js';
import { widenGates } from './expand.js';

export const YUBU_QUEST_ID = 'sq_pas_de_yu';
export const ARCHIPEL_ID = 'mer_archipel';
export const ISLE_ID = 'mer_ile_dragon';

// Grille d'îles : tout est eau (« ~ ») sauf des îles elliptiques (« . ») et quelques récifs (« # »).
function seaGrid(w, h, isles, reefs, anchors, bridges = []) {
    const g = Array.from({ length: h }, () => Array(w).fill('~'));
    isles.forEach(([cx, cy, rx, ry]) => {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) g[y][x] = '.';
    });
    bridges.forEach(([x0, y0, x1, y1]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = '='; });
    reefs.forEach(([x, y]) => { if (g[y][x] === '~') g[y][x] = '#'; });
    Object.entries(anchors).forEach(([ch, [x, y]]) => { g[y][x] = ch; });
    return g.map(r => r.join(''));
}

const ARCHIPEL_GRID = seaGrid(36, 26,
    [[3, 13, 3.4, 3.2], [12, 6, 3.4, 2.8], [20, 18, 3.8, 3.2], [29, 7, 3.6, 3], [31, 20, 2.8, 2.4], [33, 12, 2.6, 3.2]],
    [[8, 10], [9, 11], [16, 12], [24, 11], [17, 22], [24, 22], [26, 14], [14, 17], [6, 20], [7, 21], [22, 3], [34, 3], [10, 15], [28, 12]],
    { '<': [0, 13], '>': [35, 12], 'W': [11, 5], '1': [13, 7], '2': [20, 19], '3': [29, 8], '4': [31, 20], '5': [21, 17], '6': [28, 6] });

const ISLE_GRID = seaGrid(22, 16,
    [[11, 8, 8.2, 5.6], [1, 8, 2.6, 1.4]],
    [[3, 3], [4, 12], [18, 3], [19, 13], [2, 14], [20, 7]],
    { '<': [0, 8], '1': [11, 5], '2': [11, 11], '3': [15, 8], 'W': [6, 6] });

const TEXT = {
    [ARCHIPEL_ID]: { name: 'Mer des Mille Îlots', arrival: [
        'La mer se déploie à perte de vue, bleue comme un ciel retourné. Vos semelles frôlent l\'eau sans y entrer : le Pas de Yu vous porte.',
        'Des îlots de corail et de bambou flottent çà et là, comme les pions d\'une partie que les dragons joueraient à la lune.'] },
    [ISLE_ID]: { name: 'Île de la Tortue-Dragon', arrival: [
        'Un îlot rond, couvert de mousse, repose sur la mer comme une carapace. Il respire, lentement. On dirait qu\'il dort.'] }
};

const NPCS = {
    hermit_nu: { id: 'hermit_nu', name: 'Nu', title: 'Pêcheur-ermite des Mille Îlots',
        idle: ['Voilà quarante ans que je pêche debout sur l\'eau et personne ne me croit. Les poissons, eux, trouvent ça normal.',
            'Le secret du Pas de Yu ? Ne pas y penser. Dès qu\'on réfléchit, on coule. Fâcheux pour un lettré.',
            'Sur l\'île la plus à l\'est dort la Tortue-Dragon. Ne la réveillez pas : elle a mauvais caractère, et un sens du temps très approximatif.'],
        talk: [{ whenDone: 'mer_ile_dragon_guardian', lines: ['Vous avez réveillé la Tortue-Dragon et vous êtes encore sec ? Vous êtes plus fort que moi, et je suis ermite depuis quarante ans.'] }] },
    yu_spirit: { id: 'yu_spirit', name: 'Esprit de Yu', title: 'Domptage des eaux',
        idle: ['J\'ai creusé neuf fleuves et marché treize ans sans rentrer chez moi. Ma jambe en est restée boiteuse : de là mon pas, qui n\'est ni droit ni gauche.',
            'Trois pas en avant, trois de côté, un en arrière : l\'eau croit que vous êtes un des siens. Ce n\'est pas de la magie, c\'est de la politesse.',
            'Prenez ce qui dort sur cette île. Je n\'en ai plus l\'usage : les morts ne dépensent pas.'] }
};
const CHESTS = {
    mer_arch_reliquaire: { label: 'Reliquaire corallien', openText: 'Dans une anfractuosité de corail, un reliquaire scellé de nacre : des perles grosses comme des yeux de dragon.' },
    mer_arch_epave: { label: 'Épave de jonque', openText: 'Une jonque échouée sur un récif. Dans la cale, des pièces de cuivre, noircies par le sel, mais bien réelles.' },
    mer_arch_tortue: { label: 'Coffre de la carapace', openText: 'Sous une dalle de corail, un coffre de laque verte : un cadeau d\'un navigateur à un dieu qui n\'a jamais répondu.' },
    mer_isle_tresor: { label: 'Trésor de la Tortue-Dragon', openText: 'Sous la carapace moussue dort le trésor de Yu : des lingots de jade, des perles et un éclat de lune que la mer a poli.' }
};

const R = 13;   // niveau de la région « mer »
const chest = (id, at, tier) => ({ id, at, gold: 15 * R * tier });

function buildAquaticZone(id, grid, spec) {
    const text = TEXT[id];
    const zone = buildZone({ id, region: 'mer', biome: 'coast', kind: 'wild', grid, ...spec }, {
        npcDef: nid => NPCS[nid], chestDef: cid => ({ id: cid, ...CHESTS[cid] }), screenText: () => text
    });
    zone.aquatic = true;
    // L'eau d'un écran aquatique est un liquide franchissable : on la garde comme décor (pas comme obstacle).
    return zone;
}

/**
 * Crée le Monde aquatique et le relie à l'Anse des Coquillages (`mer_hamlet`). À appeler avant l'agrandissement des cartes.
 */
export function buildAquaticWorld(screens) {
    const hamlet = screens.mer_hamlet;
    if (!hamlet) return screens;
    const archipel = buildAquaticZone(ARCHIPEL_ID, ARCHIPEL_GRID, {
        npcs: [{ id: 'hermit_nu', at: '1' }],
        chests: [chest('mer_arch_reliquaire', '2', 2), chest('mer_arch_epave', '3', 2), chest('mer_arch_tortue', '4', 3)],
        enemies: [
            { id: 'mer_arch_wyrm', at: '5', templateId: 'storm_wyrm', name: 'Wyrm des hauts-fonds', kind: 'sentinel', offset: 1, permanent: true },
            { id: 'mer_arch_witch', at: '6', templateId: 'ice_witch', name: 'Sorcière des marées', kind: 'sentinel', offset: 1, permanent: true }
        ],
        exits: [{ at: '<', to: 'mer_hamlet', label: 'Anse des Coquillages' }, { at: '>', to: ISLE_ID, label: 'Île de la Tortue-Dragon' }]
    });
    // Deux serpents de mer patrouillent à la surface de l'eau (ils ne sont pas posés sur des ancres : ce serait de la terre).
    [['mer_arch_serpent_a', [[15, 9], [23, 9]]], ['mer_arch_serpent_b', [[16, 22], [16, 14]]]].forEach(([id, route]) => {
        archipel.enemies.push({ id, templateId: 'deep_sea_serpent', name: 'Serpent des Mille Îlots', kind: 'patrol', offset: 0,
            x: route[0][0], y: route[0][1], patrol: route });
    });
    const isle = buildAquaticZone(ISLE_ID, ISLE_GRID, {
        npcs: [{ id: 'yu_spirit', at: '1' }],
        chests: [chest('mer_isle_tresor', '2', 4)],
        enemies: [{ id: 'mer_ile_dragon_guardian', at: '3', templateId: 'frost_dragon', name: 'Tortue-Dragon endormie', kind: 'sentinel', offset: 2, permanent: true }],
        exits: [{ at: '<', to: ARCHIPEL_ID, label: 'Mer des Mille Îlots' }]
    });
    // Le passage de l'Anse vers la mer : fermé tant que le Pas de Yu n'est pas appris.
    const row = 2;   // rangée de la salle d'origine du hameau où le mur est s'ouvre
    hamlet.exits.push({
        x: hamlet.w - 1, y: row, to: ARCHIPEL_ID, label: 'Mer des Mille Îlots', requires: YUBU_QUEST_ID,
        lockedMessage: 'La mer s\'étend jusqu\'à l\'horizon, sans pont ni barque : seul celui qui connaît le Pas de Yu peut y marcher. Gui la tortue noire, à Port-à-Sec de Hekou, en connaît l\'histoire.'
    });
    screens[ARCHIPEL_ID] = archipel;
    screens[ISLE_ID] = isle;
    widenGates(archipel);
    widenGates(isle);
    return screens;
}

const YUBU = {
    chests: [
        { id: 'yu_scroll_tonnerre', screen: 'tonnerre_wild', label: 'Faille du Rouleau',
          openText: 'Au fond d\'une faille balayée par l\'orage, un rouleau de soie jaunie : les premiers pas de la marche de Yu, dessinés comme une danse. Vous le glissez sous votre tunique.' },
        { id: 'yu_stele_gobi', screen: 'gobi_wild', label: 'Stèle des Neuf Pas',
          openText: 'Dans les dunes, une stèle à demi ensablée : neuf empreintes de pieds, l\'une plus profonde que les autres, comme celles d\'un homme qui boite. Vous les copiez sur votre manche.' }
    ],
    quest: {
        id: YUBU_QUEST_ID, title: 'Le Pas de Yu', giver: 'gui_turtle', turnIn: 'gui_turtle', requires: [], side: true,
        offer: [
            'Tu veux marcher sur l\'eau, archer ? Je suis la tortue noire de la rivière Luo : c\'est sur mon dos que Yu le Grand lut les neuf nombres, avant de dompter les crues.',
            'Il en tira une marche sacrée, le yubu, le Pas de Yu : trois pas en avant, trois de côté, un en arrière. Sa jambe malade lui donnait ce rythme boiteux, et les eaux se sont mises à le porter.',
            'Il n\'en reste que deux moitiés. Le Rouleau dort dans une faille des crêtes foudroyées, sous les Monts du Tonnerre. La Stèle des Neuf Pas, elle, s\'ensable dans les dunes du Gobi. Rapporte-moi ce qu\'elles disent.'
        ],
        hint: ['Le Rouleau du Pas de Yu est au fond d\'une faille des Crêtes Foudroyées (Monts du Tonnerre), la Stèle des Neuf Pas dans les Dunes des Voix Sablées (Gobi), côté sud-est de chaque carte.'],
        complete: [
            'Voilà qui dit tout : ton rouleau est la danse, ta stèle est la mesure. Mets-toi debout, là. Trois pas en avant… trois de côté… un en arrière. Non, l\'autre pied. Voilà.',
            'Sens-tu la mare qui ne t\'avale plus ? C\'est le Pas de Yu : tu ne marches pas sur l\'eau, tu lui demandes poliment de te laisser passer. Va, archer. La mer est grande, et elle t\'attend.'
        ],
        reward: { gold: 150, fragment: 'Pas de Yu', xp: 80 }
    }
};

/**
 * Pose les deux reliques du Pas de Yu (coffres dans le terrain agrandi de deux zones sauvages) et crée la quête de Gui.
 * À appeler après l'agrandissement des cartes.
 */
export function applyYubu(screens, quests) {
    YUBU.chests.forEach(c => {
        const holder = screens[c.screen];
        if (!holder) return;
        const pos = placeInLand(holder, occupancy(holder, screens), c.id);
        if (!pos) throw new Error(`Pas de Yu : pas de place pour ${c.id}`);
        holder.chests.push({ id: c.id, label: c.label, openText: c.openText, gold: 60, x: pos.x, y: pos.y });
    });
    quests.push({
        ...YUBU.quest, chapter: `✦ Quête secondaire — ${screens.fleuve?.name || 'Lit du Fleuve Jaune'}`,
        objectives: [
            { type: 'chest', target: 'yu_scroll_tonnerre', text: 'Retrouver le Rouleau du Pas de Yu (Crêtes Foudroyées, Monts du Tonnerre, dans les terres au sud-est)' },
            { type: 'chest', target: 'yu_stele_gobi', text: 'Retrouver la Stèle des Neuf Pas (Dunes des Voix Sablées, Gobi, dans les terres au sud-est)' }
        ]
    });
    return screens;
}
