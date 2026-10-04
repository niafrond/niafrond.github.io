// Arène des Mille Flèches : un lieu à explorer, comme une arène de Pokémon. Ouverte à partir du niveau
// ARENA_MIN_LEVEL (bouton 🏟️ du HUD), rejouable à volonté, on peut en sortir à tout moment (bouton 🚪 du HUD, ou la
// porte de chaque salle).
//
//   Parvis (arena_hall) ── 8 portes ──► Cercle N : salle 1 ─► salle 2 ─► … ─► salle du maître d'arène
//
// Huit cercles de difficulté croissante (ARENA_TIERS). Le cercle 1 est ouvert d'emblée ; la porte du cercle N ne
// s'ouvre qu'une fois le maître du cercle N−1 vaincu au moins une fois (drapeau `arena_cleared_<N−1>`). Dans un cercle,
// chaque salle a un gardien qui ferme la porte suivante ; la dernière salle abrite le maître (boss), plus fort et doté
// des règles de duel de Fengmeng (duel.js) aux cercles hauts. Revenir au parvis remet les gardiens en place (on peut
// refaire un cercle). Chaque victoire rapporte l'XP, l'or et le butin d'un combat normal + une prime d'arène ; le
// premier maître vaincu d'un cercle paie une grosse prime. Une défaite dans l'arène ramène hors de l'arène.
//
// Données pures : buildArenaScreens() fabrique les écrans (fusionnés dans SCREENS par story.js), exploration.js
// gère l'entrée / la sortie / la progression, enemies.js le renfort, game.js la prime.

export const ARENA_MIN_LEVEL = 15;
export const ARENA_NAME = 'Arène des Mille Flèches';
export const ARENA_REGION = 'arena';
export const ARENA_HALL = 'arena_hall';

export const arenaRoomId = (tier, room) => `arena_c${tier}_r${room}`;
export const arenaGuardId = (tier, room) => `arena_c${tier}_g${room}`;
export const arenaMasterId = tier => `arena_c${tier}_master`;
export const arenaClearedFlag = tier => `arena_cleared_${tier}`;

