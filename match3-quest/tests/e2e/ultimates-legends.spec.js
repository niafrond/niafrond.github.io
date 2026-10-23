// Ultimes de légende (Quatre Gardiens Célestes) : verrouillés au départ avec leur indice de quête, puis sélectionnables une fois débloqués,
// quelle que soit la classe, et conservés après un rechargement (sauvegarde).
import { test, expect } from '@playwright/test';

const URL = '/match3-quest/';
const loaded = page => page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 30_000 });

// Lignes de la liste « Ultime » de l'onglet Sorts : nom, verrouillé ou non, texte, bouton « Choisir » présent
const rows = page => page.evaluate(async () => {
    const g = await import('./game.js');
    g.updateSpellsTab();
    return [...document.querySelectorAll('#ultimate-spells-list .spell-item')].map(r => ({
        name: r.querySelector('.spell-name').textContent.trim(),
        locked: r.classList.contains('locked-spell'),
        text: r.querySelector('.spell-cost').textContent.trim(),
        choose: /Choisir/.test(r.textContent)
    }));
});

test.describe('match3-quest · ultimes de légende', () => {
    test.setTimeout(60_000);

    for (const index of [0, 1, 2, 3]) {
        test(`classe n°${index + 1} : verrouillés avec leur indice, puis débloqués par quête, choisis et conservés après rechargement`, async ({ page }) => {
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.goto(URL);
            await loaded(page);
            await page.locator('.class-card').nth(index).click();
            await page.click('#confirm-class');
            await page.waitForSelector('#explore-canvas', { state: 'visible' });

            // Départ : niveau 1, aucun ultime de classe, les quatre ultimes de légende sont verrouillés et disent où les gagner
            const before = await rows(page);
            const locked = before.filter(r => r.locked);
            expect(locked.map(r => r.name)).toEqual(expect.arrayContaining([
                expect.stringContaining('Renaissance de l\'Oiseau Vermillon'), expect.stringContaining('Carapace de la Tortue Noire'),
                expect.stringContaining('Chasse du Tigre Blanc'), expect.stringContaining('Tempête du Dragon d\'Azur')]));
            expect(locked).toHaveLength(4);
            locked.forEach(r => { expect(r.text).toContain('Quête'); expect(r.choose).toBe(false); });

            // La quête du Tigre Blanc rapporte son ultime (niveau 28 requis) : débloqué mais trop faible, puis sélectionnable au niveau 30
            const tigerLine = r => r.name.includes('Chasse du Tigre Blanc');
            await page.evaluate(async () => { (await import('./game.js')).grantUltimate('ultimateWhiteTiger'); });
            expect((await rows(page)).find(tigerLine)).toMatchObject({ locked: true, text: 'Niveau 28 requis' });
            await page.evaluate(async () => { const g = await import('./game.js'); g.player.level = 30; g.saveUpdate(); });
            const unlocked = await rows(page);
            expect(unlocked.find(tigerLine)).toMatchObject({ locked: false, choose: true });
            expect(unlocked.filter(r => r.locked)).toHaveLength(3);

            // Choix : l'ultime devient l'ultime équipé
            await page.evaluate(() => window.equipUltimate('ultimateWhiteTiger'));
            expect(await page.evaluate(async () => (await import('./game.js')).player.equippedUltimate)).toBe('ultimateWhiteTiger');

            // Sauvegarde : rien n'est perdu au rechargement
            expect(await page.evaluate(() => JSON.parse(localStorage.getItem('player')).unlockedUltimates)).toEqual(['ultimateWhiteTiger']);
            await page.reload();
            await loaded(page);
            const after = await rows(page);
            expect(after.find(tigerLine)).toMatchObject({ locked: false });
            expect(after.filter(r => r.locked)).toHaveLength(3);
            expect(await page.evaluate(async () => (await import('./game.js')).player.equippedUltimate)).toBe('ultimateWhiteTiger');
            expect(errors).toEqual([]);
        });
    }
});
