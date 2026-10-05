// Jonctions gardées : certains passages entre deux cartes sont fermés tant qu'on n'a pas rapporté un objet particulier à un garde
// (quête « objet » : coffre à trouver dans les terres d'une carte voisine, puis remise au garde) ou vaincu un gardien spécial.
// Les verrous passent par `exit.requires` (quête terminée ou ennemi vaincu) : aucune mécanique nouvelle côté moteur.
// Logique pure, sans DOM ; appliquée par `assembleWorld` après l'agrandissement des cartes (world/expand.js).

const key = (x, y) => `${x},${y}`;
const inRects = (rects, x, y) => (rects || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);

export const JUNCTIONS = [
    // ── Objet à rapporter à un garde (village → zone sauvage) ─────────────────────────────────────────────────
    {
        id: 'passerelle_hekou', type: 'item', region: 'fleuve', from: 'fleuve_village', to: 'fleuve_wild',
        guard: {
            id: 'sergeant_mo', name: 'Sergent Mo', title: 'Garde de la passerelle',
            idle: [
                'Halte ! La passerelle des méandres est fermée à qui n\'a pas de sceau de passage. Les ordres viennent de la préfecture.',
                'Pas de sceau, pas de passage. Même pour un archer. Surtout pour un archer : on dit qu\'ils perdent leurs papiers.'
            ],
            after: ['La chaîne est levée pour vous. Mais ne dites pas à la préfecture que j\'ai laissé passer quelqu\'un sans rapport en triple exemplaire.']
        },
        item: { chest: 'rizieres_courier_satchel', screen: 'rizieres_wild', fragment: 'Cire impériale', label: 'Besace du courrier égaré', name: 'sceau de courrier impérial',
            openText: 'Sous un roseau sec gît la besace d\'un courrier impérial, mort de soif avant d\'avoir atteint le fleuve. Son sceau de passage est encore dedans : vous le glissez dans votre manche.' },
        quest: {
            id: 'jq_passerelle_hekou', title: 'Le sceau de la passerelle',
            objective: 'Retrouver le sceau d\'un courrier impérial (Digue et Marais Craquelés, dans les terres au sud-est)',
            offer: ['Un sceau de courrier impérial, voilà ce qu\'il me faut. Un courrier en portait un : il a disparu dans les marais craquelés de la digue, du côté des Rizières. On a retrouvé son cheval, pas son sceau.', 'Rapportez-le-moi et je lève la chaîne.'],
            hint: ['Le courrier a dû s\'écrouler dans les marais craquelés de la digue, du côté des Rizières, vers le sud-est. Cherchez une besace.'],
            complete: ['Le sceau ! Intact, même la cire n\'a pas fondu. Vous venez d\'épargner trois mois de paperasse à la préfecture.', 'Passez, archer. La chaîne est levée, et je n\'ai rien vu.']
        },
        lockedMessage: 'Une chaîne ferme la passerelle des méandres : le Sergent Mo exige un sceau de courrier impérial.'
    },
    {
        id: 'dernier_puits', type: 'item', region: 'gobi', from: 'gobi_village', to: 'gobi_wild',
        guard: {
            id: 'captain_yaer', name: 'Capitaine Yaer', title: 'Gardien du dernier puits',
            idle: [
                'Pas une goutte, pas un pas ! Personne ne s\'enfonce dans les dunes sans une gourde pleine. J\'en ai enterré trop, de ceux qui y croyaient.',
                'Je ne suis pas méchant, archer, je suis arithméticien : une gourde pour la route, une gourde pour le retour.'
            ],
            after: ['Votre gourde est pleine, la mienne aussi. Les dunes vous attendent. Elles sont patientes, mais pas hospitalières.']
        },
        item: { chest: 'bambous_sealed_gourd', screen: 'bambous_wild', fragment: 'Cuir de gourde', label: 'Gourde de la source scellée', name: 'gourde de source scellée',
            openText: 'Dans une niche de pierre, au bord d\'une source de bambou, une gourde de cuir scellée à la cire. Son eau est fraîche comme au premier jour : elle servira de viatique.' },
        quest: {
            id: 'jq_dernier_puits', title: 'Une gourde pour les dunes',
            objective: 'Rapporter une gourde de source scellée (Sentier des Tiges Cendrées, dans les terres au sud-est)',
            offer: ['Les moines des bambous scellent des gourdes à la source, pour les voyageurs du désert. Rapportez-m\'en une et je vous ouvre la route des dunes.', 'Elles sont cachées au bord d\'une source, sur le sentier des tiges cendrées, du côté du sud-est. Une niche de pierre, m\'a-t-on dit.'],
            hint: ['Cherchez la source des moines, sur le sentier des tiges cendrées, vers le sud-est. La gourde est dans une niche de pierre.'],
            complete: ['Scellée, pleine, parfaite. Vous avez l\'œil, archer : le désert pardonne rarement aux distraits.', 'Allez. Et si vous croisez un mirage qui vous offre à boire, dites-lui que j\'ai déjà un puits.']
        },
        lockedMessage: 'Le Capitaine Yaer barre la piste des dunes : pas de gourde de source scellée, pas de passage.'
    },
    {
        id: 'galeries_volcan', type: 'item', region: 'volcan', from: 'volcan_village', to: 'volcan_wild',
        guard: {
            id: 'foreman_han', name: 'Contremaître Han', title: 'Surveillant des galeries',
            idle: [
                'Les galeries sont interdites à qui n\'a pas de laissez-passer de basalte. Trois éboulements ce mois-ci : je ne laisse plus entrer personne au hasard.',
                'Je sais, vous êtes archer, pas mineur. Mais la lave ne lit pas les titres.'
            ],
            after: ['Votre plaquette est en règle. Gardez-la sur vous : si on vous retrouve sans, on vous prendra pour un voleur de braise.']
        },
        item: { chest: 'tonnerre_basalt_pass', screen: 'tonnerre_wild', fragment: 'Éclat de basalte', label: 'Coffret de la crête', name: 'laissez-passer de basalte',
            openText: 'Au creux d\'une faille balayée par l\'orage, un coffret de pierre noire : à l\'intérieur, une plaquette de basalte gravée au sceau du forgeron-chef. Votre laissez-passer.' },
        quest: {
            id: 'jq_galeries_volcan', title: 'Le laissez-passer de basalte',
            objective: 'Récupérer un laissez-passer de basalte (Crêtes Foudroyées, dans les terres au sud-est)',
            offer: ['Un laissez-passer de basalte, gravé au sceau du forgeron-chef : sans lui, je ne vous ouvre pas les galeries.', 'Les anciens en cachaient dans une faille des crêtes foudroyées, du côté du sud-est. Allez voir.'],
            hint: ['La faille aux coffrets de pierre noire se trouve sur les crêtes foudroyées, vers le sud-est.'],
            complete: ['La plaquette est authentique, je reconnais l\'entaille du forgeron. Vous êtes bien plus débrouillard que mes apprentis.', 'Les galeries sont à vous, archer. Évitez les murs qui chantent : ils vont s\'effondrer.']
        },
        lockedMessage: 'Le Contremaître Han interdit les galeries : il faut un laissez-passer de basalte.'
    },
    {
        id: 'quai_de_jade', type: 'item', region: 'mer', from: 'mer_village', to: 'mer_wild',
        guard: {
            id: 'harbor_master_lu', name: 'Maître de port Lu', title: 'Gardien de la jetée',
            idle: [
                'La jetée est fermée à qui ne sait pas où est le nord. Les courants d\'ici dévorent les imprudents, et leurs bottes avec.',
                'Une boussole de jade, voilà ce qui distingue un marin d\'un noyé. Trouvez-en une, et nous reparlerons.'
            ],
            after: ['Cette boussole pointe juste, et elle est jolie. La jetée est à vous. Si vous vous perdez, regardez l\'aiguille et priez.']
        },
        item: { chest: 'fauves_jade_compass', screen: 'fauves_wild', fragment: 'Aiguille de jade', label: 'Reliquaire du chasseur', name: 'boussole de jade',
            openText: 'Sous un tas de pierres, un reliquaire de chasseur : une boussole de jade, dont l\'aiguille tremble comme un cœur d\'oiseau. Elle pointe vers la mer.' },
        quest: {
            id: 'jq_quai_de_jade', title: 'La boussole de jade',
            objective: 'Retrouver la boussole de jade d\'un chasseur (Hautes Herbes de Cendre, dans les terres au sud-est)',
            offer: ['Un chasseur des plaines possédait une boussole de jade, un cadeau de marin. Il est mort sans héritier ; elle doit dormir dans un reliquaire, quelque part dans les hautes herbes de cendre, vers le sud-est.', 'Rapportez-la et la jetée est à vous.'],
            hint: ['Le reliquaire est caché sous un tas de pierres, dans les hautes herbes de cendre, vers le sud-est.'],
            complete: ['Elle tremble encore ! Le jade n\'oublie jamais où est la mer. Voilà un objet qui rend aux marins leur dignité.', 'La jetée est ouverte, archer. Dites bonjour aux vagues de ma part, elles sont susceptibles.']
        },
        lockedMessage: 'Maître Lu ferme la jetée : sans boussole de jade, personne ne s\'aventure sur les flots.'
    },
    // ── Gardien spécial à vaincre (zone sauvage → hameau) ─────────────────────────────────────────────────────────
    {
        id: 'hameau_bambous', type: 'kill', region: 'bambous', from: 'bambous_wild', to: 'bambous_hamlet',
        enemy: { id: 'bambous_hamlet_guardian', name: 'Ours de bambou, gardien du hameau', templateId: 'forest_guardian' },
        lockedMessage: 'Un ours de bambou gigantesque dort en travers du sentier du hameau : il faut le vaincre pour passer.'
    },
    {
        id: 'hameau_tonnerre', type: 'kill', region: 'tonnerre', from: 'tonnerre_wild', to: 'tonnerre_hamlet',
        enemy: { id: 'tonnerre_hamlet_guardian', name: 'Chevalier de l\'orage égaré', templateId: 'storm_knight' },
        lockedMessage: 'Un chevalier d\'orage, foudre au poing, garde le chemin du hameau : il faut le vaincre pour passer.'
    },
    {
        id: 'hameau_fauves', type: 'kill', region: 'fauves', from: 'fauves_wild', to: 'fauves_hamlet',
        enemy: { id: 'fauves_hamlet_guardian', name: 'Tigresse blanche des pâtures', templateId: 'fire_tiger' },
        lockedMessage: 'Une tigresse blanche garde les pâtures qui mènent au hameau : il faut la vaincre pour passer.'
    },
    {
        id: 'hameau_fusang', type: 'kill', region: 'fusang', from: 'fusang_wild', to: 'fusang_hamlet',
        enemy: { id: 'fusang_hamlet_guardian', name: 'Immortel égaré des branches', templateId: 'crystal_sage' },
        lockedMessage: 'Un immortel égaré tient le sentier des branches vers le hameau : il faut le vaincre pour passer.'
    }
];

function hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

// Occupation d'un écran (terrain bloquant, entités, sorties, cases d'arrivée).
export function occupancy(screen, screens) {
    const taken = new Set([
        ...screen.npcs, ...screen.chests, ...screen.enemies, ...(screen.waypoint ? [screen.waypoint] : []), ...(screen.spawn ? [screen.spawn] : []),
        ...screen.exits
    ].map(e => key(e.x, e.y)));
    Object.values(screens).forEach(s => s.exits.forEach(e => { if (e.to === screen.id && e.arrive) taken.add(key(e.arrive.x, e.arrive.y)); }));
    const blocked = (x, y) => x < 0 || y < 0 || x >= screen.w || y >= screen.h
        || inRects(screen.obstacles, x, y) || inRects(screen.liquids, x, y);
    // cases atteignables à pied depuis l'apparition (les entités sont posées seulement là où le héros peut aller)
    const reach = new Set([key(screen.spawn.x, screen.spawn.y)]);
    const queue = [screen.spawn];
    while (queue.length) {
        const p = queue.shift();
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            const nx = p.x + dx, ny = p.y + dy;
            if (!reach.has(key(nx, ny)) && !blocked(nx, ny)) { reach.add(key(nx, ny)); queue.push({ x: nx, y: ny }); }
        });
    }
    const free = (x, y) => !blocked(x, y) && !taken.has(key(x, y)) && reach.has(key(x, y));
    const openNeighbors = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !blocked(x + dx, y + dy)).length;
    return { taken, blocked, free, openNeighbors };
}