//  waves       : nombre de combats du cercle = salles (gardiens) + la salle du maître ;
//  levelOffset : écart de niveau avec le héros au premier gardien (+1 tous les deux combats) ;
//  statMult    : multiplicateur des PV, de l'attaque et de la défense des adversaires ;
//  duel        : règles de duel des gardiens ; masterDuel : règles du maître (remplacent `duel`) ;
//  rewardMult  : multiplicateur de la prime ; clearGold / clearXp : prime du premier maître vaincu ;
//  guard       : titre des gardiens ; master : le maître d'arène (gabarit, répliques).
export const ARENA_TIERS = [
    { id: 1, name: 'Cercle de Bronze', emoji: '🥉', waves: 4, levelOffset: -1, statMult: 1.0, rewardMult: 1.0,
      clearGold: 150, clearXp: 1500, guard: 'Disciple de bronze',
      desc: 'Des disciples encore verts, pour se faire la main.',
      master: { name: 'Maîtresse Tong', title: 'la Lame de Bronze', templateId: 'iron_gladiator',
          intro: ["Un archer dans mon cercle ? Montre-moi si ton arc vaut mieux que le bronze.", 'Il vaut ce que vaut ma main. Voyons.'],
          defeat: ["Le bronze sonne juste quand on le frappe bien. Tu l'as bien frappé.", 'La porte du Cercle de Cuivre est à toi.'] } },
    { id: 2, name: 'Cercle de Cuivre', emoji: '🟤', waves: 4, levelOffset: 0, statMult: 1.08, rewardMult: 1.3,
      clearGold: 250, clearXp: 2500, guard: 'Lutteur de cuivre',
      desc: 'Des adversaires à votre niveau, un peu plus coriaces.',
      master: { name: 'Maître Hong Gang', title: 'le Gong de Cuivre', templateId: 'orc_warmaster',
          intro: ["Chaque coup que tu encaisses, mon gong le chante à toute l'arène !", "Qu'il chante. Il chantera aussi ta défaite."],
          defeat: ['Mon gong est fêlé… et mon orgueil aussi. Bien joué, archer.', 'Le Cercle de Fer t\'attend, plus froid que moi.'] } },
    { id: 3, name: 'Cercle de Fer', emoji: '⚙️', waves: 5, levelOffset: 1, statMult: 1.16, rewardMult: 1.6,
      clearGold: 400, clearXp: 4000, guard: 'Garde de fer',
      desc: 'Cinq combats ; le maître encoche deux flèches à la fois.',
      masterDuel: { rapidShots: 4 },
      master: { name: 'Maître Tie Bi', title: 'le Bras de Fer', templateId: 'storm_knight',
          intro: ['Le fer ne plie pas. Moi non plus. Et je tire deux fois plus vite que toi.', 'Le fer rouille. La patience, jamais.'],
          defeat: ['Mon bras a plié… Personne ne l\'avait fait depuis dix hivers.', "Va : l'Argent t'appelle."] } },
    { id: 4, name: "Cercle d'Argent", emoji: '🥈', waves: 5, levelOffset: 2, statMult: 1.25, rewardMult: 2.0,
      clearGold: 600, clearXp: 6000, guard: "Danseuse d'argent",
      desc: 'Des tirs rapides plus fréquents chez la maîtresse.',
      masterDuel: { rapidShots: 3 },
      master: { name: 'Dame Yin Yue', title: "la Lune d'Argent", templateId: 'moon_priestess',
          intro: ["Tu portes la lune dans ta manche, archer. Je la sens d'ici. Voyons si elle te protège.", "Elle me regarde. C'est tout ce qu'il me faut."],
          defeat: ['La lune t\'aime bien, on dirait. Moi aussi, à présent.', "Le Cercle d'Or brille plus fort, mais il brûle aussi."] } },
    { id: 5, name: "Cercle d'Or", emoji: '🥇', waves: 6, levelOffset: 3, statMult: 1.35, rewardMult: 2.5,
      clearGold: 900, clearXp: 9000, guard: "Champion d'or",
      desc: 'Le maître piège le plateau : désamorcez ses zones.',
      masterDuel: { rapidShots: 3, zoneTraps: 3 },
      master: { name: 'Seigneur Jin Long', title: "le Dragon d'Or", templateId: 'sun_paladin',
          intro: ["Mon arène est semée de pièges d'or. Chaque pas te coûtera.", 'Alors je compterai mes pas.'],
          defeat: ['Tu as désamorcé mon or comme on cueille des fruits… Prends ce qui te revient.', 'Le Jade t\'ouvre sa porte.'] } },
    { id: 6, name: 'Cercle de Jade', emoji: '💚', waves: 6, levelOffset: 4, statMult: 1.45, rewardMult: 3.0,
      clearGold: 1300, clearXp: 13000, guard: 'Sentinelle de jade',
      desc: 'Tous les gardiens tirent vite ; la maîtresse piège sans relâche.',
      duel: { rapidShots: 4 }, masterDuel: { rapidShots: 3, zoneTraps: 2 },
      master: { name: 'Dame Bi Yu', title: 'la Main de Jade', templateId: 'crystal_sage',
          intro: ['Le jade ne se brise pas, il se taille. Laisse-moi te tailler, archer.', 'Le jade brut aussi a des arêtes.'],
          defeat: ['Taillé, et bien taillé… Je n\'avais pas vu une telle main depuis Hou Yi lui-même.', 'Les nuées t\'attendent au Cercle Céleste.'] } },
    { id: 7, name: 'Cercle Céleste', emoji: '☁️', waves: 7, levelOffset: 5, statMult: 1.6, rewardMult: 3.6,
      clearGold: 1800, clearXp: 18000, guard: 'Gardien des nuées',
      desc: 'Pièges à chaque combat ; le maître copie vos techniques.',
      duel: { rapidShots: 4, zoneTraps: 3 }, masterDuel: { mirror: true, rapidShots: 3, zoneTraps: 2 },
      master: { name: 'Immortel Yun Zhong', title: 'Celui-des-Nuées', templateId: 'ice_witch',
          intro: ['Je suis ton reflet dans la nuée : chacune de tes flèches, je la tirerai aussi.', 'Alors je tirerai celle que je ne connais pas encore.'],
          defeat: ["Une flèche que je ne connaissais pas… Le Grand Maître voudra te voir.", 'Le dernier cercle t\'est ouvert.'] } },
    { id: 8, name: 'Cercle des Mille Flèches', emoji: '🏹', waves: 8, levelOffset: 6, statMult: 1.8, rewardMult: 4.5,
      clearGold: 3000, clearXp: 30000, guard: 'Archer aux mille flèches',
      desc: "L'épreuve ultime : huit combats impitoyables et un grand maître miroir, contre qui vous entrez à 80 % de vos PV.",
      duel: { rapidShots: 3, zoneTraps: 3 }, masterDuel: { mirror: true, heroHpPct: 0.8, rapidShots: 2, zoneTraps: 2 },
      master: { name: 'Grand Maître Qian Jian', title: "l'Archer aux Mille Flèches", templateId: 'shadow_assassin',
          intro: ['Mille flèches, archer, et pas une de trop. Tu arrives fatigué : tant mieux, la vraie bataille commence toujours ainsi.', 'Une seule suffit, si elle vole droit.'],
          defeat: ["Une seule a suffi… Que l'arène s'incline : elle a trouvé plus grand archer que son maître.", "Reviens quand tu veux. L'arène est à toi."] } }
];

