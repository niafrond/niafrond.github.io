// Compagnons de combat (allies.js) : les six maîtres de classe se recrutent au fil de l'histoire : un dans la 1re région (Rizières), deux dans la 2e (Volcan),
// puis un par région (Gobi, Fleuve, Bambous).
// Chaque maître (PNJ `trainer_<classe>`, voir world/maps et world/text) attend le héros SUR SA ROUTE : il se tient dans le village, près du passage qui
// mène à la zone sauvage de la région (`recruit` posé sur le PNJ ; exploration.js : `pendingRecruit`). La discussion s'ouvre toute seule quand le héros passe à
// côté ou essaie de quitter le village ; le maître rejoint alors l'équipe (annonce « X a rejoint votre équipe »), puis un petit combat, mené avec lui dans
// l'équipe, le fait découvrir (`RECRUIT_FOES`, rencontre amicale sans embuscade). La quête `q_class_<classe>` se termine à la rencontre.
// Obligatoire : le soleil de la région (et ses mirages) n'apparaît qu'une fois la quête terminée.
// Absent du monde « historique » de story.js (buildLegacyWorld) : les maîtres n'existent que dans le Grand Monde.

import { occupancy, placeNearGate } from './junctions.js';

export const CLASS_TRIAL_QUESTS = [
    {
        id: 'q_class_barbarian',
        title: 'La voie du Guerrier',
        chapter: '✦ Compagnon — Gorges du Volcan',
        giver: 'trainer_barbarian', requires: ['q_sun_1'],
        objectives: [{ type: 'talk', target: 'trainer_barbarian', text: "Rencontrer Sun Wukong, sur la route de la zone sauvage", lines: ['Vous vous êtes présentés : la route continue ensemble.'] }],
        offer: ["Un archer ? On te dit malin, Hou Yi : tu as visé un soleil sans ciller. Moi, j'ai volé les pêches d'immortalité et mis le Palais Céleste sens dessus dessous. On devrait s'entendre.", "Je suis Sun Wukong, Roi Singe, et sur ces flancs de feu, je m'ennuie."],
        hint: ["Sun Wukong vous attend sur la route, à la frontière de la zone : approchez-vous de lui."],
        complete: ["Je te suis, archer ! Mon bâton parlera pour toi et mes côtes encaisseront à ta place. Si je tombe, je me relève au prochain combat.", "Tiens, justement : un sanglier de scories sort des coulées. Montrons-lui comment on se bat à deux."],
        reward: { gold: 60, xp: 80, fragment: "Croc du sanglier", class: 'barbarian' }
    },
    {
        id: 'q_class_templar',
        title: 'La voie du Commandant',
        chapter: '✦ Compagnon — Désert de Gobi',
        giver: 'trainer_templar', requires: ['q_sun_6'],
        objectives: [{ type: 'talk', target: 'trainer_templar', text: "Rencontrer Nezha, sur la route de la zone sauvage", lines: ['Vous vous êtes présentés : la route continue ensemble.'] }],
        offer: ["Archer, tu voyages seul dans un désert où les caravanes meurent faute de rempart. Je suis Nezha, et j'ai commandé les armées du ciel avant d'avoir l'âge de me raser.", "La voie du Commandant : la lance, le mur, l'ordre qui tient quand tout vacille."],
        hint: ["Nezha vous attend sur la route, à la frontière de la zone : approchez-vous de lui."],
        complete: ["Mes roues de feu sont à toi. Je me joins à ton groupe, archer. Mets-moi devant, et le sable cruel passera sur nous deux.", "Un brigand rôde justement sur la piste. Voyons comment tient le mur."],
        reward: { gold: 60, xp: 80, fragment: "Insigne de la garde", class: 'templar' }
    },
    {
        id: 'q_class_sorcerer',
        title: 'La voie du Mage',
        chapter: '✦ Compagnon — Lit du Fleuve Jaune',
        giver: 'trainer_sorcerer', requires: ['q_sun_4'],
        objectives: [{ type: 'talk', target: 'trainer_sorcerer', text: "Rencontrer Longwang, sur la route de la zone sauvage", lines: ['Vous vous êtes présentés : la route continue ensemble.'] }],
        offer: ["Le fleuve garde la mémoire de tout ce qu'il emporte, archer. Je suis Longwang, roi des dragons des eaux, et ce lit à sec est le plus triste de mes royaumes.", "Les talismans, les éléments, le qì sous toutes ses couleurs : c'est la voie du Mage antique."],
        hint: ["Longwang vous attend sur la route, à la frontière de la zone : approchez-vous de lui."],
        complete: ["Je viens avec toi : les nuages m'obéissent, la pluie aussi. Et retiens ceci : les grands sortilèges, les ultimes, ne répondent qu'à un Mage, au cœur d'une Xiūxiān.", "Un esprit s'agite justement sur la berge. Regarde ce que le qì peut faire quand on l'invite."],
        reward: { gold: 60, xp: 80, fragment: "Talisman du gué", class: 'sorcerer' }
    },
    {
        id: 'q_class_monk',
        title: 'La voie du Moine',
        chapter: '✦ Compagnon — Rizières Desséchées',
        giver: 'trainer_monk', requires: [], startWhen: { quest: 'q_sun_1' },
        objectives: [{ type: 'talk', target: 'trainer_monk', text: "Rencontrer Fuxi, sur la route de la zone sauvage", lines: ['Vous vous êtes présentés : la route continue ensemble.'] }],
        offer: ["Paix à vous, archer. Je suis Fuxi. J'ai tracé les huit trigrammes et appris aux hommes à nouer le filet ; je guette ces rizières desséchées depuis que le soleil a brûlé le monde.", "La voie du Moine ne frappe pas : elle se tient, elle guérit, elle laisse l'adversaire se fatiguer de lui-même."],
        hint: ["Fuxi vous attend sur la route, à la frontière de la zone : approchez-vous de lui."],
        complete: ["Je marcherai à vos côtés, seigneur : on n'apprend pas la patience en restant assis. Je partagerai votre qì et je tiendrai bon pour deux.", "Un vieil esprit des diguettes a gardé sa rancune, juste là. Laissez-moi vous montrer la patience."],
        reward: { gold: 60, xp: 80, fragment: "Cendre de sutra", class: 'monk' }
    },
    {
        id: 'q_class_alchemist',
        title: 'La voie du Alchimiste',
        chapter: '✦ Compagnon — Gorges du Volcan',
        giver: 'trainer_alchemist', requires: ['q_sun_1', 'q_class_barbarian'],
        objectives: [{ type: 'talk', target: 'trainer_alchemist', text: "Rencontrer Shennong, sur la route de la zone sauvage", lines: ['Vous vous êtes présentés : la route continue ensemble.'] }],
        offer: ["Un archer ! Parfait : j'ai besoin d'un cobaye. Pardon, d'un disciple. Je suis Shennong, j'ai goûté toutes les herbes du monde, et il en reste quelques-unes ici, dans les gorges.", "La voie de l'Alchimiste, c'est le contrôle : un peu de venin ici, un peu d'élixir là, et l'adversaire s'affaiblit pendant que toi, tu tiens."],
        hint: ["Shennong vous attend sur la route, à la frontière de la zone : approchez-vous de lui."],
        complete: ["Ma hotte d'herbes se transporte, figure-toi : je viens avec toi ! Mais les fleuves délavent mes poudres : si je tombe, ne me laisse pas dans l'eau.", "Un docteur-démon traîne sur le sentier : il a tout appris, sauf à se défendre. À l'expérience !"],
        reward: { gold: 60, xp: 80, fragment: "Fiole d'essai", class: 'alchemist' }
    },
    {
        id: 'q_class_shaman',
        title: 'La voie du Chamane',
        chapter: '✦ Compagnon — Forêt de Bambous Calcinée',
        giver: 'trainer_shaman', requires: ['q_sun_2'],
        objectives: [{ type: 'talk', target: 'trainer_shaman', text: "Rencontrer Jingwei, sur la route de la zone sauvage", lines: ['Vous vous êtes présentés : la route continue ensemble.'] }],
        offer: ["Approche, petit archer. Je suis Jingwei, la fille qui s'est noyée et qui comble la mer avec des cailloux. Les esprits m'ont dit que tu viendrais, et que tu ne savais pas les écouter.", "La voie du Chamane est celle des sceaux, du froid qui engourdit, des marques des ancêtres : elle ne tue pas, elle retient."],
        hint: ["Jingwei vous attend sur la route, à la frontière de la zone : approchez-vous d'elle."],
        complete: ["Alors je te suis, petit archer. Mes ailes feront ce qu'elles peuvent, et mes esprits feront le reste : je saurai sceller, geler, retenir. Mais l'Arbre céleste fait taire les esprits : là-haut, il faudra une autre voie.", "Un esprit-renard s'est glissé dans mes bambous. Écoute-les : les esprits te guident."],
        reward: { gold: 60, xp: 80, fragment: "Plume de renard", class: 'shaman' }
    }
];

