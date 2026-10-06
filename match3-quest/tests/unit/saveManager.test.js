import { describe, it, expect, beforeEach } from '@jest/globals';
import {
    exportSaveToFile,
    importSaveFromFile
} from '../../saveManager.js';
import { allWeapons } from '../../weapons.js';

// Mock FileReader for Node.js environment
global.FileReader = class FileReader {
    constructor() {
        this.onload = null;
    }
    readAsText(file) {
        const content = file.content;
        setTimeout(() => {
            if (this.onload) {
                this.onload({ target: { result: content } });
            }
        }, 0);
    }
};

describe('Save Manager', () => {
    let testPlayer;

    beforeEach(() => {
        testPlayer = {
            name: 'Hou Yi',
            level: 5,
            hp: 75,
            maxHp: 100,
            attack: 20,
            defense: 5,
            gold: 500,
            inventory: [
                { id: 'potion1', name: 'Elixir', type: 'consumable' },
                { id: 'shield1', name: 'Bouclier', type: 'shield', defense: 10 }
            ],
            equipment: {
                rightHand: { id: 'sword1', name: 'Epee', type: 'weapon' },
                leftHand: null,
                item: null
            },
            spells: [],
            exploration: {
                currentScreen: 'village_1',
                currentQuest: 'q_main_1'
            }
        };
    });

    describe('exportSaveToFile', () => {
        it('exports save correctly', () => {
            const result = exportSaveToFile(testPlayer, '1.0.0');

            expect(result.success).toBe(true);
            expect(result.blob).toBeInstanceOf(Blob);
            expect(result.filename).toMatch(/match3quest-save-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json/);
        });

        it('includes correct metadata', async () => {
            const result = exportSaveToFile(testPlayer, '1.0.0');
            const text = await result.blob.text();
            const data = JSON.parse(text);

            expect(data.metadata).toBeDefined();
            expect(data.metadata.version).toBe('1.0.0');
            expect(data.metadata.playerName).toBe('Hou Yi');
            expect(data.metadata.level).toBe(5);
            expect(Number.isInteger(data.metadata.timestamp)).toBe(true);
        });

        it('includes player data', async () => {
            const result = exportSaveToFile(testPlayer);
            const text = await result.blob.text();
            const data = JSON.parse(text);

            expect(data.player).toBeDefined();
            expect(data.player.name).toBe('Hou Yi');
            expect(data.player.level).toBe(5);
            expect(data.player.gold).toBe(500);
            expect(data.player.inventory).toHaveLength(2);
        });

        it('refuses to export without player', () => {
            const result = exportSaveToFile(null);
            expect(result.success).toBe(false);
        });

        it('generates unique filenames', async () => {
            const result1 = exportSaveToFile(testPlayer);
            // Wait 1 second to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 1000));
            const result2 = exportSaveToFile(testPlayer);

            expect(result1.filename).not.toBe(result2.filename);
        });
    });

    describe('importSaveFromFile', () => {
        it('imports valid save', async () => {
            const saveData = {
                metadata: {
                    version: '1.0.0',
                    timestamp: Date.now(),
                    playerName: 'Hou Yi',
                    level: 5
                },
                player: testPlayer
            };

            const json = JSON.stringify(saveData);
            const file = {
                name: 'test.json',
                content: json,
                type: 'application/json'
            };

            const importResult = await importSaveFromFile(file);

            expect(importResult.success).toBe(true);
            expect(importResult.player).toBeDefined();
            expect(importResult.player.name).toBe('Hou Yi');
            expect(importResult.player.level).toBe(5);
        });

        it('conserve l\'équipement après un export puis un import', async () => {
            const bow = allWeapons[0];
            testPlayer.weapons = [bow];
            testPlayer.equippedWeapon = bow;
            testPlayer.equipment.rightHand = bow;
            const exported = exportSaveToFile(testPlayer, '1.0.0');
            const file = { name: exported.filename, content: await exported.blob.text() };
            const res = await importSaveFromFile(file);

            expect(res.success).toBe(true);
            expect(res.player.equippedWeapon.id).toBe(bow.id);
            expect(res.player.equipment.rightHand.id).toBe(bow.id);
            expect(res.player.weapons.map(w => w.id)).toEqual([bow.id]);
            expect(res.player.inventory).toHaveLength(2);
        });

        it('conserve monstres vaincus, quêtes et coffres', async () => {
            testPlayer.exploration = {
                screenId: 'village_1', x: 3, y: 4,
                defeated: ['wolf_1', 'wolf_2'], openedChests: ['c1'],
                quests: { q1: 'done', q2: 'active' }, visitedScreens: ['village_1'],
                observed: { wolf_1: true }, mounted: true
            };
            const exported = exportSaveToFile(testPlayer, '1.0.0');
            const file = { name: exported.filename, content: await exported.blob.text() };
            const res = await importSaveFromFile(file);

            expect(res.player.exploration.defeated).toEqual(['wolf_1', 'wolf_2']);
            expect(res.player.exploration.quests).toEqual({ q1: 'done', q2: 'active' });
            expect(res.player.exploration.openedChests).toEqual(['c1']);
            expect(res.player.exploration.observed).toBeUndefined();
            expect(res.player.exploration.screenId).toBe('village_1');
            expect(res.player.exploration.x).toBeUndefined();
            expect(res.player.exploration.y).toBeUndefined();
            expect(res.metadata.progress).toContain('1 quête terminée');
            expect(res.metadata.progress).toContain('2 monstres vaincus');
        });

        it('n\'exporte ni mana, ni effets temporaires, ni valeurs dérivées', async () => {
            Object.assign(testPlayer, {
                mana: { red: 5 }, manaCaps: { red: 20 }, tempAttack: 3, statusEffects: { poison: 2 },
                combatPoints: 4, availableSpells: [{ id: 'x' }], availableWeapons: [{ id: 'y' }], xpToNextLevel: 100
            });
            const data = JSON.parse(await exportSaveToFile(testPlayer).blob.text());
            for (const k of ['mana', 'manaCaps', 'tempAttack', 'statusEffects', 'combatPoints', 'availableSpells', 'availableWeapons', 'xpToNextLevel']) {
                expect(data.player[k]).toBeUndefined();
            }
        });

        it('importe encore les anciennes sauvegardes (joueur complet)', async () => {
            const legacy = { metadata: { version: '1.0.0', timestamp: Date.now() }, player: { ...testPlayer, equippedWeapon: { id: 'w' } } };
            const res = await importSaveFromFile({ name: 'old.json', content: JSON.stringify(legacy) });
            expect(res.success).toBe(true);
            expect(res.player.equippedWeapon.id).toBe('w');
        });

        it('refuses non-JSON files', async () => {
            const file = { name: 'test.txt', content: 'invalid' };
            const result = await importSaveFromFile(file);

            expect(result.success).toBe(false);
            expect(result.message).toContain('JSON');
        });

        it('refuses invalid JSON', async () => {
            const file = { name: 'test.json', content: 'not valid json' };
            const result = await importSaveFromFile(file);

            expect(result.success).toBe(false);
        });

        it('refuses save without metadata', async () => {
            const invalidData = { player: testPlayer };
            const file = { name: 'test.json', content: JSON.stringify(invalidData) };
            const result = await importSaveFromFile(file);

            expect(result.success).toBe(false);
        });

        it('refuses null file', async () => {
            const result = await importSaveFromFile(null);
            expect(result.success).toBe(false);
        });
    });
});
