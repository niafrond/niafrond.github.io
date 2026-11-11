// Recherche d'équilibrage par simulation (tools/combatSim.mjs). Usage : node match3-quest/tools/balance-search.mjs [rates|search] [combats]
// 1. rates : mesure, par niveau, les dégâts effectifs du héros par cycle et les dégâts bruts de l'ennemi par cycle (avant calibrage).
// 2. search : avec ces taux, cherche pour chaque catégorie le rapport ENEMY_WIN_RATIO qui donne le taux de victoire visé, puis vérifie
//    durée (cycles × 30 s) et victoires sur des combats calibrés comme dans le jeu.
await import('../tests/unit/fixtures/playerForge.js');   // catalogues JSON lus depuis le disque (XMLHttpRequest simulé)
const { MILESTONES, forgePlayer, bestWeapon } = await import('../tests/unit/fixtures/playerForge.js');
const { lootableStuff, STUFF_SLOTS } = await import('../stuff.js');
const { allItems } = await import('../items.js');
const { getEquippedUltimate } = await import('../ultimates.js');
const { MAX_LEVEL } = await import('../experience.js');
const { createMapEnemy, enemyCatalogList } = await import('../enemies.js');
const { simulateFight } = await import('./combatSim.mjs');
const CB = await import('../combatBalance.js');

export const CLASSES = ['sorcerer', 'assassin', 'templar', 'barbarian'];
export const CATEGORIES = ['weak', 'normal', 'aggressive', 'elite', 'miniBoss', 'boss'];
const catalog = enemyCatalogList();
const hpMultOf = t => t.statsModifiers?.hpMult ?? 1;
export const templatesOf = cat => catalog.filter(t => CB.enemyCategory({ hpMult: hpMultOf(t) }) === (cat === 'boss' ? 'elite' : cat));

export function makeEnemy(cat, level, i) {
    const pool = templatesOf(cat === 'weak' ? 'weak' : cat).length ? templatesOf(cat) : templatesOf('normal');
    const t = pool[i % pool.length];
    const boss = cat === 'boss';
    return createMapEnemy({ templateId: t.id, level, enemyId: `sim${i}`, boss: boss ? { name: 'B', level } : null });
}

export function enemyLevelFor(cat, heroLevel) { return Math.max(1, heroLevel + (cat === 'weak' ? -2 : cat === 'boss' || cat === 'miniBoss' ? 1 : 0)); }

// --- Héros « complet » à n'importe quel niveau ----------------------------------------------------------------------------------------------
// Compagnons dans l'ordre où ils rejoignent le héros (quêtes annexes débloquées région par région, voir storyQuests.js / REGION_LEVEL).
export const COMPANION_FROM_LEVEL = { xiao_gui: 1, braise: 4, zhi: 6, etincelle: 11, yu: 17, tou: 22, dawa: 27, jian: 32 };
export const companionAt = level => (level >= COMPANION_FROM_LEVEL.zhi ? 'zhi' : 'xiao_gui');   // Zhi (soin) dès qu'il est là, sinon Xiao Gui
export const healItemAt = level => allItems.filter(i => i.type === 'reusable' && i.minLevel <= level && i.effect.heal)
    .sort((a, b) => b.effect.heal - a.effect.heal)[0] || null;
const stuffScore = s => (s.maxHp || 0) + 3 * ((s.atkBonus || 0) + (s.defBonus || 0));

/** Héros d'une classe au niveau `level` : meilleure arme et meilleur stuff accessibles (profil complet), sorts par défaut, ultime de classe. */
export function heroAt(classId, level, profile = 'complet') {
    const weapon = bestWeapon(level);
    const hero = forgePlayer({ classId, level, weaponIds: [weapon.id] });
    if (profile === 'complet') {
        hero.stuff = { head: null, neck: null, wrist: null, ring: null };
        STUFF_SLOTS.forEach(slot => {
            const piece = lootableStuff().filter(p => p.slot === slot && p.minLevel <= level).sort((a, b) => stuffScore(b) - stuffScore(a))[0];
            if (piece) { hero.stuff[slot] = piece.id; hero.maxHp += piece.maxHp || 0; }
        });
        hero.hp = hero.maxHp;
    }
    return {
        hero,
        options: profile === 'complet'
            ? { profile, item: healItemAt(level), companion: companionAt(level), ultimate: getEquippedUltimate(hero) }
            : { profile }
    };
}
export const ALL_LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

