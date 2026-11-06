import { describe, it, expect } from '@jest/globals';
import { importSaveFromFile, MAX_SAVE_FILE_BYTES } from '../../saveManager.js';
import { escapeHtml } from '../../escapeHtml.js';

global.FileReader = class FileReader {
    readAsText(file) {
        setTimeout(() => this.onload?.({ target: { result: file.content } }), 0);
    }
};

const metadata = (extra = {}) => ({ version: '1.0.0', format: 1, timestamp: 1700000000000, playerName: 'Hou Yi', level: 5, ...extra });
const file = (obj, extra = {}) => ({
    name: 'save.json',
    content: typeof obj === 'string' ? obj : JSON.stringify(obj),
    ...extra
});
const save = (player = {}, meta = {}) => ({ metadata: metadata(meta), player: { name: 'Hou Yi', level: 5, hp: 50, maxHp: 100, ...player } });

describe('import de sauvegarde : sécurité', () => {
    it('neutralise les balises HTML dans le nom du héros', async () => {
        const res = await importSaveFromFile(file(save({ name: '<img src=x onerror=alert(1)>Hou' }, { playerName: '<script>x</script>' })));
        expect(res.success).toBe(true);
        expect(res.player.name).not.toMatch(/[<>]/);
        expect(res.metadata.playerName).not.toMatch(/[<>]/);
        expect(res.message).not.toMatch(/[<>]/);
    });

    it('tronque un nom trop long et retire les caractères de contrôle', async () => {
        const res = await importSaveFromFile(file(save({ name: 'A'.repeat(500) + '\u0007\n' })));
        expect(res.player.name.length).toBeLessThanOrEqual(40);
        expect(res.player.name).not.toMatch(/[\u0000-\u001f]/);
    });

    it('remplace un nom de type inattendu par le nom par défaut', async () => {
        const res = await importSaveFromFile(file(save({ name: { toString: 'x' } })));
        expect(res.success).toBe(true);
        expect(res.player.name).toBe('Héros');
    });

    it('retire les champs de type inattendu sans rejeter la sauvegarde', async () => {
        const res = await importSaveFromFile(file(save({ gold: '999', xp: null, attack: [1], defense: { a: 1 }, class: 12, attributes: 'force', exploration: 'oui' })));
        expect(res.success).toBe(true);
        for (const key of ['gold', 'xp', 'attack', 'defense', 'class', 'attributes']) expect(res.player[key]).toBeUndefined();
        expect(res.player.exploration).toEqual({});
    });

    it('borne les valeurs hors limites', async () => {
        const res = await importSaveFromFile(file(save({ level: 5, hp: 5000, maxHp: 100, gold: 1e30, attack: -50, attributes: { force: 1e9, agilite: -3 } })));
        expect(res.success).toBe(true);
        expect(res.player.hp).toBe(100);
        expect(res.player.gold).toBeLessThanOrEqual(1e9);
        expect(res.player.attack).toBe(0);
        expect(res.player.attributes).toEqual({ force: 1000, agilite: 0 });
    });

    it('borne le niveau au maximum du jeu', async () => {
        const res = await importSaveFromFile(file(save({ level: 100000 })));
        expect(res.success).toBe(true);
        expect(res.player.level).toBe(70);
    });

    it('limite et filtre l’inventaire', async () => {
        const inventory = [...Array(800).fill({ id: 'x', name: 'Objet', type: 'artifact' }), 'chaine', 42, null];
        const res = await importSaveFromFile(file(save({ inventory })));
        expect(res.player.inventory.length).toBe(500);
        expect(res.player.inventory.every(i => typeof i === 'object' && i !== null)).toBe(true);
    });

    it('ignore les clés de pollution de prototype', async () => {
        const json = '{"metadata":{"version":"1","timestamp":1,"__proto__":{"polluted":1}},"player":{"level":3,"__proto__":{"polluted":1},"attributes":{"constructor":{"x":1},"force":2}}}';
        const res = await importSaveFromFile(file(json));
        expect(res.success).toBe(true);
        expect({}.polluted).toBeUndefined();
        expect(res.player.polluted).toBeUndefined();
        expect(Object.keys(res.player.attributes)).toEqual(['force']);
    });

    it('refuse un fichier trop volumineux (taille déclarée)', async () => {
        const res = await importSaveFromFile(file(save(), { size: MAX_SAVE_FILE_BYTES + 1 }));
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/volumineux/);
    });

    it('refuse un contenu trop volumineux (taille réelle)', async () => {
        const res = await importSaveFromFile(file(' '.repeat(MAX_SAVE_FILE_BYTES + 1)));
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/volumineux/);
    });

    it.each([
        ['JSON malformé', '{"metadata": '],
        ['tableau à la racine', '[]'],
        ['null', 'null'],
        ['sans joueur', JSON.stringify({ metadata: metadata() })],
        ['joueur de mauvais type', JSON.stringify({ metadata: metadata(), player: 'Hou Yi' })],
        ['métadonnées de mauvais type', JSON.stringify({ metadata: 'x', player: { level: 1 } })],
        ['version non textuelle', JSON.stringify({ metadata: metadata({ version: { a: 1 } }), player: { level: 1 } })],
        ['niveau non entier', JSON.stringify(save({ level: 'cinq' }))]
    ])('rejette proprement : %s', async (_label, content) => {
        const res = await importSaveFromFile(file(content));
        expect(res.success).toBe(false);
        expect(typeof res.message).toBe('string');
    });

    it('rejette un fichier non JSON ou absent', async () => {
        expect((await importSaveFromFile({ name: 'save.txt', content: '{}' })).success).toBe(false);
        expect((await importSaveFromFile(null)).success).toBe(false);
    });

    it('accepte une sauvegarde ancienne sans format', async () => {
        const legacy = { metadata: { version: '0.9', timestamp: 1600000000000, playerName: 'Ancien', level: 12 },
            player: { name: 'Ancien', level: 12, hp: 80, maxHp: 120, gold: 33, inventory: [{ id: 'a', name: 'Objet', type: 'artifact' }], exploration: { defeated: ['m1'] } } };
        const res = await importSaveFromFile(file(legacy));
        expect(res.success).toBe(true);
        expect(res.player).toMatchObject({ name: 'Ancien', level: 12, hp: 80, maxHp: 120, gold: 33 });
        expect(res.player.exploration.defeated).toEqual(['m1']);
    });
});

describe('escapeHtml', () => {
    it('échappe les caractères HTML sensibles', () => {
        expect(escapeHtml(`<img src="x" onerror='a'>&`)).toBe('&lt;img src=&quot;x&quot; onerror=&#39;a&#39;&gt;&amp;');
    });
    it('gère les valeurs non textuelles', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml(12)).toBe('12');
    });
});
