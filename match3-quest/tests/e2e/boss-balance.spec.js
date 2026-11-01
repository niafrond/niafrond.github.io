// Boss « contre-équipement » dans le vrai jeu : qì (départ, gain), parures contre ses sorts, IA qui lance ses attaques, butin garanti
// à la première victoire (et sauvegardé), aucune annonce du contre-équipement. Les règles pures sont testées dans
// tests/unit/bossBalance.test.js ; ici on vérifie leur branchement dans game.js / enemyAI.js.
import { test, expect } from '@playwright/test';

const URL = '/match3-quest/';
const loaded = page => page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 30_000 });

async function startGame(page) {
    await page.goto(URL);
    await loaded(page);
    await page.locator('.class-card').first().click();
    await page.click('#confirm-class');
    await page.waitForSelector('#explore-canvas', { state: 'visible' });
}

// Lance un combat contre un boss (comme startEncounterCombat de main.js) et renvoie son état initial.
const fightBoss = (page, { templateId = 'chiyou', level = 56, enemyId = 'boss_e2e', heroLevel = level } = {}) => page.evaluate(async ([templateId, level, enemyId, heroLevel]) => {
    const g = await import('./game.js'), bd = await import('./board.js'), en = await import('./enemies.js');
    g.player.level = heroLevel; g.player.maxHp = 4000; g.player.hp = 4000;
    document.getElementById('explore-container').style.display = 'none';
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-combat').classList.add('active');
    document.querySelector('.stats-container').style.display = 'flex';
    document.getElementById('board').style.display = 'grid';
    document.getElementById('spells-container').style.display = 'flex';
    g.startNewCombat(en.createMapEnemy({ templateId, level, boss: { name: 'Boss e2e' }, enemyId }));
    bd.generateBoard(); bd.renderBoard();
    return { name: g.enemy.name, isBoss: g.enemy.isBoss, element: g.enemy.preferredColor, weak: g.enemy.weakColor, mana: { ...g.enemy.mana }, spells: g.enemy.spells.map(s => ({ name: s.name, dmg: s.dmg || 0, cost: s.cost, color: s.color })), prepLines: g.enemy.prep?.lines || [], weaknessRevealed: !!g.enemy.prep?.weaknessRevealed };
}, [templateId, level, enemyId, heroLevel]);