const mean = a => (Array.isArray(a) ? a : []).reduce((s, x) => s + x, 0) / Math.max(1, (Array.isArray(a) ? a : []).length);

/** Taux par niveau de jalon : dégâts effectifs du héros par cycle, dégâts bruts de l'ennemi par cycle (par catégorie). */
export function measureRates({ fights = 12, cycles = 25 } = {}) {
    const rows = [];
    let seed = 1;
    for (const m of MILESTONES) {
        const row = { level: m.level, heroDpc: [], enemyRaw: {}, shares: { weapon: 0, spell: 0, skull: 0 }, heroHp: [] };
        for (const cat of CATEGORIES) {
            const raw = [];
            for (const cls of CLASSES) for (let i = 0; i < fights; i++) {
                const hero = m.forge(cls);
                if (!row.heroHp.includes(hero.maxHp)) row.heroHp.push(hero.maxHp);
                const enemy = makeEnemy(cat, enemyLevelFor(cat, m.level), i + seed);
                const r = simulateFight(hero, enemy, { seed: seed++, boardSize: cat === 'boss' ? 10 : 8, immortal: true, maxCycles: cycles });
                raw.push(r.takenRaw / r.cycles);
                if (cat === 'normal') {
                    const dealt = r.dealtBy.weapon + r.dealtBy.spell + r.dealtBy.skull;
                    row.heroDpc.push(dealt / r.cycles);
                    Object.keys(row.shares).forEach(k => { row.shares[k] += r.dealtBy[k]; });
                }
            }
            row.enemyRaw[cat] = +mean(raw).toFixed(1);
        }
        const total = Object.values(row.shares).reduce((a, b) => a + b, 0) || 1;
        Object.keys(row.shares).forEach(k => { row.shares[k] = Math.round(row.shares[k] / total * 100); });
        row.heroDpc = +mean(row.heroDpc).toFixed(1);
        row.heroHp = Math.round(mean(row.heroHp));
        rows.push(row);
    }
    return rows;
}

export const TARGET_WIN_RATE = { weak: 0.95, normal: 0.85, aggressive: 0.8, elite: 0.75, miniBoss: 0.7, boss: 0.6 };

/** Combats calibrés comme dans le jeu (sans mesures du joueur : modèles) ; `winRatio` remplace ENEMY_WIN_RATIO de la catégorie. */
export function calibratedFights(cat, { winRatio, fights = 6, seed0 = 1000, milestones = MILESTONES, levels = null, profile = 'standard', model = null, levelAnchors, aiPreference = process.env.AI || 'greedy', difficulty = process.env.AI && process.env.AI !== 'greedy' ? process.env.AI : 'auto', modeDivisor } = {}) {
    const out = [];
    let seed = seed0;
    // Héros : jalons des tests (profil standard d'origine) ou tous les niveaux `levels` (héros fabriqués par heroAt).
    const builds = levels ? levels.map(level => ({ level, make: cls => heroAt(cls, level, profile) })) : milestones.map(m => ({ level: m.level, make: cls => ({ hero: m.forge(cls), options: { profile } }) }));
    for (const b of builds) for (const cls of CLASSES) for (let i = 0; i < fights; i++) {
        const { hero, options } = b.make(cls);
        const level = enemyLevelFor(cat, b.level);
        const enemy = makeEnemy(cat, level, i + seed);
        const c = CB.calibrateEnemy({ category: cat, heroMaxHp: hero.maxHp, heroLevel: hero.level, enemyLevel: level, winRatio, difficulty, modeDivisor, ...(levelAnchors ? { levelAnchors } : {}) });
        enemy.maxHp = enemy.hp = c.hp;
        enemy.gearScale = c.gearScale;
        const r = simulateFight(hero, enemy, { seed: seed++, boardSize: cat === 'boss' ? 10 : 8, enemyDamageScale: c.damageMult, aiPreference, ...options });
        out.push({ ...r, level: b.level, cls, targetCycles: c.cycles, cycleSeconds: c.cycleSeconds, enemyHp: c.hp });
    }
    return out;
}
const winRate = list => list.filter(r => r.heroWon).length / list.length;