// Gardiens possibles (gabarits de enemies.catalog.json, hors soleils et Fengmeng).
export const ARENA_TEMPLATES = [
    'goblin_saboteur', 'iron_gladiator', 'arcane_scholar', 'orc_warmaster', 'temple_warden', 'flame_boar',
    'void_vampire', 'storm_wyrm', 'crypt_lich', 'shadow_assassin', 'forest_guardian', 'moon_priestess',
    'plague_doctor', 'storm_knight', 'fungal_horror', 'ice_witch', 'bone_reaver', 'sun_paladin', 'crystal_sage',
    'war_troll', 'fire_tiger', 'ember_wolf', 'frost_dragon', 'ember_dragon', 'sand_colossus', 'lava_behemoth',
    'deep_sea_serpent'
];

// Palettes des salles (même format que BIOMES d'explorationView.js) : une par cercle, plus le parvis.
export const ARENA_BIOMES = {
    arena_hall: { a: '#b9a07a', b: '#ae9570', path: '#9b2f2a', cliff: '#4a3424', liquid: '#6ab7c9', sky: ['#2a1c14', '#5a3e2a'], decor: ['🏮', '🥁', '🏮', '🎌'] },
    arena_1: { a: '#b98a5a', b: '#ad7f50', path: '#8a5a2a', cliff: '#4a2e18', liquid: '#6ab7c9', sky: ['#3a2414', '#6a4628'], decor: ['🏮', '🪨', '🥉'] },
    arena_2: { a: '#c08a68', b: '#b47f5e', path: '#8f4a2e', cliff: '#4f2a1c', liquid: '#6ab7c9', sky: ['#3a1f17', '#6e3b28'], decor: ['🥁', '🏮', '🔔'] },
    arena_3: { a: '#8c9096', b: '#82868c', path: '#5a5e66', cliff: '#2e3036', liquid: '#4a5fa8', sky: ['#1f2228', '#4a4e58'], decor: ['⚙️', '🛡️', '⛓️'] },
    arena_4: { a: '#c8ccd6', b: '#bec2cc', path: '#8a90a8', cliff: '#4a4e66', liquid: '#6f86d8', sky: ['#22263a', '#555a7a'], decor: ['🌙', '🏮', '🥈'] },
    arena_5: { a: '#e8cf7a', b: '#dec46e', path: '#b8862a', cliff: '#6a4a14', liquid: '#e8b830', sky: ['#4a3410', '#8a6420'], decor: ['🐉', '🏮', '🥇'] },
    arena_6: { a: '#8fc4a0', b: '#84b995', path: '#3f8a5f', cliff: '#1f4a32', liquid: '#4fa88a', sky: ['#12301f', '#2f6a48'], decor: ['🎋', '💚', '🏮'] },
    arena_7: { a: '#d8e4f0', b: '#cedae6', path: '#9ab4d8', cliff: '#4a5f88', liquid: '#7eb4ec', sky: ['#1a2a4a', '#5a7ab0'], decor: ['☁️', '🏮', '☁️'] },
    arena_8: { a: '#a8584a', b: '#9e4e40', path: '#e0b030', cliff: '#3a1410', liquid: '#ff5a1f', sky: ['#1a0808', '#5a1a10'], decor: ['🏹', '🎯', '🏮'] }
};

export const isArenaUnlocked = playerLevel => (Number(playerLevel) || 0) >= ARENA_MIN_LEVEL;

export const arenaTier = id => ARENA_TIERS.find(t => t.id === Number(id)) || null;

// Niveau de l'adversaire du combat `wave` d'un cercle : héros + écart du cercle, +1 tous les deux combats.
export function arenaWaveLevel(tierId, wave, playerLevel) {
    const tier = arenaTier(tierId) || ARENA_TIERS[0];
    const w = Math.max(1, Math.floor(wave || 1));
    return Math.max(1, Math.floor(playerLevel || 1) + tier.levelOffset + Math.floor((w - 1) / 2));
}

// Le dernier combat d'un cercle est celui du maître d'arène.
export function isChampionWave(tierId, wave) {
    const tier = arenaTier(tierId) || ARENA_TIERS[0];
    return Math.floor(wave || 0) === tier.waves;
}

