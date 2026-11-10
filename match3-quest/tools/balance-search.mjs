// Recherche d'équilibrage par simulation (tools/combatSim.mjs). Usage : node match3-quest/tools/balance-search.mjs [rates|search] [combats]
// 1. rates : mesure, par niveau, les dégâts effectifs du héros par cycle et les dégâts bruts de l'ennemi par cycle (avant calibrage).
// 2. search : avec ces taux, cherche pour chaque catégorie le rapport ENEMY_WIN_RATIO qui donne le taux de victoire visé, puis vérifie
//    durée (cycles × 30 s) et victoires sur des combats calibrés comme dans le jeu.
await import('../tests/unit/fixtures/playerForge.js');   // catalogues JSON lus depuis le disque (XMLHttpRequest simulé)
const { MILESTONES } = await import('../tests/unit/fixtures/playerForge.js');
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

const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

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
export function calibratedFights(cat, { winRatio, fights = 6, seed0 = 1000, milestones = MILESTONES } = {}) {
    const out = [];
    let seed = seed0;
    for (const m of milestones) for (const cls of CLASSES) for (let i = 0; i < fights; i++) {
        const hero = m.forge(cls);
        const level = enemyLevelFor(cat, m.level);
        const enemy = makeEnemy(cat, level, i + seed);
        const c = CB.calibrateEnemy({ category: cat, heroMaxHp: hero.maxHp, heroLevel: hero.level, enemyLevel: level, winRatio });
        enemy.maxHp = enemy.hp = c.hp;
        const r = simulateFight(hero, enemy, { seed: seed++, boardSize: cat === 'boss' ? 10 : 8, enemyDamageScale: c.damageScale * c.heroDamageScale });
        out.push({ ...r, level: m.level, cls, targetCycles: c.cycles, cycleSeconds: c.cycleSeconds });
    }
    return out;
}
const winRate = list => list.filter(r => r.heroWon).length / list.length;

/** Rapport ENEMY_WIN_RATIO qui donne le taux de victoire visé (dichotomie : plus le rapport est grand, plus l'ennemi est lent à tuer). */
export function searchRatio(cat, { fights = 6 } = {}) {
    let lo = 0.6, hi = 3;
    for (let step = 0; step < 7; step++) {
        const mid = (lo + hi) / 2;
        if (winRate(calibratedFights(cat, { winRatio: mid, fights })) < TARGET_WIN_RATE[cat]) lo = mid; else hi = mid;
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
    if (mode === 'check') {
        const fights = Number(process.argv[3]) || 10;
        console.table(CATEGORIES.map(cat => report(cat, calibratedFights(cat, { fights, seed0: 90000 }))));
    }
}