// Direction vers l'intérieur de la carte et direction le long du bord, pour un passage de bord.
const inward = exit => (exit.edge === 'west' ? [1, 0] : exit.edge === 'east' ? [-1, 0] : exit.edge === 'north' ? [0, 1] : [0, -1]);
const along = exit => (exit.edge === 'west' || exit.edge === 'east' ? [0, 1] : [1, 0]);

// Première case libre près d'un passage : à côté de la bouche du passage (écart latéral ≥ 2), 1 à 3 pas à l'intérieur.
function placeNearGate(screen, gate, occ, depths, laterals) {
    const [ix, iy] = inward(gate), [ax, ay] = along(gate);
    for (const d of depths) for (const l of laterals) {
        const x = gate.x + ix * d + ax * l, y = gate.y + iy * d + ay * l;
        if (occ.free(x, y) && occ.openNeighbors(x, y) >= 2) return { x, y };
    }
    return null;
}

// Case de coffre cachée : libre, ouverte, loin des sorties, de préférence au sud-est de la carte ; choix déterministe parmi les 6 plus reculées.
export function placeInLand(screen, occ, seedText) {
    const exits = screen.exits.filter(e => !e.door);
    const cells = [];
    for (let x = 1; x < screen.w - 1; x++) for (let y = 1; y < screen.h - 1; y++) {
        if (!occ.free(x, y) || occ.openNeighbors(x, y) < 3 || inRects(screen.paths, x, y)) continue;
        const dist = Math.min(...exits.map(e => Math.abs(e.x - x) + Math.abs(e.y - y)), 99);
        if (dist < 4) continue;
        cells.push({ x, y, dist });
    }
    // les textes de quête parlent du « sud-est » : on cache les coffres dans ce quart de la carte quand c'est possible
    const southEast = cells.filter(c => c.x >= screen.w * 0.5 && c.y >= screen.h * 0.45);
    const pool = southEast.length ? southEast : cells;
    pool.sort((a, b) => b.dist - a.dist || a.x - b.x || a.y - b.y);
    const top = pool.slice(0, 6);
    return top.length ? top[hashSeed(seedText) % top.length] : null;
}