// Région → [soleil, quête du maître] : le soleil n'apparaît qu'une fois la quête rendue.
export const CLASS_TRIAL_GATES = {
    rizieres: ['sun_1', 'q_class_monk'],
    volcan: ['sun_6', 'q_class_alchemist'],
    gobi: ['sun_4', 'q_class_templar'],
    fleuve: ['sun_2', 'q_class_sorcerer'],
    bambous: ['sun_3', 'q_class_shaman'],
};

// Région de chaque quête de compagnon (deux dans le Volcan) : elle se place juste avant la quête principale du soleil de sa région.
const TRIAL_REGION = { q_class_monk: 'rizieres', q_class_barbarian: 'volcan', q_class_alchemist: 'volcan', q_class_templar: 'gobi', q_class_sorcerer: 'fleuve', q_class_shaman: 'bambous' };

// Petit ennemi du combat de découverte de chaque maître (gabarit du catalogue, nom affiché, décalage de niveau négatif : un combat facile).
export const RECRUIT_FOES = {
    monk: { templateId: 'shu_jing', name: 'Esprit des diguettes', offset: -2 },
    barbarian: { templateId: 'sanglier_flammes', name: 'Sanglier de scories', offset: -2 },
    alchemist: { templateId: 'wen_shen', name: 'Docteur-démon', offset: -2 },
    templar: { templateId: 'brigand_sables', name: 'Brigand de la piste', offset: -2 },
    sorcerer: { templateId: 'gui_esprit', name: 'Esprit-cible du gué', offset: -2 },
    shaman: { templateId: 'huli_jing', name: 'Esprit-renard', offset: -2 }
};

