// Captures d'interface de la soluce (soluce/img/change_puzzle.jpg, change_tuto.jpg, stuff_onglet.jpg) : puzzle de soin de Chang'e (avec son tutoriel)
// et onglet Stuff de l'inventaire, dans le vrai jeu (téléphone 430×860, aspect rétro).
// Usage : NODE_PATH=$(npm root -g) node match3-quest/tools/build-soluce-ui-shots.mjs [--base=http://localhost:4173]
// Prérequis : serveur statique à la racine du dépôt (ex. `python3 -m http.server 4173`) et Playwright (CHROMIUM_PATH si besoin).
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = (process.argv.find(a => a.startsWith('--base=')) || '=http://localhost:4173').split('=')[1];
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'soluce', 'img');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
const ctx = await browser.newContext({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('erreur page :', e.message));
const loaded = () => page.waitForFunction(() => !document.getElementById('loading-screen')?.classList.contains('visible'), null, { timeout: 60_000 });
await page.goto(`${BASE}/match3-quest/?shot=1`);
await loaded();
await page.click('.class-card');
await page.click('#confirm-class');
await page.waitForSelector('#explore-canvas', { state: 'visible' });
await page.waitForTimeout(1500);

// Onglet Stuff
// Quelques pièces portées et d'autres en réserve, pour que l'onglet ne soit pas vide.
await page.evaluate(async () => {
    const g = await import('./game.js'), st = await import('./stuff.js'), sv = await import('./stuffView.js');
    g.player.level = 12;   // pour pouvoir porter les pièces de la capture (la sauvegarde n'est pas écrite)
    const pick = slot => st.allStuff.filter(s => s.slot === slot && !s.quest).sort((a, b) => a.minLevel - b.minLevel);
    for (const slot of ['head', 'neck', 'wrist', 'ring']) pick(slot).slice(0, 2).forEach(s => st.grantStuff(g.player, s.id));
    ['head', 'neck'].forEach(slot => st.equipStuff(g.player, pick(slot)[0].id));
    sv.renderStuffTab();
    window.switchTab('stuff');
});
await page.mouse.move(2, 2);   // pas d'infobulle de survol
await page.evaluate(() => document.activeElement?.blur());
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, 'stuff_onglet.png') });
await page.evaluate(() => window.switchTab('combat'));

// Puzzle de soin : d'abord avec le tutoriel (première ouverture), puis sans
for (const [name, tuto] of [['change_tuto', false], ['change_puzzle', true]]) {
    await page.evaluate(async tutoSeen => {
        document.querySelectorAll('.change-overlay').forEach(n => n.remove());
        const v = await import('./change/view.js'), d = await import('./change/data.js');
        v.openHeal(document.body, { npc: d.EPISODES[0].injured[0], data: { done: [], pending: null, hp: {}, healed: [], return: null, keep: null, tuto: tutoSeen } });
    }, tuto);
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
}
await browser.close();
execFileSync('python3', ['-c', `
import sys, os
from PIL import Image
for n in ('stuff_onglet', 'change_tuto', 'change_puzzle'):
    p = os.path.join(sys.argv[1], n + '.png')
    im = Image.open(p).convert('RGB')
    im.save(p[:-4] + '.jpg', quality=80, optimize=True)
    os.remove(p)
`, OUT]);
console.log('ok');