// Rencontre d'un adversaire de l'arène (complète celle d'exploration.js) : niveau, règles de duel, renfort,
// et `firstClear` si c'est le maître d'un cercle encore jamais terminé.
export function arenaEncounterInfo(def, playerLevel, cleared = []) {
    const tier = arenaTier(def?.arena?.tier) || ARENA_TIERS[0];
    const wave = Math.min(tier.waves, Math.max(1, Math.floor(def?.arena?.wave || 1)));
    const master = isChampionWave(tier.id, wave);
    const duel = master ? (tier.masterDuel || tier.duel) : tier.duel;
    return {
        level: arenaWaveLevel(tier.id, wave, playerLevel),
        duel: duel ? { ...duel } : null,
        arena: { tier: tier.id, wave, waves: tier.waves, statMult: tier.statMult, firstClear: master && !cleared.includes(tier.id) }
    };
}

// Renfort des adversaires des cercles hauts (PV, attaque, défense).
export function applyArenaScaling(entity, statMult = 1) {
    if (!entity || !(statMult > 1)) return entity;
    entity.maxHp = Math.max(1, Math.round(entity.maxHp * statMult));
    entity.hp = entity.maxHp;
    entity.attack = Math.max(1, Math.round(entity.attack * statMult));
    entity.defense = Math.max(0, Math.round((entity.defense || 0) * statMult));
    return entity;
}

// Prime d'arène d'une victoire, en plus des gains normaux du combat (doublée pour le maître).
export function arenaRewardBonus(tierId, wave, enemyLevel) {
    const tier = arenaTier(tierId) || ARENA_TIERS[0];
    const w = Math.max(1, Math.floor(wave || 1));
    const lvl = Math.max(1, Math.floor(enemyLevel || 1));
    const mult = tier.rewardMult * (isChampionWave(tier.id, w) ? 2 : 1);
    return { gold: Math.round((12 * w + 2 * lvl) * mult), xp: Math.round((150 * w + 10 * lvl) * mult) };
}

// État d'arène de la sauvegarde d'exploration : cercles terminés, record par cercle, victoires, point de retour.
export function normalizeArenaData(data) {
    const a = data && typeof data === 'object' ? data : {};
    const cleared = Array.isArray(a.cleared) ? [...new Set(a.cleared.map(Number).filter(id => arenaTier(id)))].sort((x, y) => x - y) : [];
    const r = a.returnTo;
    return {
        cleared,
        best: a.best && typeof a.best === 'object' ? { ...a.best } : {},
        wins: Math.max(0, Math.floor(a.wins || 0)),
        returnTo: r && typeof r.screenId === 'string' ? { screenId: r.screenId, x: r.x, y: r.y } : null
    };
}

// ── Écrans ─────────────────────────────────────────────────────────────────
const ROOM_W = 14;
const ROOM_H = 10;
const HALL_W = 14;
const HALL_H = 10;
// Portes du parvis : cercles 1 à 4 sur le mur ouest, 5 à 8 sur le mur est (y = 1, 3, 5, 7).
export const hallDoor = tier => ({ x: tier <= 4 ? 0 : HALL_W - 1, y: 1 + 2 * ((tier - 1) % 4) });
const hallDoorArrival = tier => { const d = hallDoor(tier); return { x: d.x === 0 ? 1 : HALL_W - 2, y: d.y }; };

// Gabarit déterministe d'un gardien (pas de hasard : les salles sont les mêmes d'une partie à l'autre).
function guardTemplate(tier, room) {
    return ARENA_TEMPLATES[(tier * 7 + room * 11) % ARENA_TEMPLATES.length];
}