test.describe('match3-quest · boss : contre-équipement', () => {
    test.setTimeout(90_000);

    test('un boss démarre avec du qì pour ses attaques, sans jamais annoncer le contre-équipement', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await startGame(page);
        const boss = await fightBoss(page);
        expect(boss.isBoss).toBe(true);
        expect(Object.values(boss.mana).some(v => v > 0)).toBe(true);
        expect(boss.spells.filter(s => s.dmg > 0).length).toBeGreaterThanOrEqual(2);
        // faiblesse visible (comme avant), mais ni parure, ni antidote, ni venin dans le texte du combat
        expect(boss.weaknessRevealed).toBe(true);
        expect(boss.prepLines.join(' ')).not.toMatch(/parure|antidote|venin/i);
        const bodyText = await page.evaluate(() => document.body.innerText);
        expect(bodyText).not.toMatch(/parure de|antidote est recommand/i);
        expect(errors).toEqual([]);
    });

    test('le qì d\'un boss monte plus vite que celui d\'un ennemi ordinaire (et sans bonus d\'attribut)', async ({ page }) => {
        await startGame(page);
        await fightBoss(page);
        const gains = await page.evaluate(async () => {
            const g = await import('./game.js'), en = await import('./enemies.js');
            g.enemy.mana = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
            const bossGain = g.addManaForColor(g.enemy, 'green', 3).gained;
            const plain = en.createMapEnemy({ templateId: 'chiyou', level: 56 });
            plain.mana = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
            const plainGain = g.addManaForColor(plain, 'green', 3).gained;   // vert : aucun bonus d'attribut pour l'ennemi ordinaire
            return { bossGain, plainGain, bonus: g.enemy.manaGainBonus };
        });
        expect(gains.bonus).toBeGreaterThan(0);
        expect(gains.bossGain).toBe(3 + gains.bonus);
        expect(gains.bossGain).toBeGreaterThan(gains.plainGain);
    });

    test('une parure de l\'élément du boss réduit les dégâts de ses sorts, pas celle d\'un autre élément', async ({ page }) => {
        await startGame(page);
        const boss = await fightBoss(page);
        const loss = await page.evaluate(async ([element]) => {
            const g = await import('./game.js');
            const spell = { id: 'test', name: 'Sort test', type: 'damage', color: element, cost: 1, dmg: 100 };
            const realRandom = Math.random;
            Math.random = () => 0.9999;   // ni critique ni blocage : dégâts déterministes
            const cast = (wornElement) => {
                g.player.stuffOwned = []; g.player.stuff = {};
                if (wornElement) ['head', 'neck', 'wrist', 'ring'].forEach(slot => { const id = `ward_${wornElement}_${slot}_2`; g.player.stuffOwned.push(id); g.player.stuff[slot] = id; });
                g.player.hp = g.player.maxHp = 4000;
                g.applyStandardSpellEffects(g.enemy, g.player, spell, false);
                return 4000 - g.player.hp;
            };
            const other = ['red', 'blue', 'green', 'yellow', 'purple'].find(c => c !== element);
            const out = { bare: cast(null), right: cast(element), wrong: cast(other) };
            Math.random = realRandom;
            return out;
        }, [boss.element]);
        expect(loss.bare).toBeGreaterThan(0);
        expect(loss.right).toBeLessThan(loss.bare * 0.7);
        expect(loss.wrong).toBe(loss.bare);
    });

    test('un boss qui a de quoi payer ses attaques les lance (IA)', async ({ page }) => {
        const casts = [];
        page.on('console', m => { if (/Action active - ennemi.*lance le sort/.test(m.text())) casts.push(m.text()); });
        await startGame(page);
        await fightBoss(page);
        await page.evaluate(async () => {
            const g = await import('./game.js');
            const realST = window.setTimeout.bind(window); window.setTimeout = (fn, ms, ...a) => realST(fn, 0, ...a);
            for (let i = 0; i < 12; i++) {
                g.enemy.mana = { red: 99, blue: 99, green: 99, yellow: 99, purple: 99 };
                g.enemy.statusEffects = {};
                g.player.hp = 4000;
                g.enemyTurn();
                await new Promise(r => realST(r, 250));
            }
        });
        expect(casts.length).toBeGreaterThanOrEqual(6);   // 85 % de lancers attendus sur 12 tours
    });

    test('première victoire : arme + relique + parure de l\'élément, une seule fois, et sauvegardées', async ({ page }) => {
        await startGame(page);
        const boss = await fightBoss(page, { enemyId: 'boss_loot' });
        const first = await page.evaluate(async () => {
            const g = await import('./game.js');
            const before = { weapons: g.player.weapons.length, items: g.player.inventory.length, stuff: (g.player.stuffOwned || []).length };
            g.enemy.hp = 0; g.handleEnemyDefeated();
            await new Promise(r => setTimeout(r, 400));
            return { weapons: g.player.weapons.length - before.weapons, items: g.player.inventory.length - before.items, stuff: g.player.stuffOwned.length - before.stuff, claimed: [...g.player.bossLootClaimed], wards: g.player.stuffOwned.filter(id => id.startsWith('ward_')) };
        });
        expect(first.weapons).toBeGreaterThanOrEqual(1);
        expect(first.stuff).toBeGreaterThanOrEqual(1);
        expect(first.claimed).toEqual(['map:boss_loot']);
        expect(first.wards.length).toBe(1);
        expect(first.wards[0]).toContain(`ward_${boss.element}_`);

        // même boss revaincu : plus de butin de palier
        await fightBoss(page, { enemyId: 'boss_loot' });
        const second = await page.evaluate(async () => {
            const g = await import('./game.js');
            const wards = g.player.stuffOwned.filter(id => id.startsWith('ward_')).length;
            g.enemy.hp = 0; g.handleEnemyDefeated();
            await new Promise(r => setTimeout(r, 400));
            return { claimed: [...g.player.bossLootClaimed], wards: g.player.stuffOwned.filter(id => id.startsWith('ward_')).length - wards };
        });
        expect(second.claimed).toEqual(['map:boss_loot']);
        expect(second.wards).toBe(0);

        // la clé survit au rechargement
        await page.evaluate(async () => { (await import('./game.js')).saveUpdate(); });
        await page.reload();
        await loaded(page);
        await page.waitForSelector('#explore-canvas', { state: 'visible' });
        expect(await page.evaluate(async () => (await import('./game.js')).player.bossLootClaimed)).toEqual(['map:boss_loot']);
    });

    test('niveau minimum : un boss de bas niveau n\'impose pas de résistances élémentaires', async ({ page }) => {
        await startGame(page);
        const low = await page.evaluate(async () => {
            const en = await import('./enemies.js');
            const boss = en.createMapEnemy({ templateId: 'chiyou', level: 10, boss: { name: 'B' }, enemyId: 'low' });
            const plain = en.createMapEnemy({ templateId: 'chiyou', level: 10 });
            return { boss: boss.resistances, plain: plain.resistances };
        });
        expect(low.boss).toEqual(low.plain);
    });
});
