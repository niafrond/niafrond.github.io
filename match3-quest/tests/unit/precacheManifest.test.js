import { readFileSync, readdirSync, existsSync } from 'fs';
import { buildManifest, serialize, MANIFEST_FILE, GAME_DIR, MEDIA_SPRITE_DIRS, GBA_SPRITE_DIR } from '../../tools/precache-manifest.mjs';

const committed = JSON.parse(readFileSync(new URL(`../../${MANIFEST_FILE}`, import.meta.url), 'utf8'));
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

describe('precache-manifest.json', () => {
    test('est à jour avec les fichiers du jeu (sinon : npm run precache:build)', () => {
        expect(readFileSync(new URL(`../../${MANIFEST_FILE}`, import.meta.url), 'utf8')).toBe(serialize(buildManifest()));
    });

    test('le cœur contient index.html, les feuilles de style, les polices, les données et tous les modules de l\'import map', () => {
        const core = new Set(committed.core);
        ['index.html', 'style.css', 'retro.css', 'manifest.json', 'icon.svg', 'spells.json', 'enemies.catalog.json', 'audio/manifest.json',
            'fonts/pixelify-sans-400.woff2', 'fonts/press-start-2p.woff2', 'sprites/gbaIndex.js', 'world/index.js'].forEach(p => expect(core.has(p)).toBe(true));
        const modules = /var map = \{\};\s*\n\s*(\[[^\n]*?\])\.forEach/.exec(html);
        expect(modules).not.toBeNull();
        const names = JSON.parse(modules[1]);
        expect(names.length).toBeGreaterThan(100);
        names.forEach(name => expect({ name, inCore: core.has(name) }).toEqual({ name, inCore: true }));
    });

    test('les médias couvrent toutes les musiques et tous les dessins des cinématiques, sorts et ultimes', () => {
        const media = new Set(committed.media.map(f => f.p));
        const music = readdirSync(`${GAME_DIR}/audio/music`).filter(n => n.endsWith('.mp3'));
        expect(music.length).toBeGreaterThan(80);
        music.forEach(n => expect(media.has(`audio/music/${n}`)).toBe(true));
        MEDIA_SPRITE_DIRS.forEach(dir => {
            const files = readdirSync(`${GAME_DIR}/sprites/${dir}`).filter(n => n.endsWith('.png') || n.endsWith('.json'));
            expect(files.length).toBeGreaterThan(0);
            files.forEach(n => expect(media.has(`sprites/${dir}/${n}`)).toBe(true));
        });
    });

    test('sprites GBA : un média par module de sprites/gba/, et jamais leur source sprites/generated.js (3 Mo)', () => {
        const media = new Set(committed.media.map(f => f.p));
        const files = readdirSync(`${GAME_DIR}/${GBA_SPRITE_DIR}`).filter(n => n.endsWith('.js'));
        expect(files.length).toBeGreaterThan(400);
        files.forEach(n => expect(media.has(`${GBA_SPRITE_DIR}/${n}`)).toBe(true));
        expect(committed.core).not.toContain('sprites/generated.js');
        expect(media.has('sprites/generated.js')).toBe(false);
    });

    test('exclut les sources de génération, les outils et les tests (jamais demandés par le jeu)', () => {
        const all = [...committed.core, ...committed.media.map(f => f.p)];
        const forbidden = ['sprites/png/', 'sprites/ultimates-', 'tools/', 'tests/', 'docs/', 'agents/', 'inspiration/'];
        all.forEach(p => forbidden.forEach(prefix => expect({ p, bad: p.startsWith(prefix) }).toEqual({ p, bad: false })));
        expect(all.some(p => p.startsWith('test-'))).toBe(false);
        expect(all.some(p => p.endsWith('.mjs') || p.endsWith('.md'))).toBe(false);
        expect(all).not.toContain('../version.js');   // réécrit à chaque release : géré à part par le service worker
    });

    test('chaque média existe, avec la taille et une empreinte renseignées ; chemins sans doublon', () => {
        const paths = committed.media.map(f => f.p);
        expect(new Set(paths).size).toBe(paths.length);
        expect(new Set(committed.core).size).toBe(committed.core.length);
        committed.media.forEach(f => {
            expect(existsSync(`${GAME_DIR}/${f.p}`)).toBe(true);
            expect(f.s).toBeGreaterThan(0);
            expect(f.h).toMatch(/^[0-9a-f]{10}$/);
        });
        const total = committed.media.reduce((sum, f) => sum + f.s, 0);
        expect(total).toBeGreaterThan(50e6);
        expect(total).toBeLessThan(450e6);   // garde-fou : un dossier de sources ajouté par erreur ferait exploser le téléchargement
    });
});
