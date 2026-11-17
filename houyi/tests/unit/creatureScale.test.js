// Échelle des ennemis et des boss sur la carte (creatureScale.js) : chaque gabarit a sa taille, un crapaud n'est pas un dragon.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ENEMY_SCALE, creatureSize, LEGACY_SIZE, LEGACY_BOSS_SIZE, MAX_SIZE, MAX_BOSS_SIZE } from '../../creatureScale.js';
import { NPC_SCALE, npcScale } from '../../decor.js';
import { SCREENS } from '../../story.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'enemies.catalog.json'), 'utf8'));

describe('échelle des ennemis et des boss', () => {
    test('chaque gabarit du catalogue a sa taille, et inversement', () => {
        const ids = catalog.map(t => t.id);
        expect(ids.filter(id => !(id in ENEMY_SCALE))).toEqual([]);
        expect(Object.keys(ENEMY_SCALE).filter(id => !ids.includes(id))).toEqual([]);
    });

    test('les tailles sont bornées et un boss n\'est jamais plus petit que le gabarit ordinaire', () => {
        for (const id of Object.keys(ENEMY_SCALE)) {
            const n = creatureSize(id), b = creatureSize(id, true);
            expect({ id, ok: n >= 0.5 && n <= MAX_SIZE }).toEqual({ id, ok: true });
            expect({ id, ok: b >= n && b <= MAX_BOSS_SIZE }).toEqual({ id, ok: true });
        }
    });

    test('un gabarit inconnu garde l\'ancienne taille', () => {
        expect(creatureSize('inconnu')).toBe(LEGACY_SIZE);
        expect(creatureSize('inconnu', true)).toBe(LEGACY_BOSS_SIZE);
    });

    test('les petites créatures sont petites, les grandes grandes', () => {
        expect(creatureSize('crapaud_boue')).toBeLessThan(creatureSize('tigre_embrase'));
        expect(creatureSize('tigre_embrase')).toBeLessThan(creatureSize('long'));
        expect(creatureSize('petit_gui')).toBeLessThan(creatureSize('gui_esprit'));
        expect(creatureSize('jingwei')).toBeLessThan(creatureSize('peng'));
        expect(creatureSize('kuafu')).toBeGreaterThan(creatureSize('assassin_masque') * 1.8);   // un géant dépasse très nettement un homme
        expect(creatureSize('carpe_doree')).toBeLessThan(creatureSize('kun'));
        // un humain ordinaire garde à peu près la taille d'un personnage
        expect(creatureSize('assassin_masque')).toBeGreaterThan(0.9);
        expect(creatureSize('assassin_masque')).toBeLessThan(1.15);
    });

    test('le rival Fengmeng est un homme : même en boss, bien moins grand qu\'un monstre', () => {
        ['fengmeng_1', 'fengmeng_2', 'fengmeng_3a', 'fengmeng_3b'].forEach(id => expect(creatureSize(id, true)).toBeLessThan(creatureSize('tigre_embrase', true)));
        expect(creatureSize('fengmeng_2', true)).toBeLessThan(1.5);
    });

    test('les boss des cartes ont tous une taille propre ; les soleils sont les plus grands des boss ordinaires', () => {
        const bosses = Object.values(SCREENS).flatMap(sc => (sc.enemies || []).filter(e => e.boss && !e.span));
        expect(bosses.length).toBeGreaterThan(5);
        bosses.forEach(e => expect({ id: e.id, tpl: e.templateId, known: e.templateId in ENEMY_SCALE }).toEqual({ id: e.id, tpl: e.templateId, known: true }));
    });
});

describe('échelle des PNJ : enfants et animaux', () => {
    test('un enfant est plus petit qu\'un adulte, un buffle plus grand', () => {
        ['xiaobao', 'child_yuer', 'moon_child', 'fleuve_village_kid_ming'].forEach(id => expect(npcScale(id)).toBeLessThan(0.9));
        expect(npcScale('buffalo_dahei')).toBeGreaterThan(1.2);
        expect(npcScale('elder_wen')).toBe(1);
        expect(npcScale('sun_ten')).toBeLessThan(0.7);
    });
    test('chaque id de la table existe parmi les PNJ des cartes', () => {
        const ids = new Set(Object.values(SCREENS).flatMap(sc => (sc.npcs || []).map(n => n.id)));
        Object.keys(NPC_SCALE).filter(id => id !== 'jade_hare').forEach(id => expect({ id, existe: ids.has(id) }).toEqual({ id, existe: true }));
    });
});