function buildRoom(tier, room) {
    const last = room === tier.waves;
    const id = arenaRoomId(tier.id, room);
    const back = room === 1
        ? { x: 0, y: 4, to: ARENA_HALL, arrive: hallDoorArrival(tier.id), label: "Parvis de l'arène" }
        : { x: 0, y: 4, to: arenaRoomId(tier.id, room - 1), arrive: { x: ROOM_W - 2, y: 4 }, label: `Salle ${room - 1}` };
    const exits = [back];
    const enemies = [];
    if (!last) {
        const guardId = arenaGuardId(tier.id, room);
        exits.push({ x: ROOM_W - 1, y: 4, to: arenaRoomId(tier.id, room + 1), arrive: { x: 1, y: 4 },
            label: room + 1 === tier.waves ? 'Salle du maître' : `Salle ${room + 1}`,
            requires: guardId, lockedMessage: `La porte reste close tant que le ${tier.guard.toLowerCase()} garde la salle.` });
        enemies.push({ id: guardId, templateId: guardTemplate(tier.id, room), emoji: tier.emoji, kind: 'sentinel', x: 10, y: 4,
            name: `${tier.guard} — combat ${room}/${tier.waves}`, permanent: true, arena: { tier: tier.id, wave: room } });
    } else {
        const m = tier.master;
        const name = `${m.name}, ${m.title}`;
        // Derrière le maître vaincu : une sortie directe hors de l'arène.
        exits.push({ x: ROOM_W - 1, y: 4, to: ARENA_HALL, leaveArena: true, label: "Sortie de l'arène",
            requires: arenaMasterId(tier.id), lockedMessage: `${m.name} se dresse entre vous et la sortie.` });
        enemies.push({ id: arenaMasterId(tier.id), templateId: m.templateId, emoji: '🏆', kind: 'sentinel', x: 10, y: 4,
            name, permanent: true, boss: { name, level: 1 }, arena: { tier: tier.id, wave: room, master: true },
            introLines: [...m.intro],
            defeatScene: { speaker: { name: m.name, title: `Maître du ${tier.name}`, enemy: arenaMasterId(tier.id) }, lines: [...m.defeat] } });
    }
    return {
        id, region: ARENA_REGION, name: last ? `${tier.name} — salle du maître` : `${tier.name} — salle ${room}/${tier.waves - 1}`,
        biome: `arena_${tier.id}`, kind: 'arena', arena: { tier: tier.id, room, master: last },
        w: ROOM_W, h: ROOM_H, spawn: { x: 1, y: 4 },
        // Colonnes de l'arène, de part et d'autre d'une allée centrale ; deux braseros devant le maître.
        obstacles: [[2, 1, 1, 2], [2, 7, 1, 2], [5, 1, 1, 2], [5, 7, 1, 2], [8, 1, 1, 2], [8, 7, 1, 2], [11, 1, 1, 2], [11, 7, 1, 2],
            ...(last ? [[12, 2, 1, 1], [12, 6, 1, 1]] : [])],
        liquids: [],
        paths: [[0, 4, ROOM_W, 1]],
        exits, npcs: [], enemies, chests: []
    };
}

function buildHall() {
    return {
        id: ARENA_HALL, region: ARENA_REGION, name: `Parvis de l'${ARENA_NAME}`, biome: 'arena_hall', kind: 'arena', safe: true,
        arena: { hall: true },
        w: HALL_W, h: HALL_H, spawn: { x: 7, y: 8 },
        arrival: [
            "Des tambours, des bannières, et l'odeur du bois de cible : l'Arène des Mille Flèches. Huit portes, huit cercles, et derrière chacun, un maître d'arène qui attend un archer digne de lui.",
            "Chaque cercle se traverse de salle en salle : battez le gardien de chaque salle pour ouvrir la suivante, puis affrontez le maître. Un maître vaincu ouvre la porte du cercle suivant (cercles 1 à 4 à l'ouest, 5 à 8 à l'est). La porte du sud, ou le bouton 🚪, vous ramène dehors à tout moment."
        ],
        // Estrade centrale (tambour, bannières) ; allées vers les portes.
        obstacles: [[6, 3, 2, 2]],
        liquids: [],
        paths: [[1, 1, HALL_W - 2, 1], [1, 3, HALL_W - 2, 1], [1, 5, HALL_W - 2, 1], [1, 7, HALL_W - 2, 1], [7, 5, 1, 5]],
        exits: [
            ...ARENA_TIERS.map(t => ({
                ...hallDoor(t.id), to: arenaRoomId(t.id, 1), arrive: { x: 1, y: 4 }, label: `${t.emoji} ${t.name}`,
                ...(t.id > 1 ? { requires: arenaClearedFlag(t.id - 1),
                    lockedMessage: `Le ${t.name} reste fermé : battez d'abord le maître du ${arenaTier(t.id - 1).name}.` } : {})
            })),
            { x: 7, y: HALL_H - 1, to: ARENA_HALL, leaveArena: true, label: "Sortie de l'arène" }
        ],
        npcs: [], enemies: [], chests: []
    };
}

// Tous les écrans de l'arène, indexés par id.
export function buildArenaScreens() {
    const screens = { [ARENA_HALL]: buildHall() };
    ARENA_TIERS.forEach(tier => {
        for (let room = 1; room <= tier.waves; room++) {
            const sc = buildRoom(tier, room);
            screens[sc.id] = sc;
        }
    });
    return screens;
}