/** Rapport ENEMY_WIN_RATIO qui donne le taux de victoire visé (dichotomie : plus le rapport est grand, plus l'ennemi est lent à tuer). */
export function searchRatio(cat, { fights = 6, levels = null, profile = 'standard' } = {}) {
    let lo = 0.2, hi = 5;
    for (let step = 0; step < 7; step++) {
        const mid = (lo + hi) / 2;
        if (winRate(calibratedFights(cat, { winRatio: mid, fights, levels, profile, seed0: 1000 + step * 7919 })) < TARGET_WIN_RATE[cat]) lo = mid; else hi = mid;
    }
    return Math.round((lo + hi) / 2 * 20) / 20;
}

export function report(cat, list) {
    const won = list.filter(r => r.heroWon), lost = list.filter(r => !r.heroWon && !r.timeout);
    const sec = l => (l.length ? Math.round(mean(l.map(r => r.cycles * r.cycleSeconds))) : null);
    const range = CB.TARGET_DURATION_SECONDS[cat];
    const inWindow = won.filter(r => r.cycles * r.cycleSeconds >= range[0] * 0.75 && r.cycles * r.cycleSeconds <= range[1] * 1.25).length / Math.max(1, won.length);
    return { catégorie: cat, combats: list.length, 'victoires %': Math.round(winRate(list) * 100), 'durée victoire (s)': sec(won), 'durée défaite (s)': sec(lost), 'cible (s)': `${range[0]}-${range[1]}`, 'victoires dans la fenêtre ±25 % (%)': Math.round(inWindow * 100), 'PV restants après victoire (%)': Math.round(mean(won.map(r => r.heroHpLeft / r.heroMaxHp)) * 100) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const mode = process.argv[2] || 'rates';
    if (mode === 'rates') {
        const rows = measureRates({ fights: Number(process.argv[3]) || 12 });
        console.table(rows.map(r => ({ niveau: r.level, 'PV héros': r.heroHp, 'dégâts héros/cycle': r.heroDpc, 'armes %': r.shares.weapon, 'sorts %': r.shares.spell, 'crânes %': r.shares.skull, ...Object.fromEntries(Object.entries(r.enemyRaw).map(([k, v]) => [`ennemi ${k}`, v])) })));
        console.log(JSON.stringify(rows.map(r => ({ level: r.level, heroDpc: r.heroDpc, heroHp: r.heroHp, enemyRaw: r.enemyRaw }))));
    }
    if (mode === 'search') {
        const fights = Number(process.argv[3]) || 6;
        const found = Object.fromEntries(CATEGORIES.map(cat => [cat, searchRatio(cat, { fights })]));
        console.log('ENEMY_WIN_RATIO =', JSON.stringify(found));
        console.table(CATEGORIES.map(cat => report(cat, calibratedFights(cat, { winRatio: found[cat], fights: fights * 2, seed0: 50000 }))));
    }
    if (mode === 'levels') {   // victoires et durées par niveau (toutes catégories)
        const fights = Number(process.argv[3]) || 6;
        const all = CATEGORIES.flatMap(cat => calibratedFights(cat, { fights, seed0: 70000 }).map(r => ({ ...r, cat })));
        console.table(MILESTONES.map(m => {
            const l = all.filter(r => r.level === m.level), won = l.filter(r => r.heroWon);
            return { niveau: m.level, combats: l.length, 'victoires %': Math.round(winRate(l) * 100), 'cycles moyens (victoire)': +mean(won.map(r => r.cycles)).toFixed(1), 'cycles visés (moy.)': +mean(l.map(r => r.targetCycles)).toFixed(1) };
        }));
        console.table(CLASSES.map(cls => ({ classe: cls, 'victoires %': Math.round(winRate(all.filter(r => r.cls === cls)) * 100) })));
    }
    // Simulations sur TOUS les niveaux du héros (1 à MAX_LEVEL), profils standard et complet, calibrage actuel du jeu.
    if (mode === 'all-levels') {
        const fights = Number(process.argv[3]) || 1;
        const profiles = (process.argv[4] || 'standard,complet').split(',');
        for (const profile of profiles) {
            const all = CATEGORIES.flatMap(cat => calibratedFights(cat, { fights, levels: ALL_LEVELS, profile, seed0: Number(process.env.SEED) || 123000 }).map(r => ({ ...r, cat })));
            console.log(`\n=== Héros ${profile}, IA ennemie « ${process.env.AI || 'greedy'} » : ${all.length} combats, niveaux 1 à ${MAX_LEVEL} ===`);
            const tiers = {}; all.forEach(r => { tiers[r.aiTier] = (tiers[r.aiTier] || 0) + 1; });
            console.log('Paliers joués :', JSON.stringify(tiers));
            console.table(CATEGORIES.map(cat => report(cat, all.filter(r => r.cat === cat))));
            const bands = [[1, 5], [6, 10], [11, 20], [21, 30], [31, 40], [41, 50], [51, 60], [61, MAX_LEVEL]];
            console.table(bands.map(([a, b]) => {
                const l = all.filter(r => r.level >= a && r.level <= b), won = l.filter(r => r.heroWon);
                const boss = l.filter(r => r.cat === 'boss');
                return { niveaux: `${a}-${b}`, combats: l.length, 'victoires %': Math.round(winRate(l) * 100), 'victoires boss %': Math.round(winRate(boss) * 100), 'durée victoire (s)': Math.round(mean(won.map(r => r.cycles * r.cycleSeconds))), 'dégâts héros/cycle': +mean(l.map(r => (r.dealtBy.weapon + r.dealtBy.spell + r.dealtBy.skull + (r.dealtBy.other || 0)) / r.cycles)).toFixed(1) };
            }));
            console.table(CLASSES.map(cls => { const l = all.filter(r => r.cls === cls); return { classe: cls, 'victoires %': Math.round(winRate(l) * 100), 'victoires boss %': Math.round(winRate(l.filter(r => r.cat === 'boss')) * 100) }; }));
            const tot = k => all.reduce((a, r) => a + (r.dealtBy[k] || 0), 0), sum = tot('weapon') + tot('spell') + tot('skull') + tot('other');
            const used = all.reduce((a, r) => ({ sorts: a.sorts + r.used.spells, ultimes: a.ultimes + r.used.ultimate, objets: a.objets + r.used.item, compagnon: a.compagnon + r.used.companion }), { sorts: 0, ultimes: 0, objets: 0, compagnon: 0 });
            console.log('Part des dégâts : armes', Math.round(tot('weapon') / sum * 100), '% · sorts', Math.round(tot('spell') / sum * 100), '% · crânes', Math.round(tot('skull') / sum * 100), '% · autres', Math.round(tot('other') / sum * 100), '%', '| par combat :', Object.entries(used).map(([k, v]) => `${k} ${(v / all.length).toFixed(2)}`).join(', '));
            if (process.argv[5] === 'json') console.log('JSON', JSON.stringify(all.map(r => ({ l: r.level, c: r.cat, k: r.cls, w: r.heroWon, cy: r.cycles, d: r.dealtBy.weapon + r.dealtBy.spell + r.dealtBy.skull + (r.dealtBy.other || 0), t: r.takenRaw }))));
        }
    }
    // Modèles refaits sur le héros complet (tous niveaux) : régression linéaire des dégâts par cycle, facteurs de catégorie et de durée.
    if (mode === 'fit') {
        const profile = process.argv[4] || 'complet';
        const fights = Number(process.argv[3]) || 1;
        const all = CATEGORIES.flatMap(cat => calibratedFights(cat, { fights, levels: ALL_LEVELS, profile, seed0: 321000 }).map(r => ({ ...r, cat })));
        const fit = pts => {   // moindres carrés y = a + b x
            const mx = mean(pts.map(p => p[0])), my = mean(pts.map(p => p[1]));
            const b = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
            return { a: +(my - b * mx).toFixed(2), b: +b.toFixed(3) };
        };
        const dealt = r => r.dealtBy.weapon + r.dealtBy.spell + r.dealtBy.skull + (r.dealtBy.other || 0);
        const hero = fit(all.map(r => [r.level, dealt(r) / r.cycles]));
        const normal = all.filter(r => r.cat === 'normal');
        const enemy = fit(normal.map(r => [enemyLevelFor('normal', r.level), r.takenRaw / r.cycles]));
        const model = (lvl) => enemy.a + enemy.b * lvl;
        const factors = Object.fromEntries(CATEGORIES.map(cat => [cat, +mean(all.filter(r => r.cat === cat).map(r => (r.takenRaw / r.cycles) / Math.max(0.5, model(enemyLevelFor(cat, r.level))))).toFixed(2)]));
        const duration = Object.fromEntries(CATEGORIES.map(cat => {
            const won = all.filter(r => r.cat === cat && r.heroWon);
            return [cat, +(mean(CB.TARGET_DURATION_SECONDS[cat]) / Math.max(1, mean(won.map(r => r.cycles * r.cycleSeconds)))).toFixed(2)];
        }));
        console.log(JSON.stringify({ profile, combats: all.length, heroDpc: hero, enemyRaw: enemy, categoryFactor: factors, durationCorrection: duration }));
    }
    if (mode === 'search-all') {
        const profile = process.argv[4] || 'complet';
        const fights = Number(process.argv[3]) || 1;
        const levels = ALL_LEVELS.filter(l => l % 2 === 1 || l === MAX_LEVEL);   // un niveau sur deux (et le dernier) pour la dichotomie
        const cats = process.argv[5] ? process.argv[5].split(',') : CATEGORIES;
        const found = Object.fromEntries(cats.map(cat => [cat, searchRatio(cat, { fights, levels, profile })]));
        console.log('ENEMY_WIN_RATIO =', JSON.stringify(found));
    }
    // Ajustement par niveau : pour chaque point d'ancrage, dichotomie sur le multiplicateur du rapport de victoire pour que le héros complet
    // gagne en moyenne le taux visé (moyenne des cibles des 6 catégories) sur sa tranche de niveaux.
    if (mode === 'search-levels') {
        const profile = process.argv[4] || 'complet';
        const fights = Number(process.argv[3]) || 1;
        const goal = mean(Object.values(TARGET_WIN_RATE));
        const anchors = CB.WIN_RATIO_LEVEL_ANCHORS.map(a => [...a]);
        const bands = anchors.map(([lvl], i) => {
            const lo = i === 0 ? 1 : Math.floor((anchors[i - 1][0] + lvl) / 2) + 1;
            const hi = i === anchors.length - 1 ? MAX_LEVEL : Math.floor((lvl + anchors[i + 1][0]) / 2);
            return ALL_LEVELS.filter(l => l >= lo && l <= hi && (l - lo) % 2 === 0);
        });
        anchors.forEach((anchor, i) => {
            let lo = 0.3, hi = 3;
            for (let step = 0; step < 6; step++) {
                const m = (lo + hi) / 2;
                // le multiplicateur s'applique uniformément à la tranche (les autres ancrages ne jouent pas ici)
                const flat = anchors.map(([l]) => [l, m]);
                const list = CATEGORIES.flatMap(cat => calibratedFights(cat, { fights, levels: bands[i], profile, levelAnchors: flat, seed0: 9000 + step * 131 + i * 17 }));
                if (winRate(list) < goal) lo = m; else hi = m;
            }
            anchor[1] = Math.round((lo + hi) / 2 * 100) / 100;
            console.log('ancrage', anchor[0], 'niveaux', bands[i][0] + '-' + bands[i][bands[i].length - 1], 'multiplicateur', anchor[1]);
        });
        console.log('WIN_RATIO_LEVEL_ANCHORS =', JSON.stringify(anchors));
    }
    // Diviseur de l'attaque et du stuff par mode et catégorie (PV fixes : durée 3 à 8 min ; base au niveau Expert) : dichotomie géométrique pour la cible du mode.
    if (mode === 'search-divisors') {
        const fights = Number(process.argv[3]) || 1;
        const modes = (process.argv[4] || 'expert,hard,auto,normal,easy').split(',');
        const levels = ALL_LEVELS.filter(l => (l - 1) % 4 === 0 || l === MAX_LEVEL);
        const table = {};
        for (const m of modes) {
            table[m] = {};
            for (const cat of CATEGORIES) {
                const goal = CB.DIFFICULTY_TARGET_WIN_RATE[m][cat];
                let lo = 0.4, hi = 8;
                for (let step = 0; step < 6; step++) {
                    const d = Math.sqrt(lo * hi);
                    const list = calibratedFights(cat, { fights, levels, profile: 'complet', aiPreference: m, difficulty: m, modeDivisor: d, seed0: 70000 + step * 613 });
                    if (winRate(list) < goal) lo = d; else hi = d;   // plus le diviseur est grand, plus l'ennemi est fragile
                }
                table[m][cat] = Math.round(Math.sqrt(lo * hi) * 100) / 100;
                console.log(m, cat, 'diviseur', table[m][cat]);
            }
        }
        console.log('MODE_DIVISOR =', JSON.stringify(table));
    }
    // Chaque boss de la carte (story.js > SCREENS, hors duels) contre le héros complet d'un niveau de moins, dans le mode AI (défaut auto).
    if (mode === 'boss-adjust') {
        const fights = Number(process.argv[3]) || 8;
        const { SCREENS } = await import('../story.js');
        const bosses = [];
        for (const sc of Object.values(SCREENS)) for (const e of (sc.enemies || [])) if (e.boss && !e.duel && !e.arena) bosses.push({ id: e.id, templateId: e.templateId, name: e.boss.name || e.name, level: e.boss.level });
        bosses.sort((a, b) => a.level - b.level);
        const only = process.env.BOSSES ? process.env.BOSSES.split(',') : null;   // seconde passe : seulement ces boss, autour de leur réglage actuel
        if (only) bosses.splice(0, bosses.length, ...bosses.filter(b => only.includes(b.id)));
        const goal = CB.DIFFICULTY_TARGET_WIN_RATE.auto.boss, targetSec = mean(CB.TARGET_DURATION_SECONDS.boss);
        const run = (b, adjust, seed0) => {
            const list = []; let seed = seed0;
            for (const cls of CLASSES) for (let i = 0; i < fights; i++) {
                const { hero, options } = heroAt(cls, Math.max(1, b.level - 1), 'complet');
                const enemy = createMapEnemy({ templateId: b.templateId, level: b.level, kitLevel: Math.max(1, b.level - 2), enemyId: b.id, boss: { name: b.name, level: b.level } });
                const c = CB.calibrateEnemy({ category: 'boss', heroMaxHp: hero.maxHp, heroLevel: hero.level, enemyLevel: b.level, difficulty: 'auto', adjust });
                enemy.maxHp = enemy.hp = c.hp; enemy.gearScale = c.gearScale;
                list.push({ ...simulateFight(hero, enemy, { seed: seed++, boardSize: 10, enemyDamageScale: c.damageMult, aiPreference: 'auto', ...options }), cycleSeconds: c.cycleSeconds });
            }
            return list;
        };
        const table = {};
        for (const b of bosses) {
            // 1. Attaque : dichotomie géométrique pour la cible du mode Auto (PV du calibrage).
            const cur = only ? (CB.BOSS_ADJUST[b.id]?.attack ?? 1) : null;
            const curHp = only ? (CB.BOSS_ADJUST[b.id]?.hp ?? 1) : 1;
            let lo = cur ? cur / 2.5 : 0.15, hi = cur ? cur * 8 : 8;
            for (let step = 0; step < 6; step++) {
                const f = Math.sqrt(lo * hi);
                if (winRate(run(b, { attack: f, hp: curHp }, 90000 + step * 211)) < goal) lo = f; else hi = f;
            }
            const attack = Math.round(Math.sqrt(lo * hi) * 100) / 100;
            let hp;
            if (only) {
                // Seconde passe : PV gardés ; si l'attaque est au plancher et que le boss reste trop dur, ses PV baissent (≥ ×0,6).
                hp = curHp;
                if (winRate(run(b, { attack, hp }, 97000)) < goal - 0.1) {
                    let hlo = 0.6, hhi = curHp;
                    for (let step = 0; step < 5; step++) {
                        const h = (hlo + hhi) / 2;
                        if (winRate(run(b, { attack, hp: h }, 98000 + step * 97)) < goal) hhi = h; else hlo = h;
                    }
                    hp = Math.round((hlo + hhi) / 2 * 100) / 100;
                }
            } else {
                // 2. PV : durée des victoires ramenée vers le milieu de la fenêtre (bornée à ×0,6 - ×1,6).
                const won = run(b, { attack }, 95000).filter(r => r.heroWon);
                const dur = won.length ? mean(won.map(r => r.cycles * r.cycleSeconds)) : targetSec;
                hp = Math.round(Math.min(1.6, Math.max(0.6, targetSec / dur)) * 100) / 100;
            }
            table[b.id] = { attack, hp };
            console.log(b.id, b.level, JSON.stringify(table[b.id]));
        }
        console.log('BOSS_ADJUST =', JSON.stringify(table));
    }
    if (mode === 'bosses') {
        const fights = Number(process.argv[3]) || 8;
        const aiMode = process.env.AI || 'auto';
        const { SCREENS } = await import('../story.js');
        const bosses = [];
        for (const sc of Object.values(SCREENS)) for (const e of (sc.enemies || [])) if (e.boss && !e.duel && !e.arena) bosses.push({ id: e.id, templateId: e.templateId, name: e.boss.name || e.name, level: e.boss.level });
        bosses.sort((a, b) => a.level - b.level);
        if (process.env.BOSSES) bosses.splice(0, bosses.length, ...bosses.filter(b => process.env.BOSSES.split(',').includes(b.id)));
        const rows = [];
        let seed = Number(process.env.SEED) || 31000;
        for (const b of bosses) {
            const list = [];
            for (const cls of CLASSES) for (let i = 0; i < fights; i++) {
                const { hero, options } = heroAt(cls, Math.max(1, b.level - 1), 'complet');
                const enemy = createMapEnemy({ templateId: b.templateId, level: b.level, kitLevel: Math.max(1, b.level - 2), enemyId: b.id, boss: { name: b.name, level: b.level } });
                const c = CB.calibrateEnemy({ category: 'boss', heroMaxHp: hero.maxHp, heroLevel: hero.level, enemyLevel: b.level, difficulty: aiMode, adjust: process.env.NO_ADJUST ? null : (CB.BOSS_ADJUST[b.id] || null) });
                enemy.maxHp = enemy.hp = c.hp; enemy.gearScale = c.gearScale;
                const r = simulateFight(hero, enemy, { seed: seed++, boardSize: 10, enemyDamageScale: c.damageMult, aiPreference: aiMode, ...options });
                list.push({ ...r, cycleSeconds: c.cycleSeconds });
            }
            const won = list.filter(r => r.heroWon);
            rows.push({ boss: b.name.slice(0, 34), id: b.id, niveau: b.level, 'victoires %': Math.round(winRate(list) * 100), 'durée victoire (s)': Math.round(mean(won.map(r => r.cycles * r.cycleSeconds))), 'durée moyenne (s)': Math.round(mean(list.map(r => r.cycles * r.cycleSeconds))), 'PV restants (%)': Math.round(mean(won.map(r => r.heroHpLeft / r.heroMaxHp)) * 100) });
        }
        console.table(rows);
        console.log('JSON', JSON.stringify(rows));
    }
    if (mode === 'check') {
        const fights = Number(process.argv[3]) || 10;
        console.table(CATEGORIES.map(cat => report(cat, calibratedFights(cat, { fights, seed0: 90000 }))));
    }
}
