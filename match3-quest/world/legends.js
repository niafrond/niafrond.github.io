// Quêtes des Gardiens Célestes (ultimes de légende). Logique pure, sans DOM.
//
// Les quatre Gardiens des points cardinaux (Zhuque au sud, Xuanwu au nord, Baihu à l'ouest, Qinglong à l'est) ont perdu la mémoire sous la chaleur des
// dix soleils. Dans quatre régions, un PNJ du village demande au héros de retrouver une relique cachée dans la zone sauvage, puis d'affronter le
// Gardien, devenu boss unique : celui qui tient debout devant lui reçoit sa bénédiction, un ultime utilisable par TOUTES les classes
// (spells.json : `unlock.quest` ; ultimates.js : getSelectableUltimates). Modèle : world/collars.js.

import { occupancy, placeInLand } from './junctions.js';

/**
 * Comme placeInLand, mais refuse une case qui emmurerait une autre entité ou une sortie : tout doit rester atteignable à pied depuis
 * l'apparition, les entités posées (hors gardiens de porte) comptant comme obstacles. Les cases candidates qui isoleraient quelque chose sont écartées (placeInLand, paramètre `accept`).
 */
function placeSafely(screen, screens, id) {
    // l'occupation et les isolements déjà présents ne dépendent pas de la case essayée : calculés une fois par placement
    const occ = occupancy(screen, screens);
    const before = unreachedWith(screen, occ, null);
    return placeInLand(screen, occ, id, pos => !isolatesSomething(screen, occ, before, pos));
}

function unreachedWith(screen, occ, pos) {
    const entities = [...screen.npcs, ...screen.chests, ...screen.enemies.filter(e => !e.guardsDoor)];
    const targets = [...entities, ...screen.exits, ...(pos ? [pos] : [])];
    const solid = new Set(targets.map(e => `${e.x},${e.y}`));
    const seen = new Set([`${screen.spawn.x},${screen.spawn.y}`]);
    const queue = [screen.spawn];
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let head = 0; head < queue.length; head++) {
        const { x, y } = queue[head];
        DIRS.forEach(([dx, dy]) => {
            const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
            if (!seen.has(k) && !occ.blocked(nx, ny) && !solid.has(k)) { seen.add(k); queue.push({ x: nx, y: ny }); }
        });
    }
    return new Set(targets.filter(e => !DIRS.some(([dx, dy]) => seen.has(`${e.x + dx},${e.y + dy}`))).map(e => `${e.x},${e.y}`));
}

/** Vrai si poser une entité en `pos` rend inatteignable une case qui l'était (les isolements déjà présents sur la carte ne comptent pas). */
function isolatesSomething(screen, occ, before, pos) {
    const after = unreachedWith(screen, occ, pos);
    return after.has(`${pos.x},${pos.y}`) || [...after].some(k => !before.has(k));
}