export function applyClassTrials(screens, quests) {
    // Chaque quête de maître se place juste avant la quête principale du soleil de sa région (ordre du journal et de l'histoire).
    CLASS_TRIAL_QUESTS.forEach(quest => {
        const region = TRIAL_REGION[quest.id];
        const before = quests.findIndex(q => q.id === `q_${CLASS_TRIAL_GATES[region][0]}`);
        quests.splice(before >= 0 ? before : quests.length, 0, { ...quest });
    });
    Object.entries(CLASS_TRIAL_GATES).forEach(([region, [sun, quest]]) => {
        (screens[region]?.enemies || []).forEach(e => { if (e.id === sun || e.templateId === sun) e.showWhen = quest; });
    });
    // Chaque maître se poste sur le chemin du héros : près du passage du village vers la zone sauvage de sa région, et annonce sa rencontre.
    CLASS_TRIAL_QUESTS.forEach(quest => {
        const region = TRIAL_REGION[quest.id], classId = quest.reward.class;
        const village = screens[`${region}_village`];
        const npc = village?.npcs.find(n => n.id === quest.giver);
        if (!npc) return;
        const gate = village.exits.find(e => e.edge && e.span === 0 && !e.door && e.to === `${region}_wild`);
        const spot = gate && placeNearGate(village, gate, occupancy(village, screens), [5, 6, 4, 7, 3], [2, -2, 3, -3, 1, -1, 4, -4, 0])   // un peu avant le passage et à côté de l'axe : jamais dans le goulet;
        if (spot) { npc.x = spot.x; npc.y = spot.y; }
        npc.recruit = { quest: quest.id, classId, foe: { ...RECRUIT_FOES[classId] } };
    });
}
