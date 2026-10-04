import { readFileSync, readdirSync, statSync } from 'fs';
import { SCREENS } from '../../story.js';
import { SPRITE_PACK_FILES, packContents } from '../../sprites/packContents.js';
import { NPC_PACK, ENEMY_PACK } from '../../sprites/packs.js';
import {
    SPRITE_PACKS, CORE_PACK, NPC_SPRITES, ENEMY_SPRITES, isPackLoaded, loadSpritePack, loadSpritePacks, packsForKeys,
    heroSprite, npcSprite, enemySprite
} from '../../sprites/index.js';

const screens = Object.values(SCREENS);
const regionKeys = region => {
    const scs = screens.filter(s => s.region === region);
    return {
        npcs: scs.flatMap(s => s.npcs).map(n => n.id),
        enemies: scs.flatMap(s => s.enemies).map(e => [e.spriteKey || e.id, e.templateId])
    };
};

describe('chargement des sprites à la demande', () => {
    test('aucun paquet n\'est chargé à l\'import : les dessins valent null', () => {
        SPRITE_PACKS.forEach(p => expect(isPackLoaded(p)).toBe(false));
        expect(heroSprite('sorcerer')).toBeNull();
        expect(enemySprite('sun_1', 'solar_titan')).toBeNull();
        // un PNJ dessiné à la main n'est pas remplacé par un villageois généré tant que son paquet manque
        const drawnNpc = Object.keys(NPC_PACK)[0];
        expect(npcSprite(drawnNpc)).toBeNull();
    });

    test('la première région ne demande pas tous les paquets', () => {
        const packs = packsForKeys(regionKeys('rizieres'));
        expect(packs).toContain(CORE_PACK);
        expect(packs.length).toBeLessThan(SPRITE_PACKS.length);
    });

    test('après chargement des paquets d\'une région, tous ses dessins sont disponibles', async () => {
        const keys = regionKeys('rizieres');
        await loadSpritePacks(packsForKeys(keys));
        keys.npcs.forEach(id => expect(npcSprite(id)).toBeTruthy());
        keys.enemies.forEach(([key, tpl]) => expect(enemySprite(key, tpl)).toBeTruthy());
        expect(heroSprite('sorcerer')).toBeTruthy();
    });

    test('un paquet n\'est importé qu\'une fois', async () => {
        const a = loadSpritePack('suns');
        const b = loadSpritePack('suns');
        await Promise.all([a, b]);
        expect(isPackLoaded('suns')).toBe(true);
        await expect(loadSpritePack('inconnu')).rejects.toThrow();
    });

    test('chaque région trouve tous ses dessins dans les paquets indiqués par l\'index', async () => {
        const regions = [...new Set(screens.map(s => s.region))];
        for (const region of regions) {
            const keys = regionKeys(region);
            const packs = packsForKeys(keys);
            const mods = await Promise.all(packs.map(p => import(`../../sprites/${SPRITE_PACK_FILES[p].slice(2)}`)));
            const npcs = Object.assign({}, ...mods.map(m => packContents(m).npcs));
            const enemies = Object.assign({}, ...mods.map(m => packContents(m).enemies));
            keys.npcs.filter(id => NPC_PACK[id]).forEach(id => expect(npcs[id]).toBeTruthy());
            keys.enemies.forEach(([key, tpl]) => expect(enemies[key] || enemies[tpl]).toBeTruthy());
        }
    });
});

describe('index des paquets (sprites/packs.js)', () => {
    test('à jour avec le contenu des fichiers de sprites (sinon : node match3-quest/sprites/build-packs.mjs)', async () => {
        const npc = {};
        const enemy = {};
        for (const pack of Object.keys(SPRITE_PACK_FILES)) {
            const c = packContents(await import(`../../sprites/${SPRITE_PACK_FILES[pack].slice(2)}`));
            Object.keys(c.npcs).forEach(k => { npc[k] = pack; });
            Object.keys(c.enemies).forEach(k => { enemy[k] = pack; });
        }
        expect(NPC_PACK).toEqual(npc);
        expect(ENEMY_PACK).toEqual(enemy);
    });

    test('une fois tout chargé, l\'assemblage contient exactement les clés de l\'index', async () => {
        await loadSpritePacks(SPRITE_PACKS);
        expect(Object.keys(NPC_SPRITES).sort()).toEqual(Object.keys(NPC_PACK).sort());
        expect(Object.keys(ENEMY_SPRITES).sort()).toEqual(Object.keys(ENEMY_PACK).sort());
    });
});

describe('import map anti-cache (index.html)', () => {
    test('chaque module JS chargé par le jeu y figure (sinon il serait servi sans ?v= et resterait en cache)', () => {
        const root = new URL('../../', import.meta.url);
        const html = readFileSync(new URL('index.html', root), 'utf8');
        const listed = new Set(JSON.parse(html.match(/\[("[^\]]+\.js",?\s*)+\]/)[0]));
        // Graphe des imports statiques et dynamiques à partir des scripts d'entrée ; les paquets de sprites sont
        // importés via une variable (SPRITE_PACK_FILES), on les ajoute explicitement.
        const seen = new Set();
        const queue = ['main.js', 'enemyAI.js', ...Object.values(SPRITE_PACK_FILES).map(f => `sprites/${f.slice(2)}`)];
        while (queue.length) {
            const file = queue.shift();
            if (seen.has(file)) continue;
            seen.add(file);
            const src = readFileSync(new URL(file, root), 'utf8');
            const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
            for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+\.js)['"]/g)) {
                const path = new URL(m[1], new URL(dir, 'file:///r/')).pathname;
                if (path.startsWith('/r/')) queue.push(path.slice(3));   // hors du dossier du jeu : ignoré
            }
        }
        expect(seen.size).toBeGreaterThan(40);
        [...seen].forEach(f => expect([f, listed.has(f)]).toEqual([f, true]));
    });
});