/**
 * Applique les jonctions gardées : ajoute gardes, coffres, ennemis et quêtes, et pose `requires` sur les sorties.
 * @param screens écrans assemblés (modifiés) ; @param quests liste des quêtes (complétée) ;
 * @param regionLevel niveau recommandé par région (REGION_LEVEL).
 */
export function applyJunctions(screens, quests, regionLevel = {}) {
    JUNCTIONS.forEach(j => {
        const from = screens[j.from], to = screens[j.to];
        if (!from || !to) return;
        const gate = from.exits.find(e => e.to === j.to && e.edge && e.span === 0);
        if (!gate) throw new Error(`jonction ${j.id} : aucun passage de ${j.from} vers ${j.to}`);
        const regionName = screens[j.region]?.name || j.region;
        let requires;

        if (j.type === 'item') {
            const holder = screens[j.item.screen];
            const chestPos = holder && placeInLand(holder, occupancy(holder, screens), j.item.chest);
            const guardPos = placeNearGate(from, gate, occupancy(from, screens), [1, 2, 3], [2, -2, 3, -3, 4, -4]);
            if (!chestPos || !guardPos) throw new Error(`jonction ${j.id} : pas de place pour ${!chestPos ? 'le coffre' : 'le garde'}`);
            const R = Math.max(1, Math.round(regionLevel[j.region] || 1));
            holder.chests.push({ id: j.item.chest, label: j.item.label, openText: j.item.openText, gold: 15 * R, x: chestPos.x, y: chestPos.y });
            const g = j.guard;
            from.npcs.push({
                id: g.id, name: g.name, title: g.title, idle: g.idle, x: guardPos.x, y: guardPos.y,
                talk: [{ whenDone: j.quest.id, lines: g.after }]
            });
            quests.push({
                id: j.quest.id, title: j.quest.title, chapter: `✦ Quête secondaire — ${regionName}`,
                giver: g.id, turnIn: g.id, requires: [], side: true,
                objectives: [{ type: 'chest', target: j.item.chest, text: j.quest.objective }],
                offer: j.quest.offer, hint: j.quest.hint, complete: j.quest.complete,
                reward: { gold: Math.min(200, 40 + 8 * R), fragment: j.item.fragment, xp: 40 }
            });
            requires = j.quest.id;
        } else {
            const occ = occupancy(from, screens);
            const pos = placeNearGate(from, gate, occ, [4, 5, 6, 3], [0, 1, -1, 2, -2]);
            if (!pos) throw new Error(`jonction ${j.id} : pas de place pour le gardien`);
            from.enemies.push({
                id: j.enemy.id, templateId: j.enemy.templateId, name: j.enemy.name, kind: 'sentinel', offset: 2, permanent: true, aggro: 2, x: pos.x, y: pos.y
            });
            requires = j.enemy.id;
        }
        // le verrou couvre toutes les cases du passage ; le chemin de retour reste libre
        from.exits.filter(e => e.to === j.to && e.edge).forEach(e => { e.requires = requires; e.lockedMessage = j.lockedMessage; });
    });
    return screens;
}