export const LEGENDS = [
    { region: 'volcan', ultimate: 'ultimateVermilionBird', questId: 'sq_legend_zhuque', level: 10,
      thanks: 'Zhuque veille de nouveau sur le Sud, et c\'est grâce à vous. Que sa flamme vous accompagne.',
      giver: { id: 'ember_keeper_rong', name: 'Rong la Gardienne des Braises', title: 'Veilleuse du feu du Sud',
          idle: ['Chaque matin, je compte les braises du foyer. Chaque matin, il en manque une. Je commence à soupçonner un oiseau.'] },
      chest: { id: 'legend_zhuque_relic', label: 'Plume de braise', openText: 'Sous une dalle encore tiède, une plume rouge et or qui ne brûle pas. Elle vibre dans votre main, comme si elle reconnaissait quelqu\'un.' },
      enemy: { id: 'legend_zhuque_boss', templateId: 'zhuque', name: 'Zhuque, l\'Oiseau Vermillon', offset: 3 },
      title: 'Le feu du Sud', fragment: 'Ultime : Renaissance de l\'Oiseau Vermillon',
      offer: [
          'Archer, le Sud a un gardien : Zhuque, l\'Oiseau Vermillon. Quand les dix soleils sont montés, il a brûlé de rage et de honte, et depuis, il ne reconnaît plus personne, pas même ses cendres.',
          'Retrouvez la plume de braise qu\'il a perdue dans les coulées : elle seule peut lui rappeler qui il est. Puis affrontez-le, car un gardien ne confie son feu qu\'à celui qui tient debout devant lui.'],
      hint: ['La plume de braise gît au sud-est des coulées rougeoyantes. Zhuque survole les passerelles : il frappe fort, et il renaît de ses cendres.'],
      complete: ['La plume est chaude… et l\'oiseau s\'est calmé. Il vous a reconnu.', 'Zhuque vous offre sa renaissance : quand la jauge de rage sera pleine, son feu vermillon vous relèvera. Ne la gaspillez pas.'] },
    { region: 'fleuve', ultimate: 'ultimateBlackTortoise', questId: 'sq_legend_xuanwu', level: 17,
      thanks: 'Xuanwu a refermé sa carapace sur le fleuve, et c\'est grâce à vous. Que sa force vous accompagne.',
      giver: { id: 'ferryman_bian', name: 'Bian le Passeur', title: 'Passeur du fleuve du Nord',
          idle: ['Je passe les gens d\'une rive à l\'autre depuis quarante ans. Le fleuve, lui, passe devant moi sans me regarder.'] },
      chest: { id: 'legend_xuanwu_relic', label: 'Écaille de carapace', openText: 'Dans la vase, une écaille noire grande comme une assiette, gravée de signes que personne ici ne sait lire. Elle reste fraîche, même en plein midi.' },
      enemy: { id: 'legend_xuanwu_boss', templateId: 'xuanwu', name: 'Xuanwu, la Tortue Noire', offset: 3 },
      title: 'La carapace du Nord', fragment: 'Ultime : Carapace de la Tortue Noire',
      offer: [
          'Le fleuve a un gardien, archer, et c\'est plus gros qu\'une barque : Xuanwu, la Tortue Noire du Nord, un serpent enroulé autour de sa carapace. Depuis la sécheresse, elle dort au fond de la vase et prend les passeurs pour des cailloux.',
          'Une écaille de sa carapace s\'est détachée dans les méandres. Rapportez-la-moi, puis réveillez la tortue : elle n\'ouvre sa carapace qu\'à ceux qui ne reculent pas devant elle.'],
      hint: ['L\'écaille noire est enfouie au sud-est des méandres. Xuanwu rôde non loin, lente mais lourde : méfiez-vous de son serpent.'],
      complete: ['L\'écaille est tiède maintenant, et la vase s\'est mise à couler. Elle s\'est réveillée.', 'Xuanwu vous prête sa carapace : une fois la rage pleine, vous frapperez fort et rien ne vous entamera de quelques tours. Passez, archer.'] },
    { region: 'fauves', ultimate: 'ultimateWhiteTiger', questId: 'sq_legend_baihu', level: 33,
      thanks: 'Baihu chasse en paix dans les herbes, et c\'est grâce à vous. Que sa vitesse vous accompagne.',
      giver: { id: 'tracker_hu_mu', name: 'Hu Mu la Pisteuse', title: 'Chasseuse des hautes herbes',
          idle: ['J\'ai pisté des cerfs, des sangliers, des loups. Une seule fois, j\'ai vu des empreintes blanches. Je n\'ai pas osé les suivre.'] },
      chest: { id: 'legend_baihu_relic', label: 'Griffe d\'argent', openText: 'Dans un creux de rocher, une griffe argentée aussi longue qu\'une dague, polie comme un miroir. Les herbes alentour se couchent toutes dans le même sens.' },
      enemy: { id: 'legend_baihu_boss', templateId: 'baihu', name: 'Baihu, le Tigre Blanc', offset: 3 },
      title: 'La chasse de l\'Ouest', fragment: 'Ultime : Chasse du Tigre Blanc',
      offer: [
          'Les hautes herbes ont un gardien, et il n\'aime pas qu\'on le suive : Baihu, le Tigre Blanc de l\'Ouest. Il chasse seul, et depuis les soleils, il chasse tout ce qui bouge, même ses anciens alliés.',
          'Il a laissé une griffe d\'argent dans les rochers, un jour de colère. Rapportez-la-moi, puis affrontez-le à la loyale : le Tigre Blanc ne respecte que ceux qui lui tiennent tête sans trembler.'],
      hint: ['La griffe d\'argent est au sud-est des hautes herbes, dans les rochers. Baihu chasse dans les parages : il bondit vite et frappe plus vite encore.'],
      complete: ['La griffe est à sa place, et le Tigre Blanc vous regarde comme on regarde un égal.', 'Baihu vous accorde sa chasse : une fois la rage pleine, vous bondirez sur l\'ennemi et sa force faiblira. Un conseil : ne tournez jamais le dos au vent.'] },
    { region: 'fusang', ultimate: 'ultimateAzureDragon', questId: 'sq_legend_qinglong', level: 43,
      thanks: 'Qinglong fait pleuvoir de nouveau sur l\'Est, et c\'est grâce à vous. Que sa tempête vous accompagne.',
      giver: { id: 'monk_qing_yun', name: 'Qing Yun', title: 'Moine des terrasses',
          idle: ['Je médite sur une terrasse depuis trente ans. Le jour où la pluie reviendra, j\'aimerais bien être là pour la voir tomber.'] },
      chest: { id: 'legend_qinglong_relic', label: 'Perle d\'azur', openText: 'Dans un nœud de racines dorées, une perle d\'azur de la taille d\'un poing. En la tenant, vous entendez, très loin, le tonnerre d\'un orage qui n\'est pas encore venu.' },
      enemy: { id: 'legend_qinglong_boss', templateId: 'qinglong', name: 'Qinglong, le Dragon d\'Azur', offset: 3 },
      title: 'La tempête de l\'Est', fragment: 'Ultime : Tempête du Dragon d\'Azur',
      offer: [
          'À l\'est, là où le soleil se lève, vit Qinglong, le Dragon d\'Azur. Il est le maître de la pluie et du tonnerre, et depuis que les dix soleils ont tout séché, il refuse de faire pleuvoir : « À quoi bon ? » dit-il.',
          'Sa perle d\'azur est cachée dans les racines de Fusang. Retrouvez-la, puis montrez-lui qu\'il reste quelque chose à sauver : un dragon ne déchaîne sa tempête que pour qui a gagné le droit de la demander.'],
      hint: ['La perle d\'azur est enfouie au sud-est des racines et des branches dorées. Qinglong plane au-dessus : il frappe du ciel, et le tonnerre l\'accompagne.'],
      complete: ['La perle brille de nouveau, et là-haut, les premiers nuages se rassemblent. Il a décidé de faire pleuvoir.', 'Qinglong vous confie sa tempête : une fois la rage pleine, il frappera, vous soignera et vous protégera quelques tours. L\'Est a retrouvé son maître du ciel.'] }
];

/**
 * Pose, pour chaque Gardien, le PNJ du village, la relique et le boss de la zone sauvage, et la quête qui récompense l'ultime de légende.
 * À appeler après l'agrandissement des cartes (les cases libres sont calculées sur les cartes finales).
 */
export function applyLegendQuests(screens, quests) {
    LEGENDS.forEach(l => {
        const village = screens[`${l.region}_village`];
        const wild = screens[`${l.region}_wild`];
        if (!village || !wild) return;
        const npcPos = placeSafely(village, screens, l.giver.id);
        if (!npcPos) throw new Error(`légende ${l.questId} : pas de place pour ${l.giver.id}`);
        village.npcs.push({
            id: l.giver.id, name: l.giver.name, title: l.giver.title, idle: l.giver.idle, x: npcPos.x, y: npcPos.y,
            talk: [{ whenDone: l.questId, lines: [`« ${l.thanks} »`] }]
        });
        const chestPos = placeSafely(wild, screens, l.chest.id);
        if (!chestPos) throw new Error(`légende ${l.questId} : pas de place pour la relique`);
        wild.chests.push({ id: l.chest.id, label: l.chest.label, openText: l.chest.openText, gold: 20 * l.level, x: chestPos.x, y: chestPos.y });
        const enemyPos = placeSafely(wild, screens, l.enemy.id);
        if (!enemyPos) throw new Error(`légende ${l.questId} : pas de place pour le Gardien`);
        wild.enemies.push({
            id: l.enemy.id, templateId: l.enemy.templateId, name: l.enemy.name, kind: 'sentinel', offset: l.enemy.offset,
            permanent: true, boss: { name: l.enemy.name, level: l.level }, x: enemyPos.x, y: enemyPos.y
        });
        quests.push({
            id: l.questId, title: l.title, chapter: `✦ Quête secondaire (légende) — ${village.name}`,
            giver: l.giver.id, turnIn: l.giver.id, requires: [], side: true,
            objectives: [
                { type: 'chest', target: l.chest.id, text: `Retrouver la relique du Gardien (${wild.name}, dans les terres au sud-est)` },
                { type: 'kill', target: l.enemy.id, text: `Affronter le Gardien Céleste : ${l.enemy.name} (${wild.name})` }
            ],
            offer: l.offer, hint: l.hint, complete: l.complete,
            reward: { gold: Math.min(200, 100 + 2 * l.level), fragment: l.fragment, ultimate: l.ultimate, xp: 150 }
        });
    });
    return screens;
}
